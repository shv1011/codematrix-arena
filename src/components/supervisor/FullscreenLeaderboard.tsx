import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Medal, Award, Star, Zap, X } from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  total_score: number;
  round1_score: number;
  round2_score: number;
  round3_score: number;
}

interface GameState {
  current_round: number;
  is_competition_active: boolean;
  competition_status: string;
}

interface FullscreenLeaderboardProps {
  teams: Team[];
  gameState: GameState | null;
  onExitFullscreen: () => void;
  lastScoreUpdate?: string | null;
}

export const FullscreenLeaderboard = ({ 
  teams, 
  gameState, 
  onExitFullscreen,
  lastScoreUpdate 
}: FullscreenLeaderboardProps) => {
  const [animatedScores, setAnimatedScores] = useState<Record<string, number>>({});
  const [showWinnerAnimation, setShowWinnerAnimation] = useState(false);

  // Initialize animated scores
  useEffect(() => {
    const scores: Record<string, number> = {};
    teams.forEach(team => {
      scores[team.id] = team.total_score;
    });
    setAnimatedScores(scores);
  }, [teams]);

  // Animate score changes
  useEffect(() => {
    teams.forEach(team => {
      if (animatedScores[team.id] !== team.total_score) {
        // Animate score change
        const startScore = animatedScores[team.id] || 0;
        const endScore = team.total_score;
        const duration = 1000; // 1 second
        const steps = 30;
        const increment = (endScore - startScore) / steps;
        
        let currentStep = 0;
        const interval = setInterval(() => {
          currentStep++;
          const currentScore = startScore + (increment * currentStep);
          
          setAnimatedScores(prev => ({
            ...prev,
            [team.id]: Math.round(currentScore)
          }));
          
          if (currentStep >= steps) {
            clearInterval(interval);
            setAnimatedScores(prev => ({
              ...prev,
              [team.id]: endScore
            }));
          }
        }, duration / steps);
      }
    });
  }, [teams, animatedScores]);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-8 h-8 md:w-12 md:h-12 text-yellow-500" />;
      case 2: return <Medal className="w-8 h-8 md:w-12 md:h-12 text-gray-400" />;
      case 3: return <Award className="w-8 h-8 md:w-12 md:h-12 text-amber-600" />;
      default: return <Star className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />;
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1: return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30";
      case 2: return "from-gray-400/20 to-gray-500/20 border-gray-400/30";
      case 3: return "from-amber-600/20 to-amber-700/20 border-amber-600/30";
      default: return "from-muted/10 to-muted/20 border-muted/20";
    }
  };

  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return "Aptitude Arena";
      case 2: return "Constraint Paradox";
      case 3: return "Code Jeopardy";
      default: return "Competition";
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Exit Button */}
      <button
        onClick={onExitFullscreen}
        className="absolute top-6 right-6 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-8 relative z-10"
      >
        <div className="flex items-center justify-center gap-6 mb-4">
          <Trophy className="w-16 h-16 md:w-20 md:h-20 text-primary animate-pulse" />
          <div>
            <h1 className="text-6xl md:text-8xl font-display font-bold">
              CODE<span className="text-primary">WARS</span>
            </h1>
            <p className="text-2xl md:text-3xl font-mono text-muted-foreground">
              Live Leaderboard
            </p>
          </div>
          <Trophy className="w-16 h-16 md:w-20 md:h-20 text-primary animate-pulse" />
        </div>
        
        {gameState && (
          <div className="flex items-center justify-center gap-8 text-xl md:text-2xl font-mono">
            <div className={`px-6 py-3 rounded-full border ${
              gameState.is_competition_active 
                ? "bg-accent/20 text-accent border-accent/30" 
                : "bg-muted/20 text-muted-foreground border-muted/30"
            }`}>
              {gameState.is_competition_active ? "🔴 LIVE" : "⏸️ PAUSED"}
            </div>
            <div className="px-6 py-3 rounded-full bg-primary/20 text-primary border border-primary/30">
              Round {gameState.current_round}: {getRoundName(gameState.current_round)}
            </div>
          </div>
        )}
      </motion.div>

      {/* Score Update Notification */}
      <AnimatePresence>
        {lastScoreUpdate && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute top-32 left-1/2 transform -translate-x-1/2 z-40"
          >
            <div className="bg-accent/90 text-accent-foreground px-8 py-4 rounded-2xl shadow-2xl border border-accent/30">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 animate-pulse" />
                <span className="text-xl font-mono font-bold">{lastScoreUpdate}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard */}
      <div className="flex-1 px-8 pb-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="popLayout">
            {teams.slice(0, 10).map((team, index) => {
              const position = index + 1;
              const animatedScore = animatedScores[team.id] || team.total_score;
              
              return (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, x: -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 100, 
                    damping: 20,
                    delay: index * 0.1 
                  }}
                  className={`mb-4 ${position <= 3 ? 'mb-6' : ''}`}
                >
                  <div className={`
                    relative p-6 rounded-2xl border-2 bg-gradient-to-r backdrop-blur-sm
                    ${getRankColor(position)}
                    ${position === 1 ? 'scale-105 shadow-2xl shadow-yellow-500/20' : ''}
                    ${position <= 3 ? 'shadow-xl' : 'shadow-lg'}
                    transition-all duration-300 hover:scale-102
                  `}>
                    {/* Rank Badge */}
                    <div className="absolute -left-3 -top-3 flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-background rounded-full border-4 border-current">
                      <span className="text-2xl md:text-3xl font-bold">
                        {position}
                      </span>
                    </div>

                    <div className="flex items-center justify-between ml-6 md:ml-8">
                      {/* Team Info */}
                      <div className="flex items-center gap-4 md:gap-6">
                        {getRankIcon(position)}
                        <div>
                          <h3 className={`font-bold ${
                            position === 1 ? 'text-3xl md:text-4xl' : 
                            position <= 3 ? 'text-2xl md:text-3xl' : 
                            'text-xl md:text-2xl'
                          }`}>
                            {team.team_name}
                          </h3>
                          <div className="flex gap-4 text-sm md:text-base text-muted-foreground font-mono">
                            <span>R1: {team.round1_score}</span>
                            <span>R2: {team.round2_score}</span>
                            <span>R3: {team.round3_score}</span>
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <motion.div
                          key={animatedScore}
                          initial={{ scale: 1.2, color: "#10b981" }}
                          animate={{ scale: 1, color: "currentColor" }}
                          className={`font-mono font-bold ${
                            position === 1 ? 'text-4xl md:text-5xl' : 
                            position <= 3 ? 'text-3xl md:text-4xl' : 
                            'text-2xl md:text-3xl'
                          }`}
                        >
                          {animatedScore.toLocaleString()}
                        </motion.div>
                        <div className="text-sm md:text-base text-muted-foreground font-mono">
                          points
                        </div>
                      </div>
                    </div>

                    {/* Winner Glow Effect */}
                    {position === 1 && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 animate-pulse pointer-events-none" />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Show more teams indicator */}
          {teams.length > 10 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-8 text-xl text-muted-foreground font-mono"
            >
              ... and {teams.length - 10} more teams
            </motion.div>
          )}
        </div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pb-6 text-lg md:text-xl text-muted-foreground font-mono relative z-10"
      >
        <div className="flex items-center justify-center gap-8">
          <span>Total Teams: {teams.length}</span>
          <span>•</span>
          <span>{new Date().toLocaleTimeString()}</span>
          <span>•</span>
          <span>CodeWars 2.0</span>
        </div>
      </motion.div>
    </div>
  );
};