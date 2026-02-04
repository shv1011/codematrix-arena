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
import { cumulativeScoring } from "@/lib/cumulativeScoring";
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

  // Fetch constraint questions from JSON with shuffling
  const fetchQuestions = useCallback(async () => {
    try {
      const roundData = await QuestionLoader.loadRound2Questions({
        shuffle: true, // Enable question shuffling
        teamId: team?.id // Use team ID for consistent shuffling
      });
      
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
        evaluationRequest,
        question.points // Pass question weightage for Round 2
      );

      // Round 2: Points based on question weightage (already calculated in AI service)
      const pointsEarned = result.points;

      // Get round ID
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("id")
        .eq("round_number", 2)
        .single();

      if (roundError) throw roundError;

      // Save submission to database
      const { error: submissionError } = await supabase
        .from("submissions")
        .insert({
          team_id: team.id,
          question_id: questionId.toString(),
          round_id: roundData.id,
          question_text: question.question,
          answer: submission.code,
          is_correct: result.isCorrect,
          points_earned: pointsEarned,
          ai_feedback: result.feedback,
          ai_evaluation: result,
          submitted_at: new Date().toISOString()
        });

      if (submissionError) throw submissionError;

      // Update team score using cumulative scoring system
      await cumulativeScoring.updateRoundScore(team.id, 2, pointsEarned);

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

      toast.success(
        result.isCorrect 
          ? `Correct! +${pointsEarned} points` 
          : `Incorrect! ${pointsEarned} points (negative marking)`
      );

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
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Ultra Compact Question List Sidebar */}
      <div className="w-32 lg:w-36 bg-card/50 border-r border-border/50 flex flex-col">
        {/* Minimal Header */}
        <div className="p-2 border-b border-border/50">
          <div className="text-xs font-bold text-primary mb-1">Round 2</div>
          <div className="text-xs text-muted-foreground">
            {submittedCount}/{constraintState.questions.length}
          </div>
          <div className={`text-xs font-mono mt-1 ${
            constraintState.timeRemaining < 600 ? 'text-destructive' : 'text-primary'
          }`}>
            <Clock className="w-3 h-3 inline mr-1" />
            {formatTime(constraintState.timeRemaining)}
          </div>
        </div>
        
        {/* Question Navigation - Ultra Compact Grid */}
        <div className="flex-1 overflow-y-auto p-1">
          <div className="grid grid-cols-3 gap-1">
            {constraintState.questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => goToQuestion(index)}
                className={`
                  aspect-square text-xs font-mono rounded flex items-center justify-center transition-all
                  ${index === constraintState.currentQuestionIndex
                    ? 'bg-primary text-primary-foreground shadow-lg' 
                    : constraintState.submissions[question.id]?.submittedAt
                      ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                      : constraintState.submissions[question.id]?.code
                        ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
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
          >
            <Flag className="w-3 h-3 mr-1" />
            Submit All
          </Button>
        </div>
      </div>

      {/* Main Content Area - Maximum Space */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Minimal Top Bar */}
        <div className="p-2 border-b border-border/50 bg-card/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Constraint Paradox</span>
              <Badge variant="outline" className="text-xs px-1 py-0">
                {constraintState.currentQuestionIndex + 1}/{constraintState.questions.length}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {team.team_name} • {constraintState.totalScore} pts
            </div>
          </div>
        </div>

        {/* Split Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Question Panel - 40% width */}
          <div className="w-2/5 border-r border-border/50 overflow-y-auto p-4">
            {currentQuestion && (
              <div className="space-y-4">
                {/* Question Header - Ultra Compact */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs px-2 py-0">{currentQuestion.category}</Badge>
                    <Badge variant={
                      currentQuestion.difficulty === 'easy' ? 'success' :
                      currentQuestion.difficulty === 'medium' ? 'warning' :
                      'destructive'
                    } className="text-xs px-2 py-0">
                      {currentQuestion.difficulty}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs px-2 py-0">{currentQuestion.points} pts</Badge>
                </div>
                
                {/* Question Text - Large */}
                <div>
                  <h2 className="text-lg lg:text-xl font-semibold leading-relaxed mb-4">
                    {currentQuestion.question}
                  </h2>
                </div>

                {/* Constraints - Compact */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    Constraints
                  </h3>
                  <div className="space-y-2">
                    {currentQuestion.constraints.map((constraint, index) => (
                      <div key={index} className="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
                        {constraint}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Input/Output - Compact */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Sample Input:</h4>
                    <pre className="p-2 bg-muted rounded text-xs font-mono">{currentQuestion.sample_input}</pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Sample Output:</h4>
                    <pre className="p-2 bg-muted rounded text-xs font-mono">{currentQuestion.sample_output}</pre>
                  </div>
                </div>

                {/* Result Display */}
                {currentSubmission.result && (
                  <div className={`p-3 rounded-lg border ${
                    currentSubmission.result.isCorrect 
                      ? 'bg-green-500/10 border-green-500/30' 
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {currentSubmission.result.isCorrect ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm font-semibold">
                        {currentSubmission.result.isCorrect ? 'Correct!' : 'Incorrect'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {currentSubmission.result.pointsEarned} pts
                      </Badge>
                    </div>
                    {currentSubmission.result.feedback && (
                      <p className="text-xs text-muted-foreground">{currentSubmission.result.feedback}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Code Editor Panel - 60% width, Maximum Space */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-4">
              <CodeEditor
                value={currentSubmission.code}
                onChange={(code) => currentQuestion && updateCode(currentQuestion.id, code)}
                language={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                onSubmit={() => currentQuestion && submitSolution(currentQuestion.id)}
                isSubmitting={currentSubmission.isEvaluating}
                isSubmitted={!!currentSubmission.submittedAt}
                result={currentSubmission.result}
                height="calc(100vh - 120px)"
              />
            </div>
          </div>
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
  );
};