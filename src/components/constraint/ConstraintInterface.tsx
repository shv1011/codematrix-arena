import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { QuestionLoader, Round2Question, Round2Data } from "@/lib/questionLoader";
import { aiEvaluationService, EvaluationRequest } from "@/lib/aiEvaluation";
import { CodeEditor } from "./CodeEditor";
import { toast } from "sonner";
import { 
  Clock, 
  Code, 
  AlertTriangle, 
  Trophy, 
  Target,
  ArrowRight,
  ArrowLeft,
  Flag,
  Timer,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Play
} from "lucide-react";

interface ConstraintState {
  questions: Round2Question[];
  currentQuestionIndex: number;
  submissions: Record<number, {
    code: string;
    language: string;
    submittedAt?: string;
    isEvaluating?: boolean;
    result?: any;
  }>;
  timeRemaining: number;
  isSubmitted: boolean;
  totalScore: number;
  roundData: Round2Data | null;
}

interface Team {
  id: string;
  team_name: string;
  team_code: string;
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
];

export const ConstraintInterface = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [constraintState, setConstraintState] = useState<ConstraintState>({
    questions: [],
    currentQuestionIndex: 0,
    submissions: {},
    timeRemaining: 3600, // 60 minutes - will be updated from JSON
    isSubmitted: false,
    totalScore: 0,
    roundData: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [gameState, setGameState] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');

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

  // Fetch constraint questions from JSON
  const fetchQuestions = useCallback(async () => {
    try {
      const roundData = await QuestionLoader.loadRound2Questions();
      
      setConstraintState(prev => ({
        ...prev,
        questions: roundData.questions,
        timeRemaining: roundData.round_info.time_limit_seconds,
        roundData: roundData
      }));
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load constraint questions");
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

  // Initialize constraint interface
  useEffect(() => {
    const initializeConstraint = async () => {
      setIsLoading(true);
      await Promise.all([fetchTeam(), fetchQuestions(), fetchGameState()]);
      setIsLoading(false);
    };

    initializeConstraint();
  }, [fetchTeam, fetchQuestions, fetchGameState]);

  // Timer countdown
  useEffect(() => {
    if (constraintState.isSubmitted || constraintState.timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setConstraintState(prev => {
        const newTimeRemaining = prev.timeRemaining - 1;
        if (newTimeRemaining <= 0) {
          // Auto-submit when time runs out
          submitAllSolutions();
          return { ...prev, timeRemaining: 0 };
        }
        return { ...prev, timeRemaining: newTimeRemaining };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [constraintState.isSubmitted, constraintState.timeRemaining]);

  // Format time display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle code change
  const updateCode = (questionId: number, code: string) => {
    setConstraintState(prev => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [questionId]: {
          ...prev.submissions[questionId],
          code,
          language: selectedLanguage
        }
      }
    }));
  };

  // Navigate questions
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < constraintState.questions.length) {
      setConstraintState(prev => ({ ...prev, currentQuestionIndex: index }));
    }
  };

  // Submit single solution for evaluation
  const submitSolution = async (questionId: number) => {
    if (!team) return;

    const submission = constraintState.submissions[questionId];
    if (!submission?.code.trim()) {
      toast.error("Please write some code before submitting");
      return;
    }

    const question = constraintState.questions.find(q => q.id === questionId);
    if (!question) return;

    // Mark as evaluating
    setConstraintState(prev => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [questionId]: {
          ...prev.submissions[questionId],
          isEvaluating: true
        }
      }
    }));

    try {
      const evaluationRequest: EvaluationRequest = {
        question: question.question,
        constraints: question.constraints,
        userCode: submission.code,
        testCases: question.test_cases,
        evaluationCriteria: question.evaluation_criteria
      };

      const result = await aiEvaluationService.evaluateSubmission(
        team.id,
        questionId.toString(),
        2,
        evaluationRequest
      );

      // Calculate points based on AI evaluation
      const pointsEarned = result.isCorrect ? question.points : Math.floor(question.points * (result.score / 100));

      // Save submission to database
      const { error: submissionError } = await supabase
        .from("submissions")
        .insert({
          team_id: team.id,
          question_id: questionId.toString(),
          round_number: 2,
          answer: submission.code,
          is_correct: result.isCorrect,
          points_earned: pointsEarned,
          ai_evaluation: result,
          submitted_at: new Date().toISOString()
        });

      if (submissionError) throw submissionError;

      // Update local state
      setConstraintState(prev => ({
        ...prev,
        submissions: {
          ...prev.submissions,
          [questionId]: {
            ...prev.submissions[questionId],
            isEvaluating: false,
            submittedAt: new Date().toISOString(),
            result: { ...result, pointsEarned }
          }
        },
        totalScore: prev.totalScore + pointsEarned
      }));

      toast.success(`Solution evaluated! Score: ${result.score}/100 (${pointsEarned} points)`);

    } catch (error) {
      console.error("Error submitting solution:", error);
      toast.error("Failed to evaluate solution");
      
      // Remove evaluating state
      setConstraintState(prev => ({
        ...prev,
        submissions: {
          ...prev.submissions,
          [questionId]: {
            ...prev.submissions[questionId],
            isEvaluating: false
          }
        }
      }));
    }
  };

  // Submit all solutions
  const submitAllSolutions = async () => {
    if (!team) return;

    try {
      let totalScore = 0;

      // Calculate total score from submitted solutions
      Object.values(constraintState.submissions).forEach(submission => {
        if (submission.result?.pointsEarned) {
          totalScore += submission.result.pointsEarned;
        }
      });

      // Update team score
      const { error: scoreError } = await supabase
        .from("teams")
        .update({
          round2_score: totalScore,
          total_score: totalScore, // This should be cumulative in real implementation
          round2_completed_at: new Date().toISOString()
        })
        .eq("id", team.id);

      if (scoreError) throw scoreError;

      setConstraintState(prev => ({
        ...prev,
        isSubmitted: true,
        totalScore: totalScore
      }));

      toast.success(`Round 2 completed! Total score: ${totalScore} points`);
      setIsSubmitDialogOpen(false);

    } catch (error) {
      console.error("Error submitting all solutions:", error);
      toast.error("Failed to submit solutions");
    }
  };

  // Check if round is accessible
  const isRoundAccessible = () => {
    return gameState?.current_round === 2 && gameState?.is_competition_active && team?.is_active && !team?.is_disqualified;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Loading Constraint Paradox...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="glass" className="p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">You are not registered as a team leader or your team is not active.</p>
        </Card>
      </div>
    );
  }

  if (!isRoundAccessible()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="glass" className="p-8 text-center">
          <Timer className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Round 2 Not Available</h2>
          <p className="text-muted-foreground">
            {gameState?.current_round !== 2 
              ? "Round 2 is not currently active" 
              : !gameState?.is_competition_active 
                ? "Competition is not currently active"
                : "Please wait for Round 2 to begin"}
          </p>
        </Card>
      </div>
    );
  }

  if (constraintState.isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="neon" className="p-8 text-center max-w-md">
          <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">Round 2 Completed!</h2>
          <p className="text-xl mb-4">Team: {team.team_name}</p>
          <div className="text-4xl font-bold text-primary mb-4">{constraintState.totalScore} Points</div>
          <p className="text-muted-foreground">
            You submitted solutions for {Object.keys(constraintState.submissions).length} questions
          </p>
        </Card>
      </div>
    );
  }

  const currentQuestion = constraintState.questions[constraintState.currentQuestionIndex];
  const progress = ((constraintState.currentQuestionIndex + 1) / constraintState.questions.length) * 100;
  const submittedCount = Object.values(constraintState.submissions).filter(s => s.submittedAt).length;
  const currentSubmission = constraintState.submissions[currentQuestion?.id] || { code: '', language: selectedLanguage };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card variant="glass" className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Zap className="w-6 h-6 text-primary" />
                  {constraintState.roundData?.round_info.round_name || "Constraint Paradox"} - Round 2
                </h1>
                <p className="text-muted-foreground">Team: {team.team_name}</p>
                {constraintState.roundData && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {constraintState.roundData.round_info.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-mono font-bold ${
                  constraintState.timeRemaining < 600 ? 'text-destructive' : 'text-primary'
                }`}>
                  <Clock className="w-5 h-5 inline mr-2" />
                  {formatTime(constraintState.timeRemaining)}
                </div>
                <p className="text-sm text-muted-foreground">Time Remaining</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  Question {constraintState.currentQuestionIndex + 1} of {constraintState.questions.length}
                </Badge>
                <Badge variant="secondary">
                  {submittedCount} Submitted
                </Badge>
                <Badge variant="outline">
                  {constraintState.totalScore} Points
                </Badge>
              </div>
              <Progress value={progress} className="w-48" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Question Panel */}
          <div className="space-y-6">
            {/* Question */}
            {currentQuestion && (
              <Card variant="neon">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">
                      Question {constraintState.currentQuestionIndex + 1}
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
                  
                  {/* Constraints */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      Constraints
                    </h3>
                    <div className="space-y-2">
                      {currentQuestion.constraints.map((constraint, index) => (
                        <div key={index} className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">{constraint}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sample Input/Output */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Sample Input:</h4>
                      <pre className="p-3 bg-muted rounded-lg text-sm font-mono">{currentQuestion.sample_input}</pre>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Sample Output:</h4>
                      <pre className="p-3 bg-muted rounded-lg text-sm font-mono">{currentQuestion.sample_output}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => goToQuestion(constraintState.currentQuestionIndex - 1)}
                disabled={constraintState.currentQuestionIndex === 0}
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {constraintState.questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToQuestion(index)}
                    className={`w-10 h-10 rounded-lg border-2 font-bold transition-all ${
                      index === constraintState.currentQuestionIndex
                        ? 'border-primary bg-primary text-primary-foreground'
                        : constraintState.submissions[constraintState.questions[index]?.id]?.submittedAt
                          ? 'border-green-500 bg-green-500/20 text-green-500'
                          : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                onClick={() => goToQuestion(constraintState.currentQuestionIndex + 1)}
                disabled={constraintState.currentQuestionIndex === constraintState.questions.length - 1}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Code Editor Panel */}
          <div className="space-y-6">
            <CodeEditor
              value={currentSubmission.code}
              onChange={(code) => currentQuestion && updateCode(currentQuestion.id, code)}
              language={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              onSubmit={() => currentQuestion && submitSolution(currentQuestion.id)}
              isSubmitting={currentSubmission.isEvaluating}
              isSubmitted={!!currentSubmission.submittedAt}
              result={currentSubmission.result}
              height="500px"
            />

            {/* Submit All Button */}
            <Button
              variant="neon"
              size="lg"
              className="w-full"
              onClick={() => setIsSubmitDialogOpen(true)}
            >
              <Flag className="w-4 h-4" />
              Submit All Solutions
            </Button>
          </div>
        </div>

        {/* Submit Confirmation Dialog */}
        <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit All Solutions?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Are you sure you want to submit all your solutions for Round 2?</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">Solutions Submitted:</p>
                  <p>{submittedCount} out of {constraintState.questions.length}</p>
                </div>
                <div>
                  <p className="font-semibold">Current Score:</p>
                  <p>{constraintState.totalScore} points</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Once submitted, you cannot modify your solutions.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="neon" onClick={submitAllSolutions}>
                  Submit All Solutions
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};