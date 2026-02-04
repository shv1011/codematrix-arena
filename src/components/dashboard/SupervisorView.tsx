import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FullscreenLeaderboard } from "@/components/supervisor/FullscreenLeaderboard";
import { AudienceDisplay } from "@/components/supervisor/AudienceDisplay";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtime";
import { Trophy, Monitor, Radio, Clock, Users, Target, Maximize2 } from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  total_score: number;
  round1_score: number;
  round2_score: number;
  round3_score: number;
  is_active: boolean;
  is_disqualified: boolean;
}

interface GameState {
  current_round: number;
  is_competition_active: boolean;
  competition_status: string;
  round_start_time?: string;
  round_end_time?: string;
}

export const SupervisorView = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastScoreUpdate, setLastScoreUpdate] = useState<string | null>(null);
  const [activeTeamsCount, setActiveTeamsCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchData();
    
    // Update time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Subscribe to realtime updates
    const scoreSubscription = realtimeManager.subscribeToScoreUpdates((update) => {
      setLastScoreUpdate(`${update.team_name}: ${update.new_score} pts`);
      fetchTeams(); // Refresh teams data
      
      // Clear the update message after 5 seconds
      setTimeout(() => setLastScoreUpdate(null), 5000);
    });

    const gameSubscription = realtimeManager.subscribeToGameState((update) => {
      setGameState(prev => ({ ...prev, ...update }));
    });

    const teamSubscription = realtimeManager.subscribeToTeamUpdates(() => {
      fetchTeams(); // Refresh when team status changes
    });

    return () => {
      clearInterval(timeInterval);
      scoreSubscription.unsubscribe();
      gameSubscription.unsubscribe();
      teamSubscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchTeams(), fetchGameState()]);
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("total_score", { ascending: false });

    if (!error && data) {
      setTeams(data);
      setActiveTeamsCount(data.filter(t => t.is_active && !t.is_disqualified).length);
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

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return "Aptitude Arena";
      case 2: return "Constraint Paradox";
      case 3: return "Code Jeopardy";
      default: return "Waiting...";
    }
  };

  const getTimeRemaining = () => {
    if (!gameState?.round_end_time) return null;
    
    const endTime = new Date(gameState.round_end_time);
    const remaining = endTime.getTime() - currentTime.getTime();
    
    if (remaining <= 0) return "Time's Up!";
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <FullscreenLeaderboard
          teams={teams.filter(t => t.is_active && !t.is_disqualified)}
          gameState={gameState}
          onExitFullscreen={() => setIsFullscreen(false)}
          lastScoreUpdate={lastScoreUpdate}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Enhanced Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/50 backdrop-blur-lg border-b border-border/50 p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <Trophy className="w-12 h-12 text-primary" />
              <div>
                <h1 className="text-4xl font-display font-bold">
                  CODE<span className="text-primary">WARS</span> 2.0
                </h1>
                <p className="text-muted-foreground font-mono text-lg">
                  Supervisor Dashboard
                </p>
              </div>
            </div>
            
            {/* Competition Status */}
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                gameState?.is_competition_active 
                  ? "bg-accent/20 text-accent border-accent/30" 
                  : "bg-muted/20 text-muted-foreground border-muted/30"
              }`}>
                <Radio className={`w-5 h-5 ${gameState?.is_competition_active ? "animate-pulse" : ""}`} />
                <span className="font-mono font-bold text-lg">
                  {gameState?.is_competition_active ? "LIVE" : "OFFLINE"}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
            >
              <Maximize2 className="w-5 h-5" />
              <span className="font-mono">Fullscreen</span>
            </button>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-primary">
                {currentTime.toLocaleTimeString()}
              </div>
              <div className="text-sm text-muted-foreground">
                {currentTime.toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Round Information */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card/30 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary" />
              <span className="font-semibold">Current Round</span>
            </div>
            <div className="text-2xl font-bold text-primary">
              {gameState?.current_round ? `Round ${gameState.current_round}` : "Waiting"}
            </div>
            <div className="text-sm text-muted-foreground">
              {gameState?.current_round ? getRoundName(gameState.current_round) : "Competition not started"}
            </div>
          </div>

          <div className="bg-card/30 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-accent" />
              <span className="font-semibold">Active Teams</span>
            </div>
            <div className="text-2xl font-bold text-accent">
              {activeTeamsCount}
            </div>
            <div className="text-sm text-muted-foreground">
              {teams.length - activeTeamsCount} eliminated
            </div>
          </div>

          <div className="bg-card/30 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold">Time Remaining</span>
            </div>
            <div className="text-2xl font-bold text-yellow-500">
              {getTimeRemaining() || "--:--"}
            </div>
            <div className="text-sm text-muted-foreground">
              Current round
            </div>
          </div>

          <div className="bg-card/30 rounded-lg p-4 border border-border/30">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-5 h-5 text-blue-500" />
              <span className="font-semibold">Status</span>
            </div>
            <div className="text-lg font-bold text-blue-500">
              {gameState?.competition_status || "Idle"}
            </div>
            <div className="text-sm text-muted-foreground">
              Competition state
            </div>
          </div>
        </div>
      </motion.div>

      {/* Score Update Notification */}
      <AnimatePresence>
        {lastScoreUpdate && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 bg-accent/90 text-accent-foreground px-6 py-3 rounded-lg shadow-lg z-40"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              <span className="font-mono font-bold">Score Update: {lastScoreUpdate}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="p-6">
        <AudienceDisplay
          teams={teams.filter(t => t.is_active && !t.is_disqualified)}
          gameState={gameState}
          showAllTeams={true}
        />
      </div>
    </div>
  );
};
