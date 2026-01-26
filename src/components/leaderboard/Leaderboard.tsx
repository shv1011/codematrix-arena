import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp, Users } from "lucide-react";

interface TeamScore {
  id: string;
  team_name: string;
  total_score: number;
  round1_score: number;
  round2_score: number;
  round3_score: number;
  rank?: number;
}

interface LeaderboardProps {
  teams: TeamScore[];
  currentRound?: number;
  isFullscreen?: boolean;
}

export const Leaderboard = ({ teams, currentRound = 0, isFullscreen = false }: LeaderboardProps) => {
  const sortedTeams = [...teams].sort((a, b) => b.total_score - a.total_score);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center font-mono text-muted-foreground">{rank}</span>;
    }
  };

  const getRankClass = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-500/20 to-transparent border-l-4 border-yellow-400";
      case 2:
        return "bg-gradient-to-r from-gray-400/20 to-transparent border-l-4 border-gray-400";
      case 3:
        return "bg-gradient-to-r from-amber-600/20 to-transparent border-l-4 border-amber-600";
      default:
        return "border-l-4 border-transparent";
    }
  };

  return (
    <Card variant={isFullscreen ? "default" : "neon"} className={isFullscreen ? "h-full bg-background/95 border-none" : ""}>
      <CardHeader className={isFullscreen ? "pb-4" : ""}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            LIVE LEADERBOARD
          </CardTitle>
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <Users className="w-4 h-4" />
            {teams.length} Teams
          </div>
        </div>
        {currentRound > 0 && (
          <p className="text-sm text-muted-foreground font-mono">
            Round {currentRound} in progress
          </p>
        )}
      </CardHeader>
      <CardContent className={`${isFullscreen ? "px-0" : ""} scrollbar-cyber overflow-y-auto max-h-[500px]`}>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {sortedTeams.map((team, index) => {
              const rank = index + 1;
              return (
                <motion.div
                  key={team.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-lg leaderboard-row ${getRankClass(rank)} ${isFullscreen ? "mx-6" : ""}`}
                >
                  <div className="flex-shrink-0">
                    {getRankIcon(rank)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-display font-semibold truncate ${rank <= 3 ? "text-lg" : ""}`}>
                      {team.team_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-6 text-sm font-mono">
                    {currentRound >= 1 && (
                      <div className="text-center hidden md:block">
                        <div className="text-muted-foreground text-xs">R1</div>
                        <div className="text-primary">{team.round1_score}</div>
                      </div>
                    )}
                    {currentRound >= 2 && (
                      <div className="text-center hidden md:block">
                        <div className="text-muted-foreground text-xs">R2</div>
                        <div className="text-secondary">{team.round2_score}</div>
                      </div>
                    )}
                    {currentRound >= 3 && (
                      <div className="text-center hidden md:block">
                        <div className="text-muted-foreground text-xs">R3</div>
                        <div className="text-accent">{team.round3_score}</div>
                      </div>
                    )}
                    <div className={`text-right min-w-[80px] ${rank <= 3 ? "text-xl" : "text-lg"}`}>
                      <span className="font-bold text-gradient-primary">{team.total_score}</span>
                      <span className="text-muted-foreground text-xs ml-1">pts</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {teams.length === 0 && (
            <div className="text-center py-12 text-muted-foreground font-mono">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              No teams registered yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
