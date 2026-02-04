import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JeopardyGrid } from "@/components/jeopardy/JeopardyGrid";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthContext";
import { QuestionLoader, Round1Question, Round2Question, JeopardyQuestion } from "@/lib/questionLoader";
import { SimpleEvaluator } from "@/lib/simpleEvaluator";
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
  id: string | number;
  question_text: string;
  question_type: string;
  options?: string[];
  constraints?: string[];
  category?: string;
  points: number;
  reward_points?: number;
  difficulty?: string;
  sample_input?: string;
  sample_output?: string;
  correct_answer?: number;
  test_cases?: Array<{
    input: string;
    expected_output: string;
  }>;
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
  const [jeopardyGrid, setJeopardyGrid] = useState<Array<Array<JeopardyQuestion & { category: string }>>>([]);
  const [jeopardyAnswered, setJeopardyAnswered] = useState<Map<string, string>>(new Map()); // questionId -> teamName
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptedQuestions, setAttemptedQuestions] = useState<Map<string | number, { isCorrect: boolean, points: number }>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetchInitialData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('user-updates')
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'game_state' }, () => fetchGameState())
      .on('postgres_changes' as const, { event: '*', schema: 'public', table: 'teams' }, () => fetchTeam())
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Load questions when round changes
  useEffect(() => {
    if (currentRound && gameState?.is_competition_active) {
      loadQuestionsForRound(currentRound.round_number);
    }
  }, [currentRound, gameState?.is_competition_active, team?.id]);

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
      console.log("Team loaded:", data);
    } else {
      console.error("Error fetching team:", error);
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
      }
    }
  };

  const loadQuestionsForRound = async (roundNumber: number) => {
    try {
      console.log(`Loading questions for round ${roundNumber}`);
      
      if (roundNumber === 1) {
        const data = await QuestionLoader.loadRound1Questions({
          shuffle: true,
          teamId: team?.id,
          shuffleOptions: true,
          selectCount: 10 // Show 10 questions for Round 1
        });
        
        const formattedQuestions: Question[] = data.questions.map(q => ({
          id: q.id,
          question_text: q.question,
          question_type: 'mcq',
          options: q.options,
          category: q.category,
          points: q.points,
          difficulty: q.difficulty,
          correct_answer: q.correct_answer
        }));
        
        setQuestions(formattedQuestions);
        console.log(`Loaded ${formattedQuestions.length} Round 1 questions`);
        
      } else if (roundNumber === 2) {
        const data = await QuestionLoader.loadRound2Questions({
          shuffle: true,
          teamId: team?.id
        });
        
        const formattedQuestions: Question[] = data.questions.map(q => ({
          id: q.id,
          question_text: q.question,
          question_type: 'constraint',
          constraints: q.constraints,
          category: q.category,
          points: q.points,
          difficulty: q.difficulty,
          sample_input: q.sample_input,
          sample_output: q.sample_output,
          test_cases: q.test_cases
        }));
        
        setQuestions(formattedQuestions);
        console.log(`Loaded ${formattedQuestions.length} Round 2 questions`);
        
      } else if (roundNumber === 3) {
        const data = await QuestionLoader.loadRound3Questions();
        const grid = QuestionLoader.convertRound3ToGrid(data);
        setJeopardyGrid(grid);
        console.log(`Loaded Round 3 Jeopardy grid`);
      }
      
    } catch (error) {
      console.error(`Error loading Round ${roundNumber} questions:`, error);
      toast.error(`Failed to load questions for Round ${roundNumber}`);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestion || !team || !answer.trim()) return;

    if (!currentRound?.id) {
      toast.error("No active round found. Please wait for the admin to start a round.");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Evaluating answer:", {
        question: selectedQuestion.question_text,
        answer: answer.trim(),
        correct_answer: selectedQuestion.correct_answer
      });

      // Evaluate answer using appropriate method based on question type
      let evaluationResult;

      if (selectedQuestion.options && selectedQuestion.correct_answer !== undefined) {
        // MCQ evaluation (Round 1)
        evaluationResult = SimpleEvaluator.evaluateMCQ(
          answer.trim(),
          selectedQuestion.correct_answer,
          selectedQuestion.options,
          selectedQuestion.points
        );
      } else if (selectedQuestion.question_type === 'constraint' || selectedQuestion.question_type === 'jeopardy') {
        // Code evaluation (Round 2 & 3)
        const testCases = selectedQuestion.test_cases || 
          (selectedQuestion.sample_input && selectedQuestion.sample_output ? 
            [{ input: selectedQuestion.sample_input, expected_output: selectedQuestion.sample_output }] : 
            []);
        
        evaluationResult = SimpleEvaluator.evaluateCode(
          answer.trim(),
          testCases,
          selectedQuestion.reward_points || selectedQuestion.points
        );
      } else {
        // Math evaluation (simple questions)
        evaluationResult = SimpleEvaluator.evaluateMath(
          answer.trim(),
          selectedQuestion.question_text,
          selectedQuestion.points
        );
      }

      console.log("Answer evaluation:", evaluationResult);

      if (evaluationResult.isCorrect && evaluationResult.points > 0) {
        // Update team score directly in database
        const currentRoundField = `round${gameState?.current_round || 1}_score`;
        const { error: updateError } = await supabase
          .from("teams")
          .update({
            [currentRoundField]: team[currentRoundField] + evaluationResult.points,
            total_score: team.total_score + evaluationResult.points
          })
          .eq("id", team.id);

        if (updateError) {
          console.error("Score update error:", updateError);
          toast.error("Failed to update score");
        } else {
          toast.success(`Correct! +${evaluationResult.points} points`);
          // Track this question as correctly answered
          setAttemptedQuestions(prev => new Map(prev.set(selectedQuestion.id, { 
            isCorrect: true, 
            points: evaluationResult.points 
          })));
          // Update local team state
          setTeam(prev => prev ? {
            ...prev,
            [currentRoundField]: prev[currentRoundField] + evaluationResult.points,
            total_score: prev.total_score + evaluationResult.points
          } : null);
        }
      } else {
        toast.error(evaluationResult.feedback || "Incorrect answer. Try again!");
        // Track this question as incorrectly answered
        setAttemptedQuestions(prev => new Map(prev.set(selectedQuestion.id, { 
          isCorrect: false, 
          points: 0 
        })));
      }

      setAnswer("");
      setSelectedQuestion(null);

    } catch (err) {
      console.error("Answer evaluation error:", err);
      toast.error("An error occurred while checking your answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectJeopardyQuestion = (gridQuestion: any) => {
    const question: Question = {
      id: `${gridQuestion.jeopardy_row}-${gridQuestion.jeopardy_col}`,
      question_text: gridQuestion.question,
      question_type: 'jeopardy',
      category: gridQuestion.category,
      points: gridQuestion.points,
      reward_points: gridQuestion.reward,
      difficulty: gridQuestion.difficulty,
      sample_input: gridQuestion.sample_input,
      sample_output: gridQuestion.sample_output
    };
    setSelectedQuestion(question);
  };

  const handleJeopardySubmit = async () => {
    if (!selectedQuestion || !team || !answer.trim()) return;

    setIsSubmitting(true);

    try {
      // Evaluate Jeopardy answer (code evaluation for Round 3)
      const testCases = selectedQuestion.test_cases || 
        (selectedQuestion.sample_input && selectedQuestion.sample_output ? 
          [{ input: selectedQuestion.sample_input, expected_output: selectedQuestion.sample_output }] : 
          []);
      
      const evaluationResult = SimpleEvaluator.evaluateCode(
        answer.trim(),
        testCases,
        selectedQuestion.reward_points || selectedQuestion.points
      );

      console.log("Jeopardy evaluation:", evaluationResult);

      if (evaluationResult.isCorrect && evaluationResult.points > 0) {
        // Update team score
        const { error: updateError } = await supabase
          .from("teams")
          .update({
            round3_score: team.round3_score + evaluationResult.points,
            total_score: team.total_score + evaluationResult.points
          })
          .eq("id", team.id);

        if (updateError) {
          console.error("Score update error:", updateError);
          toast.error("Failed to update score");
        } else {
          toast.success(`Correct! +${evaluationResult.points} points`);
          
          // Mark this question as answered by this team
          setJeopardyAnswered(prev => new Map(prev.set(selectedQuestion.id.toString(), team.team_name)));
          
          // Update local team state
          setTeam(prev => prev ? {
            ...prev,
            round3_score: prev.round3_score + evaluationResult.points,
            total_score: prev.total_score + evaluationResult.points
          } : null);
        }
      } else {
        toast.error(evaluationResult.feedback || "Incorrect answer. Try again!");
      }

      setAnswer("");
      setSelectedQuestion(null);

    } catch (err) {
      console.error("Jeopardy answer evaluation error:", err);
      toast.error("An error occurred while checking your answer");
    } finally {
      setIsSubmitting(false);
    }
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
            questions={jeopardyGrid.flat().map(q => ({
              id: `${q.jeopardy_row}-${q.jeopardy_col}`,
              category: q.category,
              points: q.points,
              reward_points: q.reward,
              is_locked: false, // TODO: Implement locking logic
              answered_by: jeopardyAnswered.get(`${q.jeopardy_row}-${q.jeopardy_col}`) || null,
              jeopardy_row: q.jeopardy_row || 0,
              jeopardy_col: q.jeopardy_col || 0,
            }))}
            onSelectQuestion={handleSelectJeopardyQuestion}
            gridData={jeopardyGrid}
          />
          
          {/* Jeopardy Answer Input */}
          {selectedQuestion && (
            <Card variant="neon">
              <CardHeader>
                <CardTitle>Answer Question</CardTitle>
                <CardDescription>
                  {selectedQuestion.category} - {selectedQuestion.points} points
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-mono text-sm">{selectedQuestion.question_text}</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-mono text-muted-foreground">
                    YOUR ANSWER
                  </label>
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Enter your answer..."
                    className="font-mono"
                  />
                </div>
                
                <Button
                  variant="neon"
                  size="lg"
                  className="w-full"
                  onClick={handleJeopardySubmit}
                  disabled={!answer.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Answer
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
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
              {questions.map((q, index) => {
                const attemptResult = attemptedQuestions.get(q.id);
                const borderColor = attemptResult 
                  ? attemptResult.isCorrect 
                    ? "border-green-500 bg-green-500/10" 
                    : "border-red-500 bg-red-500/10"
                  : selectedQuestion?.id === q.id
                    ? "border-primary bg-primary/20 shadow-lg shadow-primary/25 ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50 hover:bg-primary/5";
                
                return (
                  <motion.button
                    key={q.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedQuestion(q)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${borderColor}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">Q{index + 1}</span>
                        {selectedQuestion?.id === q.id && (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        )}
                        {attemptResult && (
                          attemptResult.isCorrect ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{q.difficulty}</span>
                        <span className="text-sm text-primary font-mono">{q.points} pts</span>
                        {attemptResult && attemptResult.isCorrect && (
                          <span className="text-xs text-green-500 font-mono">+{attemptResult.points}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {q.category}
                    </p>
                  </motion.button>
                );
              })}
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
                    {selectedQuestion.constraints && selectedQuestion.constraints.length > 0 && (
                      <div className="mt-4 p-3 rounded bg-warning/10 border border-warning/30">
                        <p className="text-sm font-mono text-warning">
                          <AlertCircle className="w-4 h-4 inline mr-2" />
                          Constraints:
                        </p>
                        <ul className="mt-2 space-y-1">
                          {selectedQuestion.constraints.map((constraint, idx) => (
                            <li key={idx} className="text-sm font-mono text-warning">
                              • {constraint}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedQuestion.sample_input && (
                      <div className="mt-4 p-3 rounded bg-info/10 border border-info/30">
                        <p className="text-sm font-mono text-info mb-2">Sample Input:</p>
                        <pre className="text-sm font-mono text-info whitespace-pre-wrap">
                          {selectedQuestion.sample_input}
                        </pre>
                      </div>
                    )}
                    {selectedQuestion.sample_output && (
                      <div className="mt-4 p-3 rounded bg-success/10 border border-success/30">
                        <p className="text-sm font-mono text-success mb-2">Sample Output:</p>
                        <pre className="text-sm font-mono text-success whitespace-pre-wrap">
                          {selectedQuestion.sample_output}
                        </pre>
                      </div>
                    )}
                  </div>

                  {selectedQuestion.options && selectedQuestion.options.length > 0 ? (
                    // MCQ Options
                    <div className="space-y-2">
                      {selectedQuestion.options.map((option, idx) => (
                        <Button
                          key={idx}
                          variant={answer === option ? "neon" : "outline"}
                          className={`w-full justify-start transition-all ${
                            answer === option 
                              ? "ring-2 ring-primary/50 shadow-lg shadow-primary/25" 
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => setAnswer(option)}
                        >
                          <span className="font-mono mr-3">
                            {String.fromCharCode(65 + idx)}.
                          </span>
                          {option}
                          {answer === option && (
                            <CheckCircle className="w-4 h-4 ml-auto text-primary" />
                          )}
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
                    onClick={gameState?.current_round === 3 ? handleJeopardySubmit : handleSubmitAnswer}
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
