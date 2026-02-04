import { motion } from "framer-motion";
import { Lock, Check, HelpCircle, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface JeopardyQuestion {
  id: string;
  category: string;
  points: number;
  reward_points: number;
  is_locked: boolean;
  answered_by: string | null;
  jeopardy_row: number;
  jeopardy_col: number;
  difficulty?: string;
}

interface JeopardyGridProps {
  questions: JeopardyQuestion[];
  onSelectQuestion: (question: JeopardyQuestion) => void;
  isTeamTurn?: boolean;
  categories?: string[];
  currentTeam?: string;
  lockedQuestions?: Set<string>;
  gridData?: Array<Array<any>>; // Add grid data prop
}

// Dynamic categories and point values based on actual data
const DEFAULT_CATEGORIES = ["DSA", "OOPS", "DBMS", "OS", "WEB", "ALGO"];

export const JeopardyGrid = ({ 
  questions, 
  onSelectQuestion, 
  isTeamTurn = true,
  categories = DEFAULT_CATEGORIES,
  currentTeam,
  lockedQuestions = new Set(),
  gridData = []
}: JeopardyGridProps) => {
  // Extract actual categories and point values from grid data
  const actualCategories = gridData.length > 0 ? 
    gridData[0].map(q => q.category) : 
    categories;
  
  const actualPointValues = gridData.length > 0 ? 
    gridData.map(row => row[0]?.points || 0) : 
    [100, 200, 400, 700, 1000, 1500];

  const numCols = actualCategories.length;
  const numRows = actualPointValues.length;

  const getQuestionByPosition = (row: number, col: number) => {
    return questions.find(q => q.jeopardy_row === row && q.jeopardy_col === col);
  };

  const getRewardPoints = (question: any) => {
    return question?.reward || question?.points || 0;
  };

  return (
    <div className="w-full h-full flex flex-col max-w-7xl mx-auto">
      {/* Category Headers - Dynamic */}
      <div className={`grid gap-1 mb-2`} style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}>
        {actualCategories.map((category, index) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-1 glass-card border-primary/30 h-10 flex items-center justify-center"
          >
            <span className="font-display font-bold text-xs lg:text-sm text-primary tracking-wider">
              {category}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Grid - Dynamic columns x rows */}
      <div className={`grid gap-1 flex-1`} style={{ gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}>
        {actualPointValues.map((points, rowIndex) => (
          actualCategories.map((_, colIndex) => {
            const question = getQuestionByPosition(rowIndex, colIndex);
            const isLocked = question?.is_locked || lockedQuestions.has(question?.id || '');
            const isAnswered = question?.answered_by;
            const rewardPoints = getRewardPoints(question);
            
            return (
              <motion.button
                key={`${rowIndex}-${colIndex}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (rowIndex * numCols + colIndex) * 0.02 }}
                whileHover={!isLocked && !isAnswered && isTeamTurn ? { scale: 1.05 } : {}}
                whileTap={!isLocked && !isAnswered && isTeamTurn ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (question && !isLocked && !isAnswered && isTeamTurn) {
                    onSelectQuestion(question);
                  }
                }}
                disabled={!question || isLocked || !!isAnswered || !isTeamTurn}
                className={cn(
                  "jeopardy-cell flex flex-col items-center justify-center relative",
                  "h-16 min-h-[64px] text-xs", // Smaller boxes for 6x6 grid
                  isLocked && "locked",
                  isAnswered && "answered",
                  !isTeamTurn && "opacity-50 cursor-not-allowed",
                  // Difficulty-based styling
                  question?.difficulty === 'extreme' && "border-red-500/50 bg-red-500/5"
                )}
              >
                {isAnswered ? (
                  <div className="flex flex-col items-center">
                    <Check className="w-4 h-4 lg:w-5 lg:h-5 text-accent mb-1" />
                    <span className="text-xs text-accent font-mono text-center">
                      {question?.answered_by || "SOLVED"}
                    </span>
                  </div>
                ) : isLocked ? (
                  <div className="flex flex-col items-center">
                    <Lock className="w-3 h-3 lg:w-4 lg:h-4 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground font-mono">
                      LOCKED
                    </span>
                  </div>
                ) : question ? (
                  <div className="flex flex-col items-center">
                    <span className="font-display font-bold text-sm lg:text-lg text-primary text-glow-primary">
                      {points}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <Trophy className="w-2 h-2 lg:w-3 lg:h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-500 font-mono">
                        {rewardPoints}
                      </span>
                    </div>
                    {question.difficulty === 'extreme' && (
                      <div className="flex items-center gap-1 mt-1">
                        <Zap className="w-2 h-2 lg:w-3 lg:h-3 text-red-500" />
                        <span className="text-xs text-red-500 font-mono">
                          EXTREME
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <HelpCircle className="w-4 h-4 text-muted-foreground/50" />
                )}
                
                {/* Glow effect for available questions */}
                {!isLocked && !isAnswered && question && isTeamTurn && (
                  <div className="absolute inset-0 rounded-lg animate-pulse-border pointer-events-none" />
                )}
                
                {/* Current team indicator */}
                {currentTeam && !isLocked && !isAnswered && question && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 lg:w-3 lg:h-3 bg-primary rounded-full animate-pulse" />
                )}
              </motion.button>
            );
          })
        ))}
      </div>

      {/* Compact Stats Footer */}
      <div className="mt-2 text-center text-xs lg:text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <span>Total: {questions.length}</span>
          <span>Answered: {questions.filter(q => q.answered_by).length}</span>
          <span>Locked: {questions.filter(q => q.is_locked || lockedQuestions.has(q.id)).length}</span>
          <span>Available: {questions.filter(q => !q.answered_by && !q.is_locked && !lockedQuestions.has(q.id)).length}</span>
        </div>
      </div>
    </div>
  );
};
