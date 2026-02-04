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
import { cumulativeScoring } from "@/lib/cumulativeScoring";
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
      console.log("Loading Round 3 questions...");
      const roundData = await QuestionLoader.loadRound3Questions();
      console.log("Round 3 data loaded:", roundData);
      
      // Convert to grid format and add database info
      const gridQuestions = QuestionLoader.convertRound3ToGrid(roundData);
      console.log("Grid questions:", gridQuestions);
      
      const flatQuestions = gridQuestions.flat().map((q, index) => ({
        ...q,
        id: `jeopardy_${index}`,
        jeopardy_row: Math.floor(index / Object.keys(roundData.categories).length),
        jeopardy_col: index % Object.keys(roundData.categories).length,
        is_locked: false,
        answered_by: null
      }));

      console.log("Flat questions:", flatQuestions);

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
      
      // Initialize Round 3 with cumulative scores + 500 bonus
      if (team) {
        await cumulativeScoring.initializeRound3Score(team.id);
        const teamScores = await cumulativeScoring.getTeamScores(team.id);
        if (teamScores) {
          setJeopardyState(prev => ({
            ...prev,
            totalScore: teamScores.jeopardyStartingScore
          }));
        }
      }
      
      setIsLoading(false);
    };

    initializeJeopardy();
  }, [fetchTeam, fetchQuestions, fetchGameState, team?.id]);

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

      // Jeopardy negative marking: Deduct base points if incorrect, reward points if correct
      const basePoints = question.points;
      const rewardPoints = question.reward;
      const pointsEarned = result.isCorrect ? rewardPoints : -basePoints;

      // Submit answer and release lock
      const submitSuccess = await JeopardyFCFS.submitAnswer(
        question.id,
        team.id,
        submission.code,
        result.isCorrect,
        pointsEarned,
        basePoints // Pass base points for negative marking logic
      );

      if (!submitSuccess) {
        throw new Error("Failed to submit answer");
      }

      // Update team score using cumulative scoring system
      await cumulativeScoring.updateRoundScore(team.id, 3, pointsEarned);

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

      // Update questions to mark as answered only if correct
      if (result.isCorrect) {
        setJeopardyState(prev => ({
          ...prev,
          questions: prev.questions.map(q => 
            q.id === question.id 
              ? { ...q, answered_by: team.team_name, is_locked: false }
              : q
          )
        }));
      } else {
        // If incorrect, question remains available for other teams
        setJeopardyState(prev => ({
          ...prev,
          questions: prev.questions.map(q => 
            q.id === question.id 
              ? { ...q, is_locked: false } // Just unlock, don't mark as answered
              : q
          )
        }));
      }

      setIsQuestionDialogOpen(false);
      
      toast.success(
        result.isCorrect 
          ? `Correct! +${pointsEarned} points` 
          : `Incorrect! ${pointsEarned} points deducted. Question remains available for others.`
      );
      
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full">
        {/* Compact Header */}
        <Card variant="glass" className="mb-4 flex-shrink-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
                    <Trophy className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
                    {jeopardyState.roundData?.round_info.round_name || "Code Jeopardy"} - Round 3
                  </h1>
                  <p className="text-sm text-muted-foreground">Team: {team.team_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`text-lg lg:text-xl font-mono font-bold ${
                  jeopardyState.timeRemaining < 600 ? 'text-destructive' : 'text-primary'
                }`}>
                  <Clock className="w-4 h-4 lg:w-5 lg:h-5 inline mr-2" />
                  {formatTime(jeopardyState.timeRemaining)}
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {jeopardyState.totalScore} Points
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Locks Display - Compact */}
        {jeopardyState.teamLocks.length > 0 && (
          <Card variant="neon" className="mb-4 flex-shrink-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4" />
                <span className="font-semibold">Your Locks:</span>
                {jeopardyState.teamLocks.map((lock) => (
                  <Badge key={lock.questionId} variant="destructive" className="text-xs">
                    Q{lock.questionId} ({Math.ceil(lock.timeRemaining / 60)}m)
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jeopardy Grid - Takes remaining space */}
        <Card variant="glass" className="flex-1 flex flex-col min-h-0">
          <CardContent className="p-4 flex-1 flex flex-col">
            <JeopardyGrid
              questions={jeopardyState.questions}
              onSelectQuestion={handleQuestionSelect}
              isTeamTurn={true}
              categories={Object.keys(jeopardyState.roundData?.categories || {})}
              currentTeam={team.team_name}
              lockedQuestions={getLockedQuestionIds()}
              gridData={jeopardyState.roundData ? QuestionLoader.convertRound3ToGrid(jeopardyState.roundData) : []}
            />
          </CardContent>
        </Card>

        {/* Question Dialog */}
        <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {jeopardyState.selectedQuestion?.category} - {jeopardyState.selectedQuestion?.points} Points
              </DialogTitle>
            </DialogHeader>
            
            {jeopardyState.selectedQuestion && (
              <div className="space-y-4">
                {/* Question Details */}
                <Card variant="neon">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{jeopardyState.selectedQuestion.difficulty}</Badge>
                        <Badge variant="outline">{jeopardyState.selectedQuestion.points} pts</Badge>
                        <Badge variant="success">{jeopardyState.selectedQuestion.reward} reward</Badge>
                      </div>
                    </div>
                    
                    <p className="text-base mb-3">{jeopardyState.selectedQuestion.question}</p>
                    
                    {/* Sample Input/Output */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Sample Input:</h4>
                        <pre className="p-2 bg-muted rounded text-xs font-mono">
                          {jeopardyState.selectedQuestion.sample_input}
                        </pre>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Sample Output:</h4>
                        <pre className="p-2 bg-muted rounded text-xs font-mono">
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
                  height="300px"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};