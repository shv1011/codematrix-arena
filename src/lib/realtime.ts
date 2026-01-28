// Real-time WebSocket implementation using Supabase Realtime

import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface RealtimeSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export interface ScoreUpdate {
  team_id: string;
  team_name: string;
  old_score: number;
  new_score: number;
  round_number: number;
  timestamp: string;
}

export interface QuestionStatusUpdate {
  question_id: string;
  status: 'locked' | 'answered' | 'available';
  team_id?: string;
  team_name?: string;
  timestamp: string;
}

export interface GameStateUpdate {
  current_round: number;
  is_competition_active: boolean;
  competition_status: string;
  timestamp: string;
}

export interface TeamStatusUpdate {
  team_id: string;
  team_name: string;
  is_active: boolean;
  is_disqualified: boolean;
  round_eliminated?: number;
  timestamp: string;
}

export class RealtimeManager {
  private static instance: RealtimeManager;
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  private constructor() {
    this.setupConnectionMonitoring();
  }

  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  // Setup connection monitoring
  private setupConnectionMonitoring() {
    // Monitor Supabase connection status
    supabase.realtime.onOpen(() => {
      console.log('Realtime connection opened');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    });

    supabase.realtime.onClose(() => {
      console.log('Realtime connection closed');
      this.connectionStatus = 'disconnected';
      this.handleReconnection();
    });

    supabase.realtime.onError((error) => {
      console.error('Realtime connection error:', error);
      this.connectionStatus = 'disconnected';
      this.handleReconnection();
    });
  }

  // Handle reconnection logic
  private handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.connectionStatus = 'connecting';
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      // Resubscribe to all channels
      this.subscriptions.forEach((subscription, key) => {
        subscription.channel.subscribe();
      });

      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    }, this.reconnectDelay);
  }

  // Subscribe to score updates
  subscribeToScoreUpdates(callback: (update: ScoreUpdate) => void): RealtimeSubscription {
    const channelName = 'score_updates';
    
    // Unsubscribe existing if any
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: 'total_score=neq.null'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const { old: oldRecord, new: newRecord } = payload;
          
          if (oldRecord && newRecord && oldRecord.total_score !== newRecord.total_score) {
            const update: ScoreUpdate = {
              team_id: newRecord.id,
              team_name: newRecord.team_name,
              old_score: oldRecord.total_score || 0,
              new_score: newRecord.total_score || 0,
              round_number: this.getCurrentRound(),
              timestamp: new Date().toISOString()
            };
            
            callback(update);
          }
        }
      )
      .subscribe();

    const subscription: RealtimeSubscription = {
      channel,
      unsubscribe: () => {
        channel.unsubscribe();
        this.subscriptions.delete(channelName);
      }
    };

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Subscribe to question status updates
  subscribeToQuestionUpdates(callback: (update: QuestionStatusUpdate) => void): RealtimeSubscription {
    const channelName = 'question_updates';
    
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'question_locks'
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          
          let status: 'locked' | 'answered' | 'available' = 'available';
          let team_id: string | undefined;
          let team_name: string | undefined;

          if (eventType === 'INSERT' && newRecord?.is_active) {
            status = 'locked';
            team_id = newRecord.team_id;
            
            // Get team name
            const { data: team } = await supabase
              .from('teams')
              .select('team_name')
              .eq('id', team_id)
              .single();
            
            team_name = team?.team_name;
          } else if (eventType === 'UPDATE' && !newRecord?.is_active) {
            status = 'available';
          }

          const update: QuestionStatusUpdate = {
            question_id: newRecord?.question_id || oldRecord?.question_id,
            status,
            team_id,
            team_name,
            timestamp: new Date().toISOString()
          };

          callback(update);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'questions',
          filter: 'answered_by=neq.null'
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const { new: newRecord } = payload;
          
          if (newRecord?.answered_by) {
            // Get team name
            const { data: team } = await supabase
              .from('teams')
              .select('team_name')
              .eq('id', newRecord.answered_by)
              .single();

            const update: QuestionStatusUpdate = {
              question_id: newRecord.id,
              status: 'answered',
              team_id: newRecord.answered_by,
              team_name: team?.team_name,
              timestamp: new Date().toISOString()
            };

            callback(update);
          }
        }
      )
      .subscribe();

    const subscription: RealtimeSubscription = {
      channel,
      unsubscribe: () => {
        channel.unsubscribe();
        this.subscriptions.delete(channelName);
      }
    };

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Subscribe to game state changes
  subscribeToGameState(callback: (update: GameStateUpdate) => void): RealtimeSubscription {
    const channelName = 'game_state_updates';
    
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_state'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const { new: newRecord } = payload;
          
          const update: GameStateUpdate = {
            current_round: newRecord.current_round,
            is_competition_active: newRecord.is_competition_active,
            competition_status: newRecord.competition_status,
            timestamp: new Date().toISOString()
          };

          callback(update);
        }
      )
      .subscribe();

    const subscription: RealtimeSubscription = {
      channel,
      unsubscribe: () => {
        channel.unsubscribe();
        this.subscriptions.delete(channelName);
      }
    };

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Subscribe to team status changes
  subscribeToTeamUpdates(callback: (update: TeamStatusUpdate) => void): RealtimeSubscription {
    const channelName = 'team_updates';
    
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const { new: newRecord, old: oldRecord } = payload;
          
          // Only notify if status-related fields changed
          if (
            oldRecord?.is_active !== newRecord?.is_active ||
            oldRecord?.is_disqualified !== newRecord?.is_disqualified ||
            oldRecord?.round_eliminated !== newRecord?.round_eliminated
          ) {
            const update: TeamStatusUpdate = {
              team_id: newRecord.id,
              team_name: newRecord.team_name,
              is_active: newRecord.is_active,
              is_disqualified: newRecord.is_disqualified,
              round_eliminated: newRecord.round_eliminated,
              timestamp: new Date().toISOString()
            };

            callback(update);
          }
        }
      )
      .subscribe();

    const subscription: RealtimeSubscription = {
      channel,
      unsubscribe: () => {
        channel.unsubscribe();
        this.subscriptions.delete(channelName);
      }
    };

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Subscribe to submission updates (for live activity feed)
  subscribeToSubmissions(callback: (submission: any) => void): RealtimeSubscription {
    const channelName = 'submission_updates';
    
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions'
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const { new: newRecord } = payload;
          
          // Get team name
          const { data: team } = await supabase
            .from('teams')
            .select('team_name')
            .eq('id', newRecord.team_id)
            .single();

          const submission = {
            ...newRecord,
            team_name: team?.team_name,
            timestamp: new Date().toISOString()
          };

          callback(submission);
        }
      )
      .subscribe();

    const subscription: RealtimeSubscription = {
      channel,
      unsubscribe: () => {
        channel.unsubscribe();
        this.subscriptions.delete(channelName);
      }
    };

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Broadcast custom events (for admin notifications)
  async broadcastEvent(channel: string, event: string, payload: any): Promise<void> {
    try {
      const broadcastChannel = supabase.channel(channel);
      await broadcastChannel.send({
        type: 'broadcast',
        event,
        payload: {
          ...payload,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error broadcasting event:', error);
    }
  }

  // Subscribe to custom broadcasts
  subscribeToBroadcasts(
    channel: string, 
    event: string, 
    callback: (payload: any) => void
  ): RealtimeSubscription {
    const channelName = `broadcast_${channel}_${event}`;
    
    this.unsubscribe(channelName);

    const realtimeChannel = supabase
      .channel(channel)
      .on('broadcast', { event }, (payload) => {
        callback(payload);
      })
      .subscribe();

    const subscription: RealtimeSubscription = {
      channel: realtimeChannel,
      unsubscribe: () => {
        realtimeChannel.unsubscribe();
        this.subscriptions.delete(channelName);
      }
    };

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Unsubscribe from a specific channel
  unsubscribe(channelName: string): void {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      subscription.unsubscribe();
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
  }

  // Get connection status
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.connectionStatus;
  }

  // Get current round (helper method)
  private getCurrentRound(): number {
    // This would typically come from game state
    // For now, return a default value
    return 1;
  }

  // Health check for realtime connection
  async healthCheck(): Promise<{
    isConnected: boolean;
    activeSubscriptions: number;
    connectionStatus: string;
    lastError?: string;
  }> {
    return {
      isConnected: this.connectionStatus === 'connected',
      activeSubscriptions: this.subscriptions.size,
      connectionStatus: this.connectionStatus,
    };
  }

  // Performance monitoring
  getPerformanceMetrics(): {
    subscriptionCount: number;
    reconnectAttempts: number;
    connectionStatus: string;
  } {
    return {
      subscriptionCount: this.subscriptions.size,
      reconnectAttempts: this.reconnectAttempts,
      connectionStatus: this.connectionStatus
    };
  }
}

// Export singleton instance
export const realtimeManager = RealtimeManager.getInstance();

// Convenience hooks for React components
export const useRealtimeScores = (callback: (update: ScoreUpdate) => void) => {
  return realtimeManager.subscribeToScoreUpdates(callback);
};

export const useRealtimeQuestions = (callback: (update: QuestionStatusUpdate) => void) => {
  return realtimeManager.subscribeToQuestionUpdates(callback);
};

export const useRealtimeGameState = (callback: (update: GameStateUpdate) => void) => {
  return realtimeManager.subscribeToGameState(callback);
};

export const useRealtimeTeams = (callback: (update: TeamStatusUpdate) => void) => {
  return realtimeManager.subscribeToTeamUpdates(callback);
};

export const useRealtimeSubmissions = (callback: (submission: any) => void) => {
  return realtimeManager.subscribeToSubmissions(callback);
};