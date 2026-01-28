import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { QuestionLoader, Round3Data } from "@/lib/questionLoader";
import { aiEvaluationService, EvaluationRequest } from "@/lib/aiEvaluation";
import { JeopardyFCFS, FCFSSelection } from "@/lib/jeopardyFCFS";
import { JeopardyGrid } from "./JeopardyGrid";
import { CodeEditor } from "../constraint/CodeEditor";
import { toast } from "sonner";
import { 
  Clock, 
  Trophy, 
  Target,
  Flag,
  Timer,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
  Lock,
  Unlock,
  Users,
  Star
} from "lucide-react";

interface JeopardyState {
  questions: any[];
  selectedQuestion: any | null;
  submissions: Record<string, {
    code: string;
    language: string;
    submittedAt?: string;
    isEvaluating?: boolean;
    result?: any;
  }>;
  timeRemaining: number;
  totalScore: number;
  roundData: Round3Data | null;
  activeLocks: FCFSSelection[];
  teamLocks: FCFSSelection[];
}

interface Team {
  id: string;
  team_name: string;
  team_code: string;
  round3_score?: number;
}

export const JeopardyInterface = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [jeopardyState, setJeopardyState] = useState<JeopardyState>({
    questions: [],
    selectedQuestion: null,
    submissions: {},
    timeRemaining: 5400, // 90 minutes - will be updated from JSON
    totalScore: 0,
    roundData: null,
    activeLocks: [],
    teamLocks: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
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

  // Fetch jeopardy questions from JSON and database
  const fetchQuestions = useCallback(async () => {
    try {
      const roundData = await QuestionLoader.loadRound3Questions();
      
      // Convert to grid format and add database info
      const gridQuestions = QuestionLoader.convertRound3ToGrid(roundData);
      const flatQuestions = gridQuestions.flat().map((q, index) => ({
        ...q,
        id: `jeopardy_${index}`,
        jeopardy_row: Math.floor(index / 7),
        jeopardy_col: index % 7,
        is_locked: false,
        answered_by: null
      }));

      setJeopardyState(prev => ({
        ...prev,
        questions: flatQuestions,
        timeRemaining: roundData.round_info.time_limit_seconds,
        roundData: roundData
      }));
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to load jeopardy questions");
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

  // Fetch active locks
  const fetchLocks = useCallback(async () => {
    try {
      const [activeLocks, teamLocks] = await Promise.all([
        JeopardyFCFS.getActiveLocks(),
        team ? JeopardyFCFS.getTeamLocks(team.id) : Promise.resolve([])
      ]);

      setJeopardyState(prev => ({
        ...prev,
        activeLocks,
        teamLocks
      }));
    } catch (error) {
      console.error("Error fetching locks:", error);
    }
  }, [team]);

  // Initialize jeopardy interface
  useEffect(() => {
    const initializeJeopardy = async () => {
      setIsLoading(true);
      await Promise.all([fetchTeam(), fetchQuestions(), fetchGameState()]);
      setIsLoading(false);
    };

    initializeJeopardy();
  }, [fetchTeam, fetchQuestions, fetchGameState]);

  // Fetch locks when team is available
  useEffect(() => {
    if (team) {
      fetchLocks();
      
      // Set up real-time lock monitoring
      const subscription = JeopardyFCFS.subscribeToLockChanges((locks) => {
        setJeopardyState(prev => ({
          ...prev,
          activeLocks: locks
        }));
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [team, fetchLocks]);

  // Timer countdown
  useEffect(() => {
    if (jeopardyState.timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setJeopardyState(prev => {
        const newTimeRemaining = prev.timeRemaining - 1;
        if (newTimeRemaining <= 0) {
          toast.info("Time's up! Jeopardy round has ended.");
          return { ...prev, timeRemaining: 0 };
        }
        return { ...prev, timeRemaining: newTimeRemaining };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [jeopardyState.timeRemaining]);

  // Format time display
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle question selection
  const handleQuestionSelect = async (question: any) => {
    if (!team) return;

    // Check if question is already locked
    const lockStatus = await JeopardyFCFS.isQuestionLocked(question.id);
    
    if (lockStatus.isLocked && lockStatus.lockedBy !== team.team_name) {
      toast.error(`Question is locked by ${lockStatus.lockedBy} for ${Math.ceil((lockStatus.timeRemaining || 0) / 60)} more minutes`);
      return;
    }

    // Attempt to lock the question
    const lockResult = await JeopardyFCFS.requestQuestionLock(question.id, team.id);
    
    if (!lockResult.success) {
      toast.error(lockResult.message);
      return;
    }

    // Open question dialog
    setJeopardyState(prev => ({ ...prev, selectedQuestion: question }));
    setIsQuestionDialogOpen(true);
    
    // Refresh locks
    fetchLocks();
    
    toast.success("Question locked! You have 5 minutes to submit your answer.");
  };

  // Handle code change
  const updateCode = (code: string) => {
    if (!jeopardyState.selectedQuestion) return;
    
    setJeopardyState(prev => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [prev.selectedQuestion.id]: {
          ...prev.submissions[prev.selectedQuestion.id],
          code,
          language: selectedLanguage
        }
      }
    }));
  };

  // Submit solution
  const submitSolution = async () => {
    if (!team || !jeopardyState.selectedQuestion) return;

    const submission = jeopardyState.submissions[jeopardyState.selectedQuestion.id];
    if (!submission?.code.trim()) {
      toast.error("Please write some code before submitting");
      return;
    }

    const question = jeopardyState.selectedQuestion;

    // Mark as evaluating
    setJeopardyState(prev => ({
      ...prev,
      submissions: {
        ...prev.submissions,
        [question.id]: {
          ...prev.submissions[question.id],
          isEvaluating: true
        }
      }
    }));

    try {
      const evaluationRequest: EvaluationRequest = {
        question: question.question,
        constraints: [], // Jeopardy questions don't have constraints
        userCode: submission.code,
        testCases: question.test_cases,
        evaluationCriteria: "Code should solve the problem correctly and efficiently"
      };

      const result = await aiEvaluationService.evaluateSubmission(
        team.id,
        question.id,
        3,
        evaluationRequest
      );

      // Calculate points based on AI evaluation and reward system
      const basePoints = question.points;
      const rewardPoints = question.reward;
      const pointsEarned = result.isCorrect ? rewardPoints : Math.floor(basePoints * (result.score / 100));

      // Submit answer and release lock
      const submitSuccess = await JeopardyFCFS.submitAnswer(
        question.id,
        team.id,
        submission.code,
        result.isCorrect,
        pointsEarned
      );

      if (!submitSuccess) {
        throw new Error("Failed to submit answer");
      }

      // Update local state
      setJeopardyState(prev => ({
        ...prev,
        submissions: {
          ...prev.submissions,
          [question.id]: {
            ...prev.submissions[question.id],
            isEvaluating: false,
            submittedAt: new Date().toISOString(),
            result: { ...result, pointsEarned }
          }
        },
        totalScore: prev.totalScore + pointsEarned,
        selectedQuestion: null
      }));

      // Update questions to mark as answered
      setJeopardyState(prev => ({
        ...prev,
        questions: prev.questions.map(q => 
          q.id === question.id 
            ? { ...q, answered_by: team.team_name, is_locked: false }
            : q
        )
      }));

      setIsQuestionDialogOpen(false);
      
      toast.success(`Answer submitted! Score: ${result.score}/100 (${pointsEarned} points)`);
      
      // Refresh locks and questions
      fetchLocks();

    } catch (error) {
      console.error("Error submitting solution:", error);
      toast.error("Failed to evaluate solution");
      
      // Remove evaluating state
      setJeopardyState(prev => ({
        ...prev,
        submissions: {
          ...prev.submissions,
          [question.id]: {
            ...prev.submissions[question.id],
            isEvaluating: false
          }
        }
      }));
    }
  };

  // Check if round is accessible
  const isRoundAccessible = () => {
    return gameState?.current_round === 3 && gameState?.is_competition_active && team?.is_active && !team?.is_disqualified;
  };

  // Get locked question IDs for grid display
  const getLockedQuestionIds = () => {
    return new Set(jeopardyState.activeLocks.map(lock => lock.questionId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Loading Code Jeopardy...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card variant="glass" className="p-8 text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
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
          <h2 className="text-2xl font-bold mb-2">Round 3 Not Available</h2>
          <p className="text-muted-foreground">
            {gameState?.current_round !== 3 
              ? "Round 3 is not currently active" 
              : !gameState?.is_competition_active 
                ? "Competition is not currently active"
                : "Please wait for Round 3 to begin"}
          </p>
        </Card>
      </div>
    );
  }

  const currentSubmission = jeopardyState.selectedQuestion 
    ? jeopardyState.submissions[jeopardyState.selectedQuestion.id] || { code: '', language: selectedLanguage }
    : { code: '', language: selectedLanguage };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card variant="glass" className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-primary" />
                  {jeopardyState.roundData?.round_info.round_name || "Code Jeopardy"} - Round 3
                </h1>
                <p className="text-muted-foreground">Team: {team.team_name}</p>
                {jeopardyState.roundData && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {jeopardyState.roundData.round_info.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className={`text-2xl font-mono font-bold ${
                  jeopardyState.timeRemaining < 600 ? 'text-destructive' : 'text-primary'
                }`}>
                  <Clock className="w-5 h-5 inline mr-2" />
                  {formatTime(jeopardyState.timeRemaining)}
                </div>
                <p className="text-sm text-muted-foreground">Time Remaining</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {jeopardyState.totalScore} Points
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {jeopardyState.teamLocks.length} Locked
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {jeopardyState.activeLocks.length} Active Locks
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Locks Display */}
        {jeopardyState.teamLocks.length > 0 && (
          <Card variant="neon" className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Your Active Locks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {jeopardyState.teamLocks.map((lock) => (
                  <div key={lock.questionId} className="p-3 border rounded-lg bg-primary/5">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">Question {lock.questionId}</Badge>
                      <Badge variant="destructive">
                        {Math.ceil(lock.timeRemaining / 60)}m left
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Locked at {lock.lockedAt.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jeopardy Grid */}
        <Card variant="glass" className="mb-6">
          <CardContent className="p-6">
            <JeopardyGrid
              questions={jeopardyState.questions}
              onSelectQuestion={handleQuestionSelect}
              isTeamTurn={true}
              categories={Object.keys(jeopardyState.roundData?.categories || {})}
              currentTeam={team.team_name}
              lockedQuestions={getLockedQuestionIds()}
            />
          </CardContent>
        </Card>

        {/* Question Dialog */}
        <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {jeopardyState.selectedQuestion?.category} - {jeopardyState.selectedQuestion?.points} Points
              </DialogTitle>
            </DialogHeader>
            
            {jeopardyState.selectedQuestion && (
              <div className="space-y-6">
                {/* Question Details */}
                <Card variant="neon">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{jeopardyState.selectedQuestion.difficulty}</Badge>
                        <Badge variant="outline">{jeopardyState.selectedQuestion.points} pts</Badge>
                        <Badge variant="success">{jeopardyState.selectedQuestion.reward} reward</Badge>
                      </div>
                    </div>
                    
                    <p className="text-lg mb-4">{jeopardyState.selectedQuestion.question}</p>
                    
                    {/* Sample Input/Output */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Sample Input:</h4>
                        <pre className="p-3 bg-muted rounded-lg text-sm font-mono">
                          {jeopardyState.selectedQuestion.sample_input}
                        </pre>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Sample Output:</h4>
                        <pre className="p-3 bg-muted rounded-lg text-sm font-mono">
                          {jeopardyState.selectedQuestion.sample_output}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Code Editor */}
                <CodeEditor
                  value={currentSubmission.code}
                  onChange={updateCode}
                  language={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  onSubmit={submitSolution}
                  isSubmitting={currentSubmission.isEvaluating}
                  isSubmitted={!!currentSubmission.submittedAt}
                  result={currentSubmission.result}
                  height="400px"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};