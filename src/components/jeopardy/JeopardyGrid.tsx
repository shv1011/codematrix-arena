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
}

// Updated for 7x5 grid format
const DEFAULT_CATEGORIES = ["DSA", "OOPS", "DBMS", "OS", "WEB", "ALGO", "ML"];
const POINT_VALUES = [100, 200, 400, 700, 1000];
const REWARD_MULTIPLIERS = [1.1, 1.25, 1.175, 1.43, 2.5]; // 110, 250, 470, 1000, 2500

export const JeopardyGrid = ({ 
  questions, 
  onSelectQuestion, 
  isTeamTurn = true,
  categories = DEFAULT_CATEGORIES,
  currentTeam,
  lockedQuestions = new Set()
}: JeopardyGridProps) => {
  const getQuestionByPosition = (row: number, col: number) => {
    return questions.find(q => q.jeopardy_row === row && q.jeopardy_col === col);
  };

  const getRewardPoints = (basePoints: number) => {
    const index = POINT_VALUES.indexOf(basePoints);
    return index !== -1 ? Math.floor(basePoints * REWARD_MULTIPLIERS[index]) : basePoints;
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Category Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {categories.map((category, index) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-3 md:p-4 glass-card border-primary/30 min-h-[60px] flex items-center justify-center"
          >
            <span className="font-display font-bold text-xs md:text-sm text-primary tracking-wider">
              {category}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Grid - 7 columns x 5 rows */}
      <div className="grid grid-cols-7 gap-2">
        {POINT_VALUES.map((points, rowIndex) => (
          categories.map((_, colIndex) => {
            const question = getQuestionByPosition(rowIndex, colIndex);
            const isLocked = question?.is_locked || lockedQuestions.has(question?.id || '');
            const isAnswered = question?.answered_by;
            const rewardPoints = getRewardPoints(points);
            
            return (
              <motion.button
                key={`${rowIndex}-${colIndex}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (rowIndex * 7 + colIndex) * 0.02 }}
                whileHover={!isLocked && !isAnswered && isTeamTurn ? { scale: 1.05 } : {}}
                whileTap={!isLocked && !isAnswered && isTeamTurn ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (question && !isLocked && !isAnswered && isTeamTurn) {
                    onSelectQuestion(question);
                  }
                }}
                disabled={!question || isLocked || !!isAnswered || !isTeamTurn}
                className={cn(
                  "jeopardy-cell aspect-square flex flex-col items-center justify-center relative",
                  "min-h-[80px] md:min-h-[100px]",
                  isLocked && "locked",
                  isAnswered && "answered",
                  !isTeamTurn && "opacity-50 cursor-not-allowed",
                  // Difficulty-based styling
                  question?.difficulty === 'extreme' && "border-red-500/50 bg-red-500/5"
                )}
              >
                {isAnswered ? (
                  <div className="flex flex-col items-center">
                    <Check className="w-6 h-6 md:w-8 md:h-8 text-accent mb-1" />
                    <span className="text-xs text-accent font-mono">
                      {question?.answered_by}
                    </span>
                  </div>
                ) : isLocked ? (
                  <div className="flex flex-col items-center">
                    <Lock className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground font-mono">
                      LOCKED
                    </span>
                  </div>
                ) : question ? (
                  <div className="flex flex-col items-center">
                    <span className="font-display font-bold text-lg md:text-2xl text-primary text-glow-primary">
                      {points}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <Trophy className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs text-yellow-500 font-mono">
                        {rewardPoints}
                      </span>
                    </div>
                    {question.difficulty === 'extreme' && (
                      <div className="flex items-center gap-1 mt-1">
                        <Zap className="w-3 h-3 text-red-500" />
                        <span className="text-xs text-red-500 font-mono">
                          EXTREME
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <HelpCircle className="w-6 h-6 text-muted-foreground/50" />
                )}
                
                {/* Glow effect for available questions */}
                {!isLocked && !isAnswered && question && isTeamTurn && (
                  <div className="absolute inset-0 rounded-lg animate-pulse-border pointer-events-none" />
                )}
                
                {/* Current team indicator */}
                {currentTeam && !isLocked && !isAnswered && question && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse" />
                )}
              </motion.button>
            );
          })
        ))}
      </div>

      {/* Enhanced Legend */}
      <div className="flex items-center justify-center gap-4 mt-6 text-sm font-mono text-muted-foreground flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-primary/30 bg-card" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          <span>Locked</span>
        </div>
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-accent" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span>Reward Points</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-red-500" />
          <span>Extreme Difficulty</span>
        </div>
      </div>

      {/* Grid Statistics */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-6">
          <span>Total Questions: {questions.length}</span>
          <span>Answered: {questions.filter(q => q.answered_by).length}</span>
          <span>Locked: {questions.filter(q => q.is_locked || lockedQuestions.has(q.id)).length}</span>
          <span>Available: {questions.filter(q => !q.answered_by && !q.is_locked && !lockedQuestions.has(q.id)).length}</span>
        </div>
      </div>
    </div>
  );
};
