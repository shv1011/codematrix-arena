import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Award } from "lucide-react";

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

interface AudienceDisplayProps {
  teams: Team[];
  gameState: GameState | null;
  showAllTeams?: boolean;
}

interface TeamWithTrend extends Team {
  trend: 'up' | 'down' | 'same';
  previousRank: number;
  currentRank: number;
}

export const AudienceDisplay = ({ 
  teams, 
  gameState, 
  showAllTeams = false 
}: AudienceDisplayProps) => {
  const [teamsWithTrends, setTeamsWithTrends] = useState<TeamWithTrend[]>([]);
  const [previousTeams, setPreviousTeams] = useState<Team[]>([]);

  // Calculate trends when teams change
  useEffect(() => {
    const currentSorted = [...teams].sort((a, b) => b.total_score - a.total_score);
    const previousSorted = [...previousTeams].sort((a, b) => b.total_score - a.total_score);

    const teamsWithTrends: TeamWithTrend[] = currentSorted.map((team, currentIndex) => {
      const currentRank = currentIndex + 1;
      const previousIndex = previousSorted.findIndex(t => t.id === team.id);
      const previousRank = previousIndex === -1 ? currentRank : previousIndex + 1;
      
      let trend: 'up' | 'down' | 'same' = 'same';
      if (previousRank > currentRank) trend = 'up';
      else if (previousRank < currentRank) trend = 'down';

      return {
        ...team,
        trend,
        previousRank,
        currentRank
      };
    });

    setTeamsWithTrends(teamsWithTrends);
    setPreviousTeams(teams);
  }, [teams]);

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Award className="w-6 h-6 text-amber-600" />;
      default: return null;
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'same') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'down': return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'same': return <Minus className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1: return "bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border-yellow-500/30";
      case 2: return "bg-gradient-to-r from-gray-400/10 to-gray-500/10 border-gray-400/30";
      case 3: return "bg-gradient-to-r from-amber-600/10 to-amber-700/10 border-amber-600/30";
      default: return "bg-card/50 border-border/30";
    }
  };

  const displayTeams = showAllTeams ? teamsWithTrends : teamsWithTrends.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-4 mb-4"
        >
          <Trophy className="w-8 h-8 text-primary" />
          <h2 className="text-3xl font-display font-bold">Live Leaderboard</h2>
          <Trophy className="w-8 h-8 text-primary" />
        </motion.div>
        
        {gameState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lg text-muted-foreground font-mono"
          >
            Round {gameState.current_round} • {teams.length} Teams Competing
          </motion.div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {displayTeams.map((team) => (
            <motion.div
              key={team.id}
              layout
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              className={`
                relative p-4 rounded-xl border backdrop-blur-sm
                ${getRankColor(team.currentRank)}
                ${team.currentRank <= 3 ? 'shadow-lg' : 'shadow-md'}
                hover:shadow-xl transition-all duration-300
              `}
            >
              {/* Rank Badge */}
              <div className="absolute -left-2 -top-2 flex items-center justify-center w-8 h-8 bg-background rounded-full border-2 border-current">
                <span className="text-sm font-bold">{team.currentRank}</span>
              </div>

              <div className="flex items-center justify-between ml-4">
                {/* Team Info */}
                <div className="flex items-center gap-3">
                  {getRankIcon(team.currentRank)}
                  <div>
                    <h3 className={`font-bold ${
                      team.currentRank === 1 ? 'text-xl' : 
                      team.currentRank <= 3 ? 'text-lg' : 'text-base'
                    }`}>
                      {team.team_name}
                    </h3>
                    <div className="flex gap-3 text-xs text-muted-foreground font-mono">
                      <span>R1: {team.round1_score}</span>
                      <span>R2: {team.round2_score}</span>
                      <span>R3: {team.round3_score}</span>
                    </div>
                  </div>
                </div>

                {/* Score and Trend */}
                <div className="flex items-center gap-3">
                  {getTrendIcon(team.trend)}
                  <div className="text-right">
                    <motion.div
                      key={team.total_score}
                      initial={{ scale: 1.1, color: "#10b981" }}
                      animate={{ scale: 1, color: "currentColor" }}
                      className={`font-mono font-bold ${
                        team.currentRank === 1 ? 'text-2xl' : 
                        team.currentRank <= 3 ? 'text-xl' : 'text-lg'
                      }`}
                    >
                      {team.total_score.toLocaleString()}
                    </motion.div>
                    <div className="text-xs text-muted-foreground font-mono">
                      points
                    </div>
                  </div>
                </div>
              </div>

              {/* Winner Highlight */}
              {team.currentRank === 1 && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-yellow-500/5 to-yellow-600/5 animate-pulse pointer-events-none" />
              )}

              {/* Trend Animation */}
              {team.trend !== 'same' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className={`absolute -right-1 -top-1 w-3 h-3 rounded-full ${
                    team.trend === 'up' ? 'bg-green-500' : 'bg-red-500'
                  } animate-pulse`}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Show More Indicator */}
      {!showAllTeams && teams.length > 8 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-muted-foreground font-mono"
        >
          ... and {teams.length - 8} more teams
        </motion.div>
      )}

      {/* Competition Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8"
      >
        <div className="bg-card/30 rounded-lg p-3 text-center border border-border/30">
          <div className="text-2xl font-bold text-primary">
            {teams.length}
          </div>
          <div className="text-sm text-muted-foreground">Total Teams</div>
        </div>
        
        <div className="bg-card/30 rounded-lg p-3 text-center border border-border/30">
          <div className="text-2xl font-bold text-accent">
            {teams.filter(t => t.total_score > 0).length}
          </div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        
        <div className="bg-card/30 rounded-lg p-3 text-center border border-border/30">
          <div className="text-2xl font-bold text-yellow-500">
            {Math.max(...teams.map(t => t.total_score), 0)}
          </div>
          <div className="text-sm text-muted-foreground">Top Score</div>
        </div>
        
        <div className="bg-card/30 rounded-lg p-3 text-center border border-border/30">
          <div className="text-2xl font-bold text-blue-500">
            {Math.round(teams.reduce((sum, t) => sum + t.total_score, 0) / teams.length) || 0}
          </div>
          <div className="text-sm text-muted-foreground">Average</div>
        </div>
      </motion.div>
    </div>
  );
};