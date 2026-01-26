import { motion } from "framer-motion";
import { Lock, Check, HelpCircle } from "lucide-react";
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
}

interface JeopardyGridProps {
  questions: JeopardyQuestion[];
  onSelectQuestion: (question: JeopardyQuestion) => void;
  isTeamTurn?: boolean;
  categories?: string[];
}

const DEFAULT_CATEGORIES = ["DSA", "OOPS", "DBMS", "OS", "WEB"];
const POINT_VALUES = [100, 200, 400, 700, 1000];

export const JeopardyGrid = ({ 
  questions, 
  onSelectQuestion, 
  isTeamTurn = true,
  categories = DEFAULT_CATEGORIES 
}: JeopardyGridProps) => {
  const getQuestionByPosition = (row: number, col: number) => {
    return questions.find(q => q.jeopardy_row === row && q.jeopardy_col === col);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Category Headers */}
      <div className="grid grid-cols-5 gap-2 mb-2">
        {categories.map((category, index) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-center p-3 md:p-4 glass-card border-primary/30"
          >
            <span className="font-display font-bold text-sm md:text-base text-primary tracking-wider">
              {category}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-2">
        {POINT_VALUES.map((points, colIndex) => (
          categories.map((_, rowIndex) => {
            const question = getQuestionByPosition(rowIndex, colIndex);
            const isLocked = question?.is_locked;
            const isAnswered = question?.answered_by;
            
            return (
              <motion.button
                key={`${rowIndex}-${colIndex}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (rowIndex * 5 + colIndex) * 0.03 }}
                whileHover={!isLocked && !isAnswered && isTeamTurn ? { scale: 1.05 } : {}}
                whileTap={!isLocked && !isAnswered && isTeamTurn ? { scale: 0.95 } : {}}
                onClick={() => {
                  if (question && !isLocked && !isAnswered && isTeamTurn) {
                    onSelectQuestion(question);
                  }
                }}
                disabled={!question || isLocked || !!isAnswered || !isTeamTurn}
                className={cn(
                  "jeopardy-cell aspect-square flex items-center justify-center relative",
                  isLocked && "locked",
                  isAnswered && "answered",
                  !isTeamTurn && "opacity-50 cursor-not-allowed"
                )}
              >
                {isAnswered ? (
                  <Check className="w-8 h-8 md:w-12 md:h-12 text-accent" />
                ) : isLocked ? (
                  <Lock className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
                ) : question ? (
                  <span className="font-display font-bold text-2xl md:text-4xl text-primary text-glow-primary">
                    {points}
                  </span>
                ) : (
                  <HelpCircle className="w-6 h-6 text-muted-foreground/50" />
                )}
                
                {/* Glow effect for available questions */}
                {!isLocked && !isAnswered && question && isTeamTurn && (
                  <div className="absolute inset-0 rounded-lg animate-pulse-border pointer-events-none" />
                )}
              </motion.button>
            );
          })
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 text-sm font-mono text-muted-foreground">
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
      </div>
    </div>
  );
};
