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
  Brain
} from "lucide-react";

interface QuizState {
  questions: Round1Question[];
  currentQuestionIndex: number;
  answers: Record<number, number>; // question id -> selected option index
  timeRemaining: number;
  isSubmitted: boolean;
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

  // Fetch quiz questions from JSON
  const fetchQuestions = useCallback(async () => {
    try {
      const roundData = await QuestionLoader.loadRound1Questions();
      
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
  }, []);

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

    try {
      let totalScore = 0;
      const submissions = [];

      // Calculate score and prepare submissions
      for (const question of quizState.questions) {
        const userAnswerIndex = quizState.answers[question.id];
        const isCorrect = userAnswerIndex === question.correct_answer;
        
        const pointsEarned = isCorrect ? question.points : 0;
        totalScore += pointsEarned;

        submissions.push({
          team_id: team.id,
          question_id: question.id.toString(),
          round_number: 1,
          answer: userAnswerIndex !== undefined ? question.options[userAnswerIndex] : "",
          is_correct: isCorrect,
          points_earned: pointsEarned,
          submitted_at: new Date().toISOString()
        });
      }

      // Submit all answers to submissions table
      const { error: submissionError } = await supabase
        .from("submissions")
        .insert(submissions);

      if (submissionError) throw submissionError;

      // Update team score
      const { error: scoreError } = await supabase
        .from("teams")
        .update({
          round1_score: totalScore,
          total_score: totalScore,
          round1_completed_at: new Date().toISOString()
        })
        .eq("id", team.id);

      if (scoreError) throw scoreError;

      setQuizState(prev => ({
        ...prev,
        isSubmitted: true,
        score: totalScore
      }));

      toast.success(`Quiz submitted! Your score: ${totalScore} points`);
      setIsSubmitDialogOpen(false);

    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Failed to submit quiz");
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card variant="glass" className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Brain className="w-6 h-6 text-primary" />
                  {quizState.roundData?.round_info.round_name || "Aptitude Arena"} - Round 1
                </h1>
                <p className="text-muted-foreground">Team: {team.team_name}</p>
                {quizState.roundData && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {quizState.roundData.round_info.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-mono font-bold ${
                  quizState.timeRemaining < 300 ? 'text-destructive' : 'text-primary'
                }`}>
                  <Clock className="w-5 h-5 inline mr-2" />
                  {formatTime(quizState.timeRemaining)}
                </div>
                <p className="text-sm text-muted-foreground">Time Remaining</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  Question {quizState.currentQuestionIndex + 1} of {quizState.questions.length}
                </Badge>
                <Badge variant="secondary">
                  {answeredCount} Answered
                </Badge>
              </div>
              <Progress value={progress} className="w-48" />
            </div>
          </CardContent>
        </Card>

        {/* Question */}
        {currentQuestion && (
          <Card variant="neon" className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">
                  Question {quizState.currentQuestionIndex + 1}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{currentQuestion.category}</Badge>
                  <Badge variant={
                    currentQuestion.difficulty === 'easy' ? 'success' :
                    currentQuestion.difficulty === 'medium' ? 'warning' :
                    'destructive'
                  }>
                    {currentQuestion.difficulty}
                  </Badge>
                  <Badge variant="outline">{currentQuestion.points} pts</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg mb-6 leading-relaxed">{currentQuestion.question}</p>
              
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectAnswer(currentQuestion.id, index)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                      quizState.answers[currentQuestion.id] === index
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center font-bold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {quizState.answers[currentQuestion.id] === index && (
                        <CheckCircle className="w-5 h-5 ml-auto" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(quizState.currentQuestionIndex - 1)}
            disabled={quizState.currentQuestionIndex === 0}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {quizState.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => goToQuestion(index)}
                className={`w-10 h-10 rounded-lg border-2 font-bold transition-all ${
                  index === quizState.currentQuestionIndex
                    ? 'border-primary bg-primary text-primary-foreground'
                    : quizState.answers[quizState.questions[index]?.id] !== undefined
                      ? 'border-green-500 bg-green-500/20 text-green-500'
                      : 'border-border hover:border-primary/50'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {quizState.currentQuestionIndex < quizState.questions.length - 1 ? (
              <Button
                variant="outline"
                onClick={() => goToQuestion(quizState.currentQuestionIndex + 1)}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="neon"
                onClick={() => setIsSubmitDialogOpen(true)}
              >
                <Flag className="w-4 h-4" />
                Submit Quiz
              </Button>
            )}
          </div>
        </div>

        {/* Submit Confirmation Dialog */}
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
                <Button variant="neon" onClick={submitQuiz}>
                  Submit Quiz
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};