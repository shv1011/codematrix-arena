// Progress persistence utility for maintaining user progress across sessions

export interface QuizProgress {
  teamId: string;
  roundNumber: number;
  currentQuestionIndex: number;
  answers: Record<number, number>;
  timeRemaining: number;
  lastSaved: string;
}

export interface ConstraintProgress {
  teamId: string;
  roundNumber: number;
  currentQuestionIndex: number;
  submissions: Record<number, {
    code: string;
    language: string;
    submittedAt?: string;
    result?: any;
  }>;
  timeRemaining: number;
  totalScore: number;
  lastSaved: string;
}

export class ProgressPersistence {
  private static readonly QUIZ_PROGRESS_KEY = 'codewars_quiz_progress';
  private static readonly CONSTRAINT_PROGRESS_KEY = 'codewars_constraint_progress';
  private static readonly JEOPARDY_PROGRESS_KEY = 'codewars_jeopardy_progress';

  // Quiz Progress (Round 1)
  static saveQuizProgress(progress: QuizProgress): void {
    try {
      const progressWithTimestamp = {
        ...progress,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(
        `${this.QUIZ_PROGRESS_KEY}_${progress.teamId}`,
        JSON.stringify(progressWithTimestamp)
      );
    } catch (error) {
      console.warn('Failed to save quiz progress:', error);
    }
  }

  static loadQuizProgress(teamId: string): QuizProgress | null {
    try {
      const saved = localStorage.getItem(`${this.QUIZ_PROGRESS_KEY}_${teamId}`);
      if (!saved) return null;

      const progress = JSON.parse(saved) as QuizProgress;
      
      // Check if progress is not too old (24 hours)
      const lastSaved = new Date(progress.lastSaved);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        this.clearQuizProgress(teamId);
        return null;
      }

      return progress;
    } catch (error) {
      console.warn('Failed to load quiz progress:', error);
      return null;
    }
  }

  static clearQuizProgress(teamId: string): void {
    try {
      localStorage.removeItem(`${this.QUIZ_PROGRESS_KEY}_${teamId}`);
    } catch (error) {
      console.warn('Failed to clear quiz progress:', error);
    }
  }

  // Constraint Progress (Round 2)
  static saveConstraintProgress(progress: ConstraintProgress): void {
    try {
      const progressWithTimestamp = {
        ...progress,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(
        `${this.CONSTRAINT_PROGRESS_KEY}_${progress.teamId}`,
        JSON.stringify(progressWithTimestamp)
      );
    } catch (error) {
      console.warn('Failed to save constraint progress:', error);
    }
  }

  static loadConstraintProgress(teamId: string): ConstraintProgress | null {
    try {
      const saved = localStorage.getItem(`${this.CONSTRAINT_PROGRESS_KEY}_${teamId}`);
      if (!saved) return null;

      const progress = JSON.parse(saved) as ConstraintProgress;
      
      // Check if progress is not too old (24 hours)
      const lastSaved = new Date(progress.lastSaved);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        this.clearConstraintProgress(teamId);
        return null;
      }

      return progress;
    } catch (error) {
      console.warn('Failed to load constraint progress:', error);
      return null;
    }
  }

  static clearConstraintProgress(teamId: string): void {
    try {
      localStorage.removeItem(`${this.CONSTRAINT_PROGRESS_KEY}_${teamId}`);
    } catch (error) {
      console.warn('Failed to clear constraint progress:', error);
    }
  }

  // Jeopardy Progress (Round 3)
  static saveJeopardyProgress(teamId: string, progress: any): void {
    try {
      const progressWithTimestamp = {
        ...progress,
        teamId,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(
        `${this.JEOPARDY_PROGRESS_KEY}_${teamId}`,
        JSON.stringify(progressWithTimestamp)
      );
    } catch (error) {
      console.warn('Failed to save jeopardy progress:', error);
    }
  }

  static loadJeopardyProgress(teamId: string): any | null {
    try {
      const saved = localStorage.getItem(`${this.JEOPARDY_PROGRESS_KEY}_${teamId}`);
      if (!saved) return null;

      const progress = JSON.parse(saved);
      
      // Check if progress is not too old (24 hours)
      const lastSaved = new Date(progress.lastSaved);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        this.clearJeopardyProgress(teamId);
        return null;
      }

      return progress;
    } catch (error) {
      console.warn('Failed to load jeopardy progress:', error);
      return null;
    }
  }

  static clearJeopardyProgress(teamId: string): void {
    try {
      localStorage.removeItem(`${this.JEOPARDY_PROGRESS_KEY}_${teamId}`);
    } catch (error) {
      console.warn('Failed to clear jeopardy progress:', error);
    }
  }

  // Clear all progress for a team
  static clearAllProgress(teamId: string): void {
    this.clearQuizProgress(teamId);
    this.clearConstraintProgress(teamId);
    this.clearJeopardyProgress(teamId);
  }

  // Auto-save functionality
  static setupAutoSave(
    teamId: string,
    roundNumber: number,
    getProgressData: () => any,
    intervalMs: number = 30000 // 30 seconds
  ): () => void {
    const interval = setInterval(() => {
      try {
        const progressData = getProgressData();
        
        switch (roundNumber) {
          case 1:
            this.saveQuizProgress(progressData);
            break;
          case 2:
            this.saveConstraintProgress(progressData);
            break;
          case 3:
            this.saveJeopardyProgress(teamId, progressData);
            break;
        }
      } catch (error) {
        console.warn('Auto-save failed:', error);
      }
    }, intervalMs);

    // Return cleanup function
    return () => clearInterval(interval);
  }
}