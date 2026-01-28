import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Trophy, 
  Clock, 
  Users, 
  Target, 
  Zap, 
  Star,
  Timer,
  Award,
  Crown,
  Sparkles,
  Volume2
} from "lucide-react";

interface GameState {
  current_round: number;
  is_competition_active: boolean;
  round_start_time?: string;
  round_end_time?: string;
  competition_name: string;
  competition_status: string;
}

interface QuestionReveal {
  id: string;
  question: string;
  category: string;
  points: number;
  revealed_at: Date;
}

interface WinnerAnnouncement {
  team_name: string;
  total_score: number;
  rank: number;
  celebration_type: 'winner' | 'runner_up' | 'third_place';
}

export const AudienceDisplay = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [activeTeamsCount, setActiveTeamsCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionReveal | null>(null);
  const [winner, setWinner] = useState<WinnerAnnouncement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Fetch game state
  const fetchGameState = async () => {
    try {
      const { data, error } = await supabase
        .from("game_state")
        .select("*")
        .single();

      if (error) throw error;
      setGameState(data);

      // Calculate time remaining if round is active
      if (data.round_start_time && data.is_competition_active) {
        const roundDurations = {
          1: 30 * 60, // 30 minutes
          2: 60 * 60, // 60 minutes  
          3: 90 * 60  // 90 minutes
        };
        
        const startTime = new Date(data.round_start_time).getTime();
        const duration = roundDurations[data.current_round as keyof typeof roundDurations] * 1000;
        const endTime = startTime + duration;
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        
        setTimeRemaining(remaining);
      }

      // Get active teams count
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("is_active", true)
        .eq("is_disqualified", false);

      if (!teamsError) {
        setActiveTeamsCount(teams.length);
      }

    } catch (error) {
      console.error("Error fetching game state:", error);
    }
  };

  // Check for winner
  const checkForWinner = async () => {
    if (!gameState?.is_competition_active) {
      try {
        const { data: topTeam, error } = await supabase
          .from("teams")
          .select("team_name, total_score")
          .eq("is_active", true)
          .eq("is_disqualified", false)
          .order("total_score", { ascending: false })
          .limit(1)
          .single();

        if (!error && topTeam) {
          setWinner({
            team_name: topTeam.team_name,
            total_score: topTeam.total_score,
            rank: 1,
            celebration_type: 'winner'
          });
          setShowCelebration(true);
          
          if (soundEnabled) {
            playSound('winner');
          }
        }
      } catch (error) {
        console.error("Error checking for winner:", error);
      }
    }
  };

  // Play sound effects
  const playSound = (type: 'score_change' | 'round_start' | 'winner' | 'question_reveal') => {
    if (!soundEnabled) return;
    
    // Create audio context and play sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const frequencies = {
      score_change: 800,
      round_start: 600,
      winner: 1000,
      question_reveal: 400
    };
    
    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get round name
  const getRoundName = (round: number) => {
    const names = {
      1: "Aptitude Arena",
      2: "Constraint Paradox", 
      3: "Code Jeopardy"
    };
    return names[round as keyof typeof names] || `Round ${round}`;
  };

  // Get competition status color
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'running':
        return 'text-green-500';
      case 'paused':
        return 'text-yellow-500';
      case 'completed':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  // Initialize and set up real-time updates
  useEffect(() => {
    fetchGameState();
    checkForWinner();

    // Set up real-time subscriptions
    const gameStateSubscription = supabase
      .channel('game_state_audience')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_state'
        },
        () => {
          fetchGameState();
          if (soundEnabled) {
            playSound('round_start');
          }
        }
      )
      .subscribe();

    const teamsSubscription = supabase
      .channel('teams_audience')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams'
        },
        () => {
          fetchGameState();
          if (soundEnabled) {
            playSound('score_change');
          }
        }
      )
      .subscribe();

    // Timer countdown
    const timer = setInterval(() => {
      if (timeRemaining > 0) {
        setTimeRemaining(prev => prev - 1);
      } else {
        checkForWinner();
      }
    }, 1000);

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(fetchGameState, 30000);

    return () => {
      gameStateSubscription.unsubscribe();
      teamsSubscription.unsubscribe();
      clearInterval(timer);
      clearInterval(refreshInterval);
    };
  }, [soundEnabled, timeRemaining]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-2xl font-semibold">Loading Competition Status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1 
            className="text-8xl font-display font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-6"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, type: "spring" }}
          >
            CODEWARS 2.0
          </motion.h1>
          
          <motion.div
            className="flex items-center justify-center gap-4 mb-8"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            <Badge variant="outline" className="text-2xl px-6 py-3">
              {gameState.competition_name || "Programming Competition"}
            </Badge>
            <Badge 
              variant="outline" 
              className={cn("text-2xl px-6 py-3", getStatusColor(gameState.competition_status))}
            >
              {gameState.competition_status.toUpperCase()}
            </Badge>
          </motion.div>
        </div>

        {/* Main Display */}
        <div className="max-w-6xl mx-auto">
          {/* Current Round Info */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
          >
            <Card variant="neon" className="p-8 mb-8">
              <div className="flex items-center justify-center gap-6 mb-6">
                <Target className="w-12 h-12 text-primary" />
                <div>
                  <h2 className="text-4xl font-bold text-primary mb-2">
                    Round {gameState.current_round}
                  </h2>
                  <p className="text-2xl text-muted-foreground">
                    {getRoundName(gameState.current_round)}
                  </p>
                </div>
              </div>

              {gameState.is_competition_active && timeRemaining > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-4">
                    <Timer className="w-8 h-8 text-accent" />
                    <span className="text-6xl font-mono font-bold text-accent">
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <Progress 
                    value={100 - (timeRemaining / (90 * 60)) * 100} 
                    className="h-4"
                  />
                  <p className="text-lg text-muted-foreground">Time Remaining</p>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Competition Stats */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            <Card variant="glass" className="p-6 text-center">
              <Users className="w-12 h-12 text-primary mx-auto mb-4" />
              <div className="text-4xl font-bold text-primary mb-2">{activeTeamsCount}</div>
              <p className="text-lg text-muted-foreground">Active Teams</p>
            </Card>

            <Card variant="glass" className="p-6 text-center">
              <Zap className="w-12 h-12 text-accent mx-auto mb-4" />
              <div className="text-4xl font-bold text-accent mb-2">
                {gameState.is_competition_active ? 'LIVE' : 'PAUSED'}
              </div>
              <p className="text-lg text-muted-foreground">Competition Status</p>
            </Card>

            <Card variant="glass" className="p-6 text-center">
              <Star className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <div className="text-4xl font-bold text-yellow-500 mb-2">
                {gameState.current_round}/3
              </div>
              <p className="text-lg text-muted-foreground">Rounds Progress</p>
            </Card>
          </motion.div>

          {/* Sound Control */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 1 }}
          >
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "flex items-center gap-2 mx-auto px-4 py-2 rounded-lg border transition-colors",
                soundEnabled 
                  ? "bg-primary/20 border-primary text-primary" 
                  : "bg-muted border-border text-muted-foreground"
              )}
            >
              <Volume2 className="w-5 h-5" />
              Sound Effects: {soundEnabled ? 'ON' : 'OFF'}
            </button>
          </motion.div>

          {/* Question Reveal Animation */}
          <AnimatePresence>
            {currentQuestion && (
              <motion.div
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-card border-2 border-primary rounded-xl p-8 max-w-4xl mx-4"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.8 }}
                >
                  <div className="text-center">
                    <Badge variant="outline" className="text-xl px-4 py-2 mb-4">
                      {currentQuestion.category}
                    </Badge>
                    <h3 className="text-3xl font-bold mb-4">{currentQuestion.points} Points</h3>
                    <p className="text-xl text-muted-foreground">{currentQuestion.question}</p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Winner Announcement */}
          <AnimatePresence>
            {showCelebration && winner && (
              <motion.div
                className="fixed inset-0 bg-gradient-to-br from-yellow-500/20 via-primary/20 to-accent/20 flex items-center justify-center z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="text-center"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", duration: 1 }}
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <Crown className="w-32 h-32 text-yellow-500 mx-auto mb-8" />
                  </motion.div>
                  
                  <h2 className="text-8xl font-bold text-yellow-500 mb-4">
                    🏆 WINNER! 🏆
                  </h2>
                  
                  <h3 className="text-6xl font-bold text-primary mb-4">
                    {winner.team_name}
                  </h3>
                  
                  <p className="text-4xl text-muted-foreground mb-8">
                    Final Score: {winner.total_score} points
                  </p>

                  <div className="flex items-center justify-center gap-4">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          scale: [1, 1.5, 1],
                          rotate: [0, 180, 360]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.2
                        }}
                      >
                        <Sparkles className="w-8 h-8 text-yellow-500" />
                      </motion.div>
                    ))}
                  </div>

                  <motion.button
                    className="mt-8 px-8 py-4 bg-primary text-primary-foreground rounded-lg text-xl font-semibold"
                    onClick={() => setShowCelebration(false)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Continue to Final Results
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <motion.div
          className="text-center mt-16 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1 }}
        >
          <p className="text-xl mb-2">
            🚀 Powered by CodeWars 2.0 🚀
          </p>
          <p className="text-sm">
            Live updates • Real-time scoring • Automated competition management
          </p>
        </motion.div>
      </div>
    </div>
  );
};