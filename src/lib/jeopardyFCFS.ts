// First Come First Serve (FCFS) selection system for Jeopardy Round

import { supabase } from "@/integrations/supabase/client";

export interface QuestionLock {
  id?: string;
  question_id: string;
  team_id: string;
  locked_at: string;
  expires_at: string;
  is_active: boolean;
}

export interface FCFSSelection {
  questionId: string;
  teamId: string;
  teamName: string;
  lockedAt: Date;
  expiresAt: Date;
  timeRemaining: number;
}

export interface TeamQueue {
  teamId: string;
  teamName: string;
  queuePosition: number;
  requestedAt: Date;
}

export class JeopardyFCFS {
  private static readonly LOCK_TIMEOUT = 300; // 5 minutes in seconds
  private static readonly SELECTION_TIMEOUT = 30; // 30 seconds to select after unlock

  // Attempt to lock a question for a team
  static async requestQuestionLock(
    questionId: string, 
    teamId: string
  ): Promise<{
    success: boolean;
    lock?: QuestionLock;
    message: string;
    queuePosition?: number;
  }> {
    try {
      // Check if question is already locked
      const { data: existingLock, error: lockError } = await supabase
        .from("question_locks")
        .select("*")
        .eq("question_id", questionId)
        .eq("is_active", true)
        .single();

      if (lockError && lockError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw lockError;
      }

      // If question is already locked by another team
      if (existingLock && existingLock.team_id !== teamId) {
        const expiresAt = new Date(existingLock.expires_at);
        const now = new Date();
        
        if (expiresAt > now) {
          return {
            success: false,
            message: `Question is locked by another team until ${expiresAt.toLocaleTimeString()}`,
            queuePosition: await this.getQueuePosition(questionId, teamId)
          };
        } else {
          // Lock has expired, remove it
          await this.releaseLock(existingLock.id!);
        }
      }

      // If question is already locked by this team, extend the lock
      if (existingLock && existingLock.team_id === teamId) {
        const updatedLock = await this.extendLock(existingLock.id!);
        return {
          success: true,
          lock: updatedLock,
          message: "Lock extended successfully"
        };
      }

      // Create new lock
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.LOCK_TIMEOUT * 1000);

      const { data: newLock, error: createError } = await supabase
        .from("question_locks")
        .insert({
          question_id: questionId,
          team_id: teamId,
          locked_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (createError) throw createError;

      return {
        success: true,
        lock: newLock,
        message: "Question locked successfully"
      };

    } catch (error) {
      console.error("Error requesting question lock:", error);
      return {
        success: false,
        message: "Failed to lock question. Please try again."
      };
    }
  }

  // Release a question lock
  static async releaseLock(lockId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("question_locks")
        .update({ is_active: false })
        .eq("id", lockId);

      if (error) throw error;
      return true;

    } catch (error) {
      console.error("Error releasing lock:", error);
      return false;
    }
  }

  // Extend an existing lock
  static async extendLock(lockId: string): Promise<QuestionLock> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.LOCK_TIMEOUT * 1000);

    const { data, error } = await supabase
      .from("question_locks")
      .update({ 
        expires_at: expiresAt.toISOString(),
        locked_at: now.toISOString()
      })
      .eq("id", lockId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get current active locks
  static async getActiveLocks(): Promise<FCFSSelection[]> {
    try {
      const { data: locks, error } = await supabase
        .from("question_locks")
        .select(`
          *,
          teams!inner(team_name)
        `)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;

      return locks.map(lock => ({
        questionId: lock.question_id,
        teamId: lock.team_id,
        teamName: lock.teams.team_name,
        lockedAt: new Date(lock.locked_at),
        expiresAt: new Date(lock.expires_at),
        timeRemaining: Math.max(0, Math.floor((new Date(lock.expires_at).getTime() - Date.now()) / 1000))
      }));

    } catch (error) {
      console.error("Error getting active locks:", error);
      return [];
    }
  }

  // Get locks for a specific team
  static async getTeamLocks(teamId: string): Promise<FCFSSelection[]> {
    try {
      const { data: locks, error } = await supabase
        .from("question_locks")
        .select(`
          *,
          teams!inner(team_name)
        `)
        .eq("team_id", teamId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString());

      if (error) throw error;

      return locks.map(lock => ({
        questionId: lock.question_id,
        teamId: lock.team_id,
        teamName: lock.teams.team_name,
        lockedAt: new Date(lock.locked_at),
        expiresAt: new Date(lock.expires_at),
        timeRemaining: Math.max(0, Math.floor((new Date(lock.expires_at).getTime() - Date.now()) / 1000))
      }));

    } catch (error) {
      console.error("Error getting team locks:", error);
      return [];
    }
  }

  // Check if a question is locked
  static async isQuestionLocked(questionId: string): Promise<{
    isLocked: boolean;
    lockedBy?: string;
    expiresAt?: Date;
    timeRemaining?: number;
  }> {
    try {
      const { data: lock, error } = await supabase
        .from("question_locks")
        .select(`
          *,
          teams!inner(team_name)
        `)
        .eq("question_id", questionId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!lock) {
        return { isLocked: false };
      }

      const expiresAt = new Date(lock.expires_at);
      const timeRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      return {
        isLocked: true,
        lockedBy: lock.teams.team_name,
        expiresAt,
        timeRemaining
      };

    } catch (error) {
      console.error("Error checking question lock:", error);
      return { isLocked: false };
    }
  }

  // Clean up expired locks
  static async cleanupExpiredLocks(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from("question_locks")
        .update({ is_active: false })
        .lt("expires_at", new Date().toISOString())
        .eq("is_active", true)
        .select();

      if (error) throw error;
      return data.length;

    } catch (error) {
      console.error("Error cleaning up expired locks:", error);
      return 0;
    }
  }

  // Get queue position for a team waiting for a question
  private static async getQueuePosition(questionId: string, teamId: string): Promise<number> {
    // This is a simplified queue system
    // In a real implementation, you might want a separate queue table
    try {
      const { data: requests, error } = await supabase
        .from("question_requests")
        .select("team_id, requested_at")
        .eq("question_id", questionId)
        .order("requested_at", { ascending: true });

      if (error) throw error;

      const position = requests.findIndex(req => req.team_id === teamId);
      return position >= 0 ? position + 1 : requests.length + 1;

    } catch (error) {
      console.error("Error getting queue position:", error);
      return 1;
    }
  }

  // Submit answer and handle scoring for Jeopardy
  static async submitAnswer(
    questionId: string,
    teamId: string,
    answer: string,
    isCorrect: boolean,
    pointsEarned: number,
    questionPoints: number // Base points for the question (for negative marking)
  ): Promise<boolean> {
    try {
      // Update team score directly in database
      const { data: currentTeam, error: fetchError } = await supabase
        .from("teams")
        .select("round3_score, total_score")
        .eq("id", teamId)
        .single();

      if (fetchError || !currentTeam) {
        console.error("Error fetching team:", fetchError);
        return false;
      }

      // Update Round 3 score and total score
      const newRound3Score = currentTeam.round3_score + pointsEarned;
      const newTotalScore = currentTeam.total_score + pointsEarned;

      const { error: updateError } = await supabase
        .from("teams")
        .update({
          round3_score: newRound3Score,
          total_score: newTotalScore
        })
        .eq("id", teamId);

      if (updateError) {
        console.error("Score update error:", updateError);
        return false;
      }

      // Release the lock from our in-memory tracking
      if (this.questionLocks.has(questionId)) {
        this.questionLocks.delete(questionId);
      }

      console.log(`Answer evaluated for question ${questionId} by team ${teamId}: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (${pointsEarned} points)`);
      return true;

    } catch (error) {
      console.error("Error processing answer:", error);
      return false;
    }
  }

  // Get FCFS statistics
  static async getFCFSStats(): Promise<{
    totalLocks: number;
    activeLocks: number;
    expiredLocks: number;
    averageLockDuration: number;
    mostActiveTeam: string;
  }> {
    try {
      const { data: allLocks, error } = await supabase
        .from("question_locks")
        .select(`
          *,
          teams!inner(team_name)
        `);

      if (error) throw error;

      const now = Date.now();
      const activeLocks = allLocks.filter(lock => 
        lock.is_active && new Date(lock.expires_at).getTime() > now
      );
      const expiredLocks = allLocks.filter(lock => 
        !lock.is_active || new Date(lock.expires_at).getTime() <= now
      );

      // Calculate average lock duration
      const completedLocks = allLocks.filter(lock => !lock.is_active);
      const totalDuration = completedLocks.reduce((sum, lock) => {
        const start = new Date(lock.locked_at).getTime();
        const end = new Date(lock.expires_at).getTime();
        return sum + (end - start);
      }, 0);
      const averageLockDuration = completedLocks.length > 0 
        ? Math.floor(totalDuration / completedLocks.length / 1000) 
        : 0;

      // Find most active team
      const teamCounts = allLocks.reduce((acc, lock) => {
        acc[lock.teams.team_name] = (acc[lock.teams.team_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const mostActiveTeam = Object.entries(teamCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

      return {
        totalLocks: allLocks.length,
        activeLocks: activeLocks.length,
        expiredLocks: expiredLocks.length,
        averageLockDuration,
        mostActiveTeam
      };

    } catch (error) {
      console.error("Error getting FCFS stats:", error);
      return {
        totalLocks: 0,
        activeLocks: 0,
        expiredLocks: 0,
        averageLockDuration: 0,
        mostActiveTeam: 'None'
      };
    }
  }

  // Real-time lock monitoring (for admin dashboard)
  static subscribeToLockChanges(callback: (locks: FCFSSelection[]) => void) {
    const subscription = supabase
      .channel('question_locks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'question_locks'
        },
        async () => {
          const locks = await this.getActiveLocks();
          callback(locks);
        }
      )
      .subscribe();

    return subscription;
  }

  // Force unlock a question (admin function)
  static async forceUnlock(questionId: string, reason: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("question_locks")
        .update({ 
          is_active: false,
          unlock_reason: reason,
          unlocked_at: new Date().toISOString()
        })
        .eq("question_id", questionId)
        .eq("is_active", true);

      if (error) throw error;
      return true;

    } catch (error) {
      console.error("Error force unlocking question:", error);
      return false;
    }
  }
}