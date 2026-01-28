import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Crown, 
  Medal, 
  Star, 
  Zap, 
  Users, 
  Clock, 
  Target,
  TrendingUp,
  Award,
  Flame
} from "lucide-react";

interface TeamScore {
  id: string;
  team_name: string;
  team_code: string;
  round1_score: number;
  round2_score: number;
  round3_score: number;
  total_score: number;
  is_active: boolean;
  is_disqualified: boolean;
  round_eliminated?: number;
  rank: number;
  score_change?: number;
}

interface CompetitionStats {
  totalTeams: number;
  activeTeams: number;
  eliminatedTeams: number;
  currentRound: number;
  timeRemaining: number;
  questionsAnswered: number;
  totalQuestions: number;
}

export const FullscreenLeaderboard = () => {
  const [teams, setTeams] = useState<TeamScore[]>([]);
  const [stats, setStats] = useState<CompetitionStats>({
    totalTeams: 0,
    activeTeams: 0,
    eliminatedTeams: 0,
    currentRound: 1,
    timeRemaining: 0,
    questionsAnswered: 0,
    totalQuestions: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [animatingTeams, setAnimatingTeams] = useState<Set<string>>(new Set());

  // Fetch leaderboard data
  const fetchLeaderboard = async () => {
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select(`
          id,
          team_name,
          team_code,
          round1_score,
          round2_score,
          round3_score,
          total_score,
          is_active,
          is_disqualified,
          round_eliminated
        `)
        .order("total_score", { ascending: false });

      if (teamsError) throw teamsError;

      // Calculate ranks and score changes
      const rankedTeams = teamsData.map((team, index) => ({
        ...team,
        round1_score: team.round1_score || 0,
        round2_score: team.round2_score || 0,
        round3_score: team.round3_score || 0,
        total_score: team.total_score || 0,
        rank: index + 1,
        score_change: 0 // Will be calculated based on previous state
      }));

      // Calculate score changes for animations
      const previousTeams = teams;
      const updatedTeams = rankedTeams.map(team => {
        const previousTeam = previousTeams.find(p => p.id === team.id);
        const scoreChange = previousTeam ? team.total_score - previousTeam.total_score : 0;
        
        if (scoreChange > 0) {
          setAnimatingTeams(prev => new Set([...prev, team.id]));
          setTimeout(() => {
            setAnimatingTeams(prev => {
              const newSet = new Set(prev);
              newSet.delete(team.id);
              return newSet;
            });
          }, 3000);
        }

        return {
          ...team,
          score_change: scoreChange
        };
      });

      setTeams(updatedTeams);

      // Fetch competition stats
      const { data: gameState, error: gameError } = await supabase
        .from("game_state")
        .select("*")
        .single();

      if (gameError) throw gameError;

      // Get submission stats
      const { data: submissions, error: submissionsError } = await supabase
        .from("submissions")
        .select("id, round_number");

      if (submissionsError) throw submissionsError;

      const totalQuestions = {
        1: 20, // Round 1 questions
        2: 10, // Round 2 questions  
        3: 35  // Round 3 questions (7x5)
      };

      setStats({
        totalTeams: teamsData.length,
        activeTeams: teamsData.filter(t => t.is_active && !t.is_disqualified).length,
        eliminatedTeams: teamsData.filter(t => !t.is_active || t.is_disqualified).length,
        currentRound: gameState.current_round || 1,
        timeRemaining: 0, // Will be calculated based on round
        questionsAnswered: submissions.length,
        totalQuestions: totalQuestions[gameState.current_round as keyof typeof totalQuestions] || 0
      });

      setLastUpdate(new Date());

    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time updates
  useEffect(() => {
    fetchLeaderboard();

    // Set up real-time subscriptions
    const teamsSubscription = supabase
      .channel('teams_leaderboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams'
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    const submissionsSubscription = supabase
      .channel('submissions_leaderboard')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions'
        },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);

    return () => {
      teamsSubscription.unsubscribe();
      submissionsSubscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-8 h-8 text-yellow-500" />;
      case 2:
        return <Medal className="w-8 h-8 text-gray-400" />;
      case 3:
        return <Award className="w-8 h-8 text-amber-600" />;
      default:
        return <span className="text-4xl font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50";
      case 2:
        return "from-gray-400/20 to-gray-500/20 border-gray-400/50";
      case 3:
        return "from-amber-600/20 to-amber-700/20 border-amber-600/50";
      default:
        return "from-primary/10 to-primary/20 border-primary/30";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-2xl font-semibold">Loading Leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1 
            className="text-6xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-4"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            CODEWARS 2.0
          </motion.h1>
          <motion.p 
            className="text-2xl text-muted-foreground mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            Live Competition Leaderboard
          </motion.p>

          {/* Competition Stats */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
          >
            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Active Teams</span>
              </div>
              <div className="text-3xl font-bold text-primary">{stats.activeTeams}</div>
            </Card>

            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="w-6 h-6 text-accent" />
                <span className="text-sm font-medium">Round</span>
              </div>
              <div className="text-3xl font-bold text-accent">{stats.currentRound}</div>
            </Card>

            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="w-6 h-6 text-green-500" />
                <span className="text-sm font-medium">Submissions</span>
              </div>
              <div className="text-3xl font-bold text-green-500">{stats.questionsAnswered}</div>
            </Card>

            <Card variant="glass" className="p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-6 h-6 text-yellow-500" />
                <span className="text-sm font-medium">Last Update</span>
              </div>
              <div className="text-sm font-mono text-yellow-500">
                {lastUpdate.toLocaleTimeString()}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Leaderboard */}
        <div className="space-y-4">
          <AnimatePresence>
            {teams.slice(0, 15).map((team, index) => (
              <motion.div
                key={team.id}
                layout
                initial={{ opacity: 0, x: -100 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  scale: animatingTeams.has(team.id) ? [1, 1.02, 1] : 1
                }}
                exit={{ opacity: 0, x: 100 }}
                transition={{ 
                  duration: 0.5, 
                  delay: index * 0.1,
                  scale: { duration: 0.3, repeat: animatingTeams.has(team.id) ? 3 : 0 }
                }}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 bg-gradient-to-r p-6",
                  getRankColor(team.rank),
                  !team.is_active && "opacity-60 grayscale"
                )}
              >
                <div className="flex items-center justify-between">
                  {/* Rank and Team Info */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center justify-center w-16 h-16">
                      {getRankIcon(team.rank)}
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-bold text-foreground mb-1">
                        {team.team_name}
                      </h3>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {team.team_code}
                        </Badge>
                        {!team.is_active && (
                          <Badge variant="destructive">
                            Eliminated R{team.round_eliminated}
                          </Badge>
                        )}
                        {team.score_change > 0 && (
                          <Badge variant="success" className="animate-pulse">
                            +{team.score_change}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scores */}
                  <div className="flex items-center gap-8">
                    {/* Round Scores */}
                    <div className="hidden md:flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-muted-foreground">R1</div>
                        <div className="font-bold text-lg">{team.round1_score}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">R2</div>
                        <div className="font-bold text-lg">{team.round2_score}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">R3</div>
                        <div className="font-bold text-lg">{team.round3_score}</div>
                      </div>
                    </div>

                    {/* Total Score */}
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground mb-1">Total Score</div>
                      <div className="text-4xl font-bold text-primary flex items-center gap-2">
                        {team.total_score}
                        {animatingTeams.has(team.id) && (
                          <Flame className="w-6 h-6 text-orange-500 animate-bounce" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Animated background for score changes */}
                {animatingTeams.has(team.id) && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.5, 0] }}
                    transition={{ duration: 2, repeat: 2 }}
                  />
                )}

                {/* Rank indicator */}
                {team.rank <= 3 && (
                  <div className="absolute top-0 right-0 w-0 h-0 border-l-[50px] border-l-transparent border-t-[50px] border-t-primary/20" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div 
          className="text-center mt-12 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
        >
          <p className="text-lg">
            🏆 May the best code win! 🏆
          </p>
          <p className="text-sm mt-2">
            Updates automatically • Last refresh: {lastUpdate.toLocaleString()}
          </p>
        </motion.div>
      </div>
    </div>
  );
};