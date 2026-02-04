import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { QuestionLoader, Round1Question, Round1Data } from "@/lib/questionLoader";
import { aiEvaluationService, EvaluationRequest } from "@/lib/aiEvaluation";
import { cumulativeScoring } from "@/lib/cumulativeScoring";
import { performanceMonitor } from "@/lib/performance";
import { validateSubmissionForm, submissionRateLimiter } from "@/lib/validation";
import { toast } from "sonner";
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Trophy, 
  Target,
  ArrowRight,
  ArrowLeft,
  Flag,
  Timer,
  Brain,
  Loader2,
  Shield
} from "lucide-react";

interface QuizState {
  questions: Round1Question[];
  currentQuestionIndex: number;
  answers: Record<number, number>; // question id -> selected option index
  timeRemaining: number;
  isSubmitted: boolean;
  isEvaluating: boolean;
  score: number;
  roundData: Round1Data | null;
}

interface Team {
  id: string;
  team_name: string;
  team_code: string;
}

export const QuizInterface = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    timeRemaining: 1800, // 30 minutes - will be updated from JSON
    isSubmitted: false,
    isEvaluating: false,
    score: 0,
    roundData: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [gameState, setGameState] = useState<any>(null);

  // Fetch team data
  const fetchTeam = useCallback(async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("leader_email", user.email)
        .eq("is_active", true)
        .eq("is_disqualified", false)
        .single();

      if (error) throw error;
      setTeam(data);
    } catch (error) {
      console.error("Error fetching team:", error);
      toast.error("Failed to load team data");
    }
  }, [user?.email]);

  // Fetch quiz questions from JSON with shuffling and random selection
  const fetchQuestions = useCallback(async () => {
    try {
      const roundData = await QuestionLoader.loadRound1Questions({
        shuffle: true, // Enable question shuffling
        teamId: team?.id, // Use team ID for consistent shuffling
        shuffleOptions: true, // Also shuffle answer options
        selectCount: 45 // Randomly select 45 questions out of 61
      });
      
      setQuizState(prev => ({
        ...prev,
        questions: roundData.questions,
        timeRemaining: roundData.round_info.time_limit_seconds,
        roundData: roundData
      }));
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load quiz questions");
    }
  }, [team?.id]);

  // Fetch game state
  const fetchGameState = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("game_state")
        .select("*")
        .single();

      if (error) throw error;
      setGameState(data);
    } catch (error) {
      console.error("Error fetching game state:", error);
    }
  }, []);

  // Initialize quiz
  useEffect(() => {
    const initializeQuiz = async () => {
      setIsLoading(true);
      await Promise.all([fetchTeam(), fetchQuestions(), fetchGameState()]);
      setIsLoading(false);
    };

    initializeQuiz();
  }, [fetchTeam, fetchQuestions, fetchGameState]);

  // Timer countdown
  useEffect(() => {
    if (quizState.isSubmitted || quizState.timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setQuizState(prev => {
        const newTimeRemaining = prev.timeRemaining - 1;
        if (newTimeRemaining <= 0) {
          // Auto-submit when time runs out
          submitQuiz();
          return { ...prev, timeRemaining: 0 };
        }
        return { ...prev, timeRemaining: newTimeRemaining };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState.isSubmitted, quizState.timeRemaining]);

  // Format time display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle answer selection
  const selectAnswer = (questionId: number, optionIndex: number) => {
    setQuizState(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: optionIndex
      }
    }));
  };

  // Navigate questions
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < quizState.questions.length) {
      setQuizState(prev => ({ ...prev, currentQuestionIndex: index }));
    }
  };

  // Submit quiz
  const submitQuiz = async () => {
    if (!team) return;

    // Rate limiting check
    if (!submissionRateLimiter.isAllowed(team.id)) {
      toast.error("Too many submissions. Please wait before submitting again.");
      return;
    }

    setQuizState(prev => ({ ...prev, isEvaluating: true }));

    try {
      // Performance monitoring
      const submitStartTime = performance.now();
      
      let totalScore = 0;

      // Get round ID first
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("id")
        .eq("round_number", 1)
        .single();

      if (roundError) throw roundError;

      // Evaluate each question with AI
      for (const question of quizState.questions) {
        const userAnswerIndex = quizState.answers[question.id];
        const userAnswer = userAnswerIndex !== undefined ? question.options[userAnswerIndex] : "";
        
        // Validate submission data
        const validationResult = validateSubmissionForm({
          teamId: team.id,
          questionId: question.id.toString(),
          code: userAnswer,
          language: 'text', // MCQ doesn't have language
          roundNumber: 1
        });

        if (!validationResult.isValid) {
          console.warn('Validation failed for question:', question.id, validationResult.errors);
          continue;
        }
        
        // Prepare AI evaluation request
        const evaluationRequest: EvaluationRequest = {
          question: question.question,
          constraints: [], // No constraints for MCQ
          userCode: userAnswer, // User's selected answer
          testCases: [{
            input: question.question,
            expected_output: question.options[question.correct_answer]
          }],
          evaluationCriteria: `Multiple choice question. Correct answer is: "${question.options[question.correct_answer]}". User selected: "${userAnswer}"`
        };

        // Get AI evaluation with performance monitoring
        const aiResult = await performanceMonitor.timeFunction(
          'ai_evaluation',
          () => aiEvaluationService.evaluateSubmission(
            team.id,
            question.id.toString(),
            1, // Round 1
            evaluationRequest
          ),
          { questionId: question.id, round: 1 }
        );

        // Round 1: 10 points per correct answer
        const pointsEarned = aiResult.isCorrect ? 10 : 0;
        totalScore += pointsEarned;
      }

      // Skip submissions table - directly update team score
      await cumulativeScoring.updateRoundScore(team.id, 1, totalScore);

      setQuizState(prev => ({
        ...prev,
        isSubmitted: true,
        isEvaluating: false,
        score: totalScore
      }));

      // Record performance metrics
      const submitDuration = performance.now() - submitStartTime;
      performanceMonitor.recordMetric('quiz_submission', submitDuration, {
        teamId: team.id,
        questionCount: quizState.questions.length,
        score: totalScore
      });

      toast.success(`Quiz submitted! Score: ${totalScore} points`);
      setIsSubmitDialogOpen(false);

    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Failed to submit quiz");
      setQuizState(prev => ({ ...prev, isEvaluating: false }));
      
      // Record error metric
      performanceMonitor.recordMetric('quiz_submission_error', 1, {
        teamId: team?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  // Check if quiz is accessible
  const isQuizAccessible = () => {
    return gameState?.current_round === 1 && gameState?.is_competition_active && team?.is_active && !team?.is_disqualified;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Loading Quiz...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="glass" className="p-8 text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You are not registered as a team leader or your team is not active.</p>
        </Card>
      </div>
    );
  }

  if (!isQuizAccessible()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="glass" className="p-8 text-center">
          <Timer className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Quiz Not Available</h2>
          <p className="text-muted-foreground">
            {gameState?.current_round !== 1 
              ? "Round 1 is not currently active" 
              : !gameState?.is_competition_active 
                ? "Competition is not currently active"
                : "Please wait for the quiz to begin"}
          </p>
        </Card>
      </div>
    );
  }

  if (quizState.isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="neon" className="p-8 text-center max-w-md">
          <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Quiz Completed!</h2>
          <p className="text-xl mb-4">Team: {team.team_name}</p>
          <div className="text-4xl font-bold text-primary mb-4">{quizState.score} Points</div>
          <p className="text-muted-foreground">
            You answered {Object.keys(quizState.answers).length} out of {quizState.questions.length} questions
          </p>
        </Card>
      </div>
    );
  }

  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const progress = ((quizState.currentQuestionIndex + 1) / quizState.questions.length) * 100;
  const answeredCount = Object.keys(quizState.answers).length;

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Ultra Compact Question List Sidebar */}
      <div className="w-32 lg:w-36 bg-card/50 border-r border-border/50 flex flex-col">
        {/* Minimal Header */}
        <div className="p-2 border-b border-border/50">
          <div className="text-xs font-bold text-primary mb-1">Questions</div>
          <div className="text-xs text-muted-foreground">
            {answeredCount}/{quizState.questions.length}
          </div>
          <div className={`text-xs font-mono mt-1 ${
            quizState.timeRemaining < 300 ? 'text-destructive' : 'text-primary'
          }`}>
            <Clock className="w-3 h-3 inline mr-1" />
            {formatTime(quizState.timeRemaining)}
          </div>
        </div>
        
        {/* Question Navigation - Ultra Compact Grid */}
        <div className="flex-1 overflow-y-auto p-1">
          <div className="grid grid-cols-3 gap-1">
            {quizState.questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => goToQuestion(index)}
                className={`
                  aspect-square text-xs font-mono rounded flex items-center justify-center transition-all
                  ${index === quizState.currentQuestionIndex
                    ? 'bg-primary text-primary-foreground shadow-lg' 
                    : quizState.answers[question.id] !== undefined
                      ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                      : 'bg-muted hover:bg-muted/80'
                  }
                `}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Compact Submit Button */}
        <div className="p-2 border-t border-border/50">
          <Button 
            variant="neon" 
            size="sm" 
            className="w-full text-xs py-1"
            onClick={() => setIsSubmitDialogOpen(true)}
            disabled={answeredCount === 0}
          >
            <Flag className="w-3 h-3 mr-1" />
            Submit
          </Button>
        </div>
      </div>

      {/* Main Question Area - Maximum Space */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Minimal Top Bar */}
        <div className="p-2 border-b border-border/50 bg-card/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Round 1</span>
              <Badge variant="outline" className="text-xs px-1 py-0">
                {quizState.currentQuestionIndex + 1}/{quizState.questions.length}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {team.team_name}
            </div>
          </div>
        </div>

        {/* Question Content - Maximum Space */}
        <div className="flex-1 p-4 overflow-y-auto">
          {currentQuestion && (
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              {/* Question Header - Ultra Compact */}
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs px-2 py-0">{currentQuestion.category}</Badge>
                  <Badge variant="outline" className="text-xs px-2 py-0">{currentQuestion.difficulty}</Badge>
                </div>
                <Badge variant="success" className="text-xs px-2 py-0">{currentQuestion.points} pts</Badge>
              </div>
              
              {/* Question Text - Large and Clear */}
              <div className="mb-4 flex-shrink-0">
                <h2 className="text-2xl lg:text-3xl font-semibold leading-relaxed">
                  {currentQuestion.question}
                </h2>
              </div>

              {/* Answer Options - Maximum Space */}
              <div className="flex-1 space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => selectAnswer(currentQuestion.id, index)}
                    className={`
                      w-full p-5 lg:p-6 text-left rounded-lg border-2 transition-all
                      ${quizState.answers[currentQuestion.id] === index
                        ? 'border-primary bg-primary/10 text-primary shadow-lg'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`
                        w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 flex items-center justify-center text-base lg:text-lg font-bold
                        ${quizState.answers[currentQuestion.id] === index
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground'
                        }
                      `}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="text-lg lg:text-xl flex-1 leading-relaxed">{option}</span>
                      {quizState.answers[currentQuestion.id] === index && (
                        <CheckCircle className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Navigation - Ultra Minimal */}
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/50 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => goToQuestion(quizState.currentQuestionIndex - 1)}
                  disabled={quizState.currentQuestionIndex === 0}
                  size="sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Prev
                </Button>
                
                <div className="text-sm text-muted-foreground">
                  {quizState.answers[currentQuestion.id] !== undefined ? (
                    <span className="text-green-500 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Done
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Pending
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => goToQuestion(quizState.currentQuestionIndex + 1)}
                  disabled={quizState.currentQuestionIndex === quizState.questions.length - 1}
                  size="sm"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Submit Dialog - Unchanged */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to submit your quiz?</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">Questions Answered:</p>
                <p>{answeredCount} out of {quizState.questions.length}</p>
              </div>
              <div>
                <p className="font-semibold">Time Remaining:</p>
                <p>{formatTime(quizState.timeRemaining)}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Once submitted, you cannot change your answers.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="neon" 
                onClick={submitQuiz}
                disabled={quizState.isEvaluating}
              >
                {quizState.isEvaluating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  "Submit Quiz"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};