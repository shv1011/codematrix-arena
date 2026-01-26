import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JeopardyGrid } from "@/components/jeopardy/JeopardyGrid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { toast } from "sonner";
import {
  Terminal,
  Clock,
  Trophy,
  Send,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  constraints: string | null;
  category: string | null;
  points: number;
  reward_points: number | null;
  is_locked: boolean;
  answered_by: string | null;
  jeopardy_row: number | null;
  jeopardy_col: number | null;
}

interface Team {
  id: string;
  team_name: string;
  total_score: number;
  round1_score: number;
  round2_score: number;
  round3_score: number;
  is_disqualified: boolean;
}

interface GameState {
  current_round: number;
  is_competition_active: boolean;
}

interface Round {
  id: string;
  round_number: number;
  round_name: string;
  is_active: boolean;
  time_limit_seconds: number | null;
}

export const UserDashboard = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('user-updates')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'game_state' }, () => fetchGameState())
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'questions' }, () => fetchQuestions())
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'teams' }, () => fetchTeam())
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const fetchInitialData = async () => {
    await Promise.all([fetchTeam(), fetchGameState()]);
  };

  const fetchTeam = async () => {
    if (!user?.email) return;
    
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("leader_email", user.email)
      .single();

    if (!error && data) {
      setTeam(data);
    }
  };

  const fetchGameState = async () => {
    const { data: gsData } = await supabase
      .from("game_state")
      .select("*")
      .single();

    if (gsData) {
      setGameState(gsData);
      
      // Fetch current round details
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("is_active", true)
        .single();

      if (roundData) {
        setCurrentRound(roundData);
        fetchQuestions(roundData.id);
      }
    }
  };

  const fetchQuestions = async (roundId?: string) => {
    const id = roundId || currentRound?.id;
    if (!id) return;

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("round_id", id);

    if (!error && data) {
      setQuestions(data);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestion || !team || !answer.trim()) return;

    setIsSubmitting(true);

    try {
      // Submit the answer
      const { error } = await supabase
        .from("submissions")
        .insert({
          team_id: team.id,
          question_id: selectedQuestion.id,
          round_id: currentRound?.id,
          answer: answer.trim(),
        });

      if (error) {
        toast.error("Failed to submit answer");
      } else {
        toast.success("Answer submitted! Awaiting evaluation...");
        setAnswer("");
        setSelectedQuestion(null);
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectJeopardyQuestion = (question: Question) => {
    setSelectedQuestion(question);
  };

  if (team?.is_disqualified) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card variant="glass" className="max-w-md text-center border-destructive/30">
          <CardContent className="pt-8 pb-8">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold mb-2">DISQUALIFIED</h2>
            <p className="text-muted-foreground font-mono">
              Your team has been removed from the competition.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameState?.is_competition_active) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card variant="glass" className="max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <Clock className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-display font-bold mb-2">WAITING FOR START</h2>
            <p className="text-muted-foreground font-mono">
              The competition hasn't started yet. Stand by...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <Terminal className="w-6 md:w-8 h-6 md:h-8 text-primary" />
            {team?.team_name || "Team Dashboard"}
          </h1>
          {currentRound && (
            <p className="text-muted-foreground font-mono mt-1">
              {currentRound.round_name} - Round {currentRound.round_number}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Card variant="glass" className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-xl text-gradient-primary">
                {team?.total_score || 0}
              </span>
              <span className="text-xs text-muted-foreground font-mono">pts</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Round Content */}
      {currentRound?.round_number === 3 ? (
        // Jeopardy Round
        <div className="space-y-6">
          <JeopardyGrid
            questions={questions.map(q => ({
              id: q.id,
              category: q.category || "",
              points: q.points,
              reward_points: q.reward_points || q.points,
              is_locked: q.is_locked,
              answered_by: q.answered_by,
              jeopardy_row: q.jeopardy_row || 0,
              jeopardy_col: q.jeopardy_col || 0,
            }))}
            onSelectQuestion={(q) => {
              const fullQuestion = questions.find(fq => fq.id === q.id);
              if (fullQuestion) setSelectedQuestion(fullQuestion);
            }}
          />
        </div>
      ) : (
        // Quiz / Constraint Rounds
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Question List */}
          <Card variant="neon">
            <CardHeader>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                {questions.length} questions available
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto scrollbar-cyber space-y-2">
              {questions.map((q, index) => (
                <motion.button
                  key={q.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedQuestion(q)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedQuestion?.id === q.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">Q{index + 1}</span>
                    <span className="text-sm text-primary font-mono">{q.points} pts</span>
                  </div>
                </motion.button>
              ))}
            </CardContent>
          </Card>

          {/* Question Detail & Answer */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>
                {selectedQuestion ? "Answer Question" : "Select a Question"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedQuestion ? (
                <div className="space-y-6">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border">
                    <p className="font-mono text-foreground whitespace-pre-wrap">
                      {selectedQuestion.question_text}
                    </p>
                    {selectedQuestion.constraints && (
                      <div className="mt-4 p-3 rounded bg-warning/10 border border-warning/30">
                        <p className="text-sm font-mono text-warning">
                          <AlertCircle className="w-4 h-4 inline mr-2" />
                          Constraints: {selectedQuestion.constraints}
                        </p>
                      </div>
                    )}
                  </div>

                  {Array.isArray(selectedQuestion.options) && selectedQuestion.options.length > 0 ? (
                    // MCQ Options
                    <div className="space-y-2">
                      {(selectedQuestion.options as string[]).map((option, idx) => (
                        <Button
                          key={idx}
                          variant={answer === option ? "neon" : "outline"}
                          className="w-full justify-start"
                          onClick={() => setAnswer(option)}
                        >
                          <span className="font-mono mr-3">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {option}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    // Text Answer
                    <div className="space-y-2">
                      <label className="text-sm font-mono text-muted-foreground">
                        YOUR ANSWER
                      </label>
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Enter your answer or code here..."
                        className="w-full h-32 p-3 rounded-lg border-2 border-border bg-input font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  )}

                  <Button
                    variant="neon"
                    size="lg"
                    className="w-full"
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit Answer
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a question to begin</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected Jeopardy Question Modal */}
      {currentRound?.round_number === 3 && selectedQuestion && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedQuestion(null)}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl"
          >
            <Card variant="neon" className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{selectedQuestion.category}</CardTitle>
                  <span className="text-2xl font-display font-bold text-primary">
                    {selectedQuestion.reward_points || selectedQuestion.points} pts
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="font-mono text-lg text-foreground">
                    {selectedQuestion.question_text}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground">
                    YOUR ANSWER
                  </label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Be the first to answer correctly!"
                    className="w-full h-24 p-3 rounded-lg border-2 border-border bg-input font-mono text-sm focus:border-primary focus:outline-none transition-all"
                    autoFocus
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedQuestion(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="neon"
                    className="flex-1"
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};
