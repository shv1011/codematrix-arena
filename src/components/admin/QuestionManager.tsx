import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { QuestionLoader, Round1Question, Round2Question, JeopardyQuestion } from "@/lib/questionLoader";
import { toast } from "sonner";
import { 
  FileText, 
  Upload, 
  Download, 
  RefreshCw, 
  Eye, 
  Edit, 
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  Shuffle,
  Play
} from "lucide-react";

interface LoadedQuestion {
  id: string;
  round_id: string;
  question_text: string;
  question_type: string;
  options?: any;
  correct_answer?: string;
  points: number;
  category?: string;
  difficulty?: string;
  created_at: string;
}

export const QuestionManager = () => {
  const [loadedQuestions, setLoadedQuestions] = useState<LoadedQuestion[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<any>(null);
  const [questionStats, setQuestionStats] = useState<any>({});

  // Fetch rounds and questions
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [roundsResponse, questionsResponse] = await Promise.all([
        supabase.from("rounds").select("*").order("round_number"),
        supabase.from("questions").select("*").order("created_at", { ascending: false })
      ]);

      if (roundsResponse.error) throw roundsResponse.error;
      if (questionsResponse.error) throw questionsResponse.error;

      setRounds(roundsResponse.data || []);
      setLoadedQuestions(questionsResponse.data || []);

      // Calculate stats
      const stats = (questionsResponse.data || []).reduce((acc: any, q: any) => {
        const roundId = q.round_id;
        if (!acc[roundId]) acc[roundId] = 0;
        acc[roundId]++;
        return acc;
      }, {});
      setQuestionStats(stats);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Load questions from JSON files into database
  const loadQuestionsFromJSON = async (roundNumber: number) => {
    setIsLoading(true);
    try {
      const roundData = rounds.find(r => r.round_number === roundNumber);
      if (!roundData) {
        throw new Error(`Round ${roundNumber} not found`);
      }

      let questions: any[] = [];

      if (roundNumber === 1) {
        const data = await QuestionLoader.loadRound1Questions();
        questions = data.questions.map((q: Round1Question) => ({
          round_id: roundData.id,
          question_text: q.question,
          question_type: 'mcq',
          options: q.options,
          correct_answer: q.options[q.correct_answer],
          points: q.points,
          category: q.category,
          difficulty: q.difficulty
        }));
      } else if (roundNumber === 2) {
        const data = await QuestionLoader.loadRound2Questions();
        questions = data.questions.map((q: Round2Question) => ({
          round_id: roundData.id,
          question_text: q.question,
          question_type: 'code',
          constraints: q.constraints.join('\n'),
          correct_answer: q.sample_output,
          points: q.points,
          category: q.category,
          difficulty: q.difficulty,
          options: {
            sample_input: q.sample_input,
            sample_output: q.sample_output,
            test_cases: q.test_cases,
            evaluation_criteria: q.evaluation_criteria
          }
        }));
      } else if (roundNumber === 3) {
        const data = await QuestionLoader.loadRound3Questions();
        questions = [];
        
        Object.entries(data.categories).forEach(([categoryKey, categoryData]: [string, any]) => {
          categoryData.questions.forEach((q: JeopardyQuestion, index: number) => {
            questions.push({
              round_id: roundData.id,
              question_text: q.question,
              question_type: 'jeopardy',
              points: q.points,
              reward_points: q.reward,
              category: categoryKey,
              difficulty: q.difficulty,
              jeopardy_row: Math.floor(index / 7),
              jeopardy_col: index % 7,
              options: {
                sample_input: q.sample_input,
                sample_output: q.sample_output,
                test_cases: q.test_cases
              }
            });
          });
        });
      }

      // Clear existing questions for this round
      const { error: deleteError } = await supabase
        .from("questions")
        .delete()
        .eq("round_id", roundData.id);

      if (deleteError) throw deleteError;

      // Insert new questions
      const { error: insertError } = await supabase
        .from("questions")
        .insert(questions);

      if (insertError) throw insertError;

      toast.success(`Loaded ${questions.length} questions for Round ${roundNumber}`);
      fetchData(); // Refresh data

    } catch (error) {
      console.error("Error loading questions:", error);
      toast.error(`Failed to load questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Preview question
  const handlePreviewQuestion = (question: LoadedQuestion) => {
    setPreviewQuestion(question);
    setIsPreviewOpen(true);
  };

  // Delete question
  const deleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;
      toast.success("Question deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Failed to delete question");
    }
  };

  // Randomize question order
  const randomizeQuestions = async (roundNumber: number) => {
    try {
      const roundData = rounds.find(r => r.round_number === roundNumber);
      if (!roundData) return;

      const roundQuestions = loadedQuestions.filter(q => q.round_id === roundData.id);
      const shuffled = [...roundQuestions].sort(() => Math.random() - 0.5);

      // Update questions with new order (using created_at as a simple ordering mechanism)
      for (let i = 0; i < shuffled.length; i++) {
        const newTimestamp = new Date(Date.now() + i * 1000).toISOString();
        await supabase
          .from("questions")
          .update({ created_at: newTimestamp })
          .eq("id", shuffled[i].id);
      }

      toast.success(`Randomized ${shuffled.length} questions for Round ${roundNumber}`);
      fetchData();
    } catch (error) {
      console.error("Error randomizing questions:", error);
      toast.error("Failed to randomize questions");
    }
  };

  // Get questions for selected round
  const getQuestionsForRound = (roundNumber: number) => {
    const roundData = rounds.find(r => r.round_number === roundNumber);
    if (!roundData) return [];
    return loadedQuestions.filter(q => q.round_id === roundData.id);
  };

  const selectedRoundQuestions = getQuestionsForRound(selectedRound);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            QUESTION MANAGER
          </h2>
          <p className="text-muted-foreground font-mono mt-1">
            Load and manage questions for all competition rounds
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedRound.toString()} onValueChange={(value) => setSelectedRound(parseInt(value))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Round 1 - Quiz</SelectItem>
              <SelectItem value="2">Round 2 - Constraint</SelectItem>
              <SelectItem value="3">Round 3 - Jeopardy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {rounds.map((round) => {
          const questionCount = questionStats[round.id] || 0;
          return (
            <Card key={round.id} variant="glass" className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{round.round_name}</p>
                  <p className="text-2xl font-bold text-primary">{questionCount}</p>
                  <p className="text-xs text-muted-foreground">questions</p>
                </div>
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
            </Card>
          );
        })}
        <Card variant="glass" className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Questions</p>
              <p className="text-2xl font-bold text-primary">{loadedQuestions.length}</p>
              <p className="text-xs text-muted-foreground">all rounds</p>
            </div>
            <CheckCircle className="w-8 h-8 text-primary/50" />
          </div>
        </Card>
      </div>

      {/* Question Loading Controls */}
      <Card variant="neon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            LOAD QUESTIONS FROM JSON
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => loadQuestionsFromJSON(1)}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Load Round 1 (Quiz)
            </Button>
            <Button
              onClick={() => loadQuestionsFromJSON(2)}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Load Round 2 (Constraint)
            </Button>
            <Button
              onClick={() => loadQuestionsFromJSON(3)}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Load Round 3 (Jeopardy)
            </Button>
            <Button
              onClick={() => randomizeQuestions(selectedRound)}
              disabled={isLoading || selectedRoundQuestions.length === 0}
              variant="secondary"
            >
              <Shuffle className="w-4 h-4" />
              Randomize Round {selectedRound}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Round {selectedRound} Questions ({selectedRoundQuestions.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {selectedRoundQuestions.map((question, index) => (
              <motion.div
                key={question.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-muted-foreground">#{index + 1}</span>
                    <Badge variant="outline">{question.question_type}</Badge>
                    {question.category && (
                      <Badge variant="secondary">{question.category}</Badge>
                    )}
                    {question.difficulty && (
                      <Badge variant={
                        question.difficulty === 'easy' ? 'success' :
                        question.difficulty === 'medium' ? 'warning' :
                        'destructive'
                      }>
                        {question.difficulty}
                      </Badge>
                    )}
                    <Badge variant="outline">{question.points} pts</Badge>
                  </div>
                  <p className="text-sm line-clamp-2">{question.question_text}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewQuestion(question)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteQuestion(question.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}

            {selectedRoundQuestions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questions loaded for Round {selectedRound}</p>
                <p className="text-sm mt-2">Use the "Load Questions" buttons above to import from JSON files</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Question Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{previewQuestion.question_type}</Badge>
                {previewQuestion.category && (
                  <Badge variant="secondary">{previewQuestion.category}</Badge>
                )}
                {previewQuestion.difficulty && (
                  <Badge variant="outline">{previewQuestion.difficulty}</Badge>
                )}
                <Badge variant="outline">{previewQuestion.points} pts</Badge>
              </div>
              
              <div>
                <Label className="text-base font-semibold">Question:</Label>
                <p className="mt-1 p-3 bg-muted rounded-lg">{previewQuestion.question_text}</p>
              </div>

              {previewQuestion.options && previewQuestion.question_type === 'mcq' && (
                <div>
                  <Label className="text-base font-semibold">Options:</Label>
                  <div className="mt-1 space-y-2">
                    {previewQuestion.options.map((option: string, index: number) => (
                      <div 
                        key={index} 
                        className={`p-2 rounded border ${
                          option === previewQuestion.correct_answer 
                            ? 'border-green-500 bg-green-500/10' 
                            : 'border-border'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}. {option}
                        {option === previewQuestion.correct_answer && (
                          <CheckCircle className="w-4 h-4 text-green-500 inline ml-2" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {previewQuestion.correct_answer && (
                <div>
                  <Label className="text-base font-semibold">Correct Answer:</Label>
                  <p className="mt-1 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-700">
                    {previewQuestion.correct_answer}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};