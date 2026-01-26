import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Monitor, Radio } from "lucide-react";

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
}

export const SupervisorView = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const teamsChannel = supabase
      .channel('supervisor-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, fetchTeams)
      .subscribe();

    const gameChannel = supabase
      .channel('supervisor-game')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, fetchGameState)
      .subscribe();

    return () => {
      teamsChannel.unsubscribe();
      gameChannel.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchTeams(), fetchGameState()]);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, team_name, total_score, round1_score, round2_score, round3_score")
      .eq("is_active", true)
      .eq("is_disqualified", false)
      .order("total_score", { ascending: false });

    if (!error && data) {
      setTeams(data);
    }
  };

  const fetchGameState = async () => {
    const { data, error } = await supabase
      .from("game_state")
      .select("*")
      .single();

    if (!error && data) {
      setGameState(data);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-pattern p-4 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div className="flex items-center gap-4">
          <Trophy className="w-10 h-10 text-primary" />
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold">
              CODE<span className="text-primary">WARS</span> 2.0
            </h1>
            <p className="text-muted-foreground font-mono">Live Leaderboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
            gameState?.is_competition_active 
              ? "bg-accent/20 text-accent" 
              : "bg-muted text-muted-foreground"
          }`}>
            <Radio className={`w-4 h-4 ${gameState?.is_competition_active ? "animate-pulse" : ""}`} />
            <span className="font-mono font-bold">
              {gameState?.is_competition_active ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <Monitor className="w-8 h-8 text-muted-foreground" />
        </div>
      </motion.div>

      {/* Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Leaderboard
          teams={teams}
          currentRound={gameState?.current_round || 0}
          isFullscreen
        />
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 text-center text-muted-foreground font-mono text-sm"
      >
        {gameState?.current_round ? (
          <p>Round {gameState.current_round} in Progress</p>
        ) : (
          <p>Waiting for competition to start...</p>
        )}
      </motion.div>
    </div>
  );
};
