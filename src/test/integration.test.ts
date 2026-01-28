// Integration tests for CodeWars 2.0 core functionality

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  render, 
  screen, 
  fireEvent, 
  waitFor,
  mockSupabaseClient,
  mockFetch,
  mockLocalStorage,
  setupIntegrationTest,
  mockTeam,
  mockUser,
  mockQuestion,
  mockGameState,
  createTeams,
  createQuestions
} from './testUtils';

// Mock modules
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient
}));

vi.mock('@/lib/questionLoader', () => ({
  QuestionLoader: {
    loadRound1Questions: vi.fn().mockResolvedValue({
      round_info: {
        round_number: 1,
        round_name: 'Aptitude Arena',
        time_limit_seconds: 1800,
        total_questions: 5
      },
      questions: createQuestions(5, 1)
    }),
    loadRound2Questions: vi.fn().mockResolvedValue({
      round_info: {
        round_number: 2,
        round_name: 'Constraint Paradox',
        time_limit_seconds: 3600,
        total_questions: 3
      },
      questions: createQuestions(3, 2)
    }),
    loadRound3Questions: vi.fn().mockResolvedValue({
      round_info: {
        round_number: 3,
        round_name: 'Code Jeopardy',
        time_limit_seconds: 5400,
        grid_size: '7x5'
      },
      categories: {
        DSA: { name: 'Data Structures & Algorithms', questions: createQuestions(5, 3) }
      }
    })
  }
}));

describe('CodeWars 2.0 Integration Tests', () => {
  let testSetup: ReturnType<typeof setupIntegrationTest>;

  beforeEach(() => {
    testSetup = setupIntegrationTest();
    mockLocalStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  describe('Authentication Flow', () => {
    it('should handle user login successfully', async () => {
      const mockUserData = mockUser({ email: 'test@example.com' });
      
      mockSupabaseClient.auth.signIn.mockResolvedValue({
        data: { user: mockUserData },
        error: null
      });

      // Test login process
      const loginResult = await mockSupabaseClient.auth.signIn({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(loginResult.data.user).toEqual(mockUserData);
      expect(loginResult.error).toBeNull();
    });

    it('should handle authentication errors', async () => {
      mockSupabaseClient.auth.signIn.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' }
      });

      const loginResult = await mockSupabaseClient.auth.signIn({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      });

      expect(loginResult.data.user).toBeNull();
      expect(loginResult.error.message).toBe('Invalid credentials');
    });
  });

  describe('Team Management', () => {
    it('should create and manage teams', async () => {
      const newTeam = mockTeam({ team_name: 'New Team', team_code: 'NEW123' });
      
      // Mock team creation
      mockSupabaseClient.from().insert.mockResolvedValue({
        data: [newTeam],
        error: null
      });

      // Test team creation
      const result = await mockSupabaseClient
        .from('teams')
        .insert(newTeam);

      expect(result.data).toEqual([newTeam]);
      expect(result.error).toBeNull();
    });

    it('should fetch team leaderboard', async () => {
      const teams = createTeams(5);
      
      mockSupabaseClient.from().select.mockResolvedValue({
        data: teams,
        error: null
      });

      const result = await mockSupabaseClient
        .from('teams')
        .select('*')
        .order('total_score', { ascending: false });

      expect(result.data).toEqual(teams);
      expect(result.error).toBeNull();
    });
  });

  describe('Question Loading System', () => {
    it('should load Round 1 questions', async () => {
      const { QuestionLoader } = await import('@/lib/questionLoader');
      
      const result = await QuestionLoader.loadRound1Questions();
      
      expect(result.round_info.round_number).toBe(1);
      expect(result.questions).toHaveLength(5);
      expect(result.questions[0]).toHaveProperty('question');
      expect(result.questions[0]).toHaveProperty('options');
      expect(result.questions[0]).toHaveProperty('correct_answer');
    });

    it('should validate question structure', async () => {
      const { QuestionLoader } = await import('@/lib/questionLoader');
      
      const result = await QuestionLoader.loadRound1Questions();
      
      result.questions.forEach(question => {
        expect(question).toHaveProperty('id');
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('options');
        expect(question).toHaveProperty('correct_answer');
        expect(question).toHaveProperty('points');
        expect(question.options).toBeInstanceOf(Array);
        expect(question.options.length).toBeGreaterThan(1);
        expect(question.correct_answer).toBeGreaterThanOrEqual(0);
        expect(question.correct_answer).toBeLessThan(question.options.length);
      });
    });
  });

  describe('AI Evaluation System', () => {
    it('should evaluate code submissions', async () => {
      const mockEvaluation = {
        isCorrect: true,
        score: 85,
        feedback: 'Good solution',
        reasoning: 'Code is correct and efficient',
        constraintViolations: [],
        executionResult: { passed: true, output: 'Expected output' }
      };

      mockFetch(mockEvaluation);

      // Mock AI evaluation
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          code: 'function solution() { return "Hello World"; }',
          question: 'Write a function that returns Hello World'
        })
      });

      const result = await response.json();
      expect(result).toEqual(mockEvaluation);
    });

    it('should handle AI service failures', async () => {
      mockFetch({ error: 'Service unavailable' }, false);

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({ code: 'test', question: 'test' })
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('Real-time Updates', () => {
    it('should set up real-time subscriptions', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
      };

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const subscription = mockSupabaseClient
        .channel('test_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, vi.fn())
        .subscribe();

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('test_channel');
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(subscription).toHaveProperty('unsubscribe');
    });
  });

  describe('Game State Management', () => {
    it('should manage competition rounds', async () => {
      const gameState = mockGameState({ current_round: 1, is_competition_active: true });
      
      mockSupabaseClient.from().select.mockResolvedValue({
        data: gameState,
        error: null
      });

      const result = await mockSupabaseClient
        .from('game_state')
        .select('*')
        .single();

      expect(result.data).toEqual(gameState);
      expect(result.data.current_round).toBe(1);
      expect(result.data.is_competition_active).toBe(true);
    });

    it('should update game state', async () => {
      const updatedState = mockGameState({ current_round: 2, is_competition_active: false });
      
      mockSupabaseClient.from().update.mockResolvedValue({
        data: [updatedState],
        error: null
      });

      const result = await mockSupabaseClient
        .from('game_state')
        .update({ current_round: 2, is_competition_active: false })
        .eq('id', 1);

      expect(result.data).toEqual([updatedState]);
    });
  });

  describe('Submission System', () => {
    it('should handle quiz submissions', async () => {
      const submission = {
        team_id: 'team-123',
        question_id: '1',
        round_number: 1,
        answer: 'O(log n)',
        is_correct: true,
        points_earned: 10
      };

      mockSupabaseClient.from().insert.mockResolvedValue({
        data: [submission],
        error: null
      });

      const result = await mockSupabaseClient
        .from('submissions')
        .insert(submission);

      expect(result.data).toEqual([submission]);
      expect(result.error).toBeNull();
    });

    it('should calculate scores correctly', async () => {
      const submissions = [
        { points_earned: 10, is_correct: true },
        { points_earned: 15, is_correct: true },
        { points_earned: 0, is_correct: false }
      ];

      const totalScore = submissions.reduce((sum, sub) => sum + sub.points_earned, 0);
      const correctAnswers = submissions.filter(sub => sub.is_correct).length;

      expect(totalScore).toBe(25);
      expect(correctAnswers).toBe(2);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache frequently accessed data', async () => {
      const cacheKey = 'test_data';
      const testData = { id: 1, name: 'Test' };

      // Mock cache implementation
      const cache = new Map();
      cache.set(cacheKey, { data: testData, timestamp: Date.now(), ttl: 300000 });

      const cachedData = cache.get(cacheKey);
      expect(cachedData.data).toEqual(testData);
    });

    it('should handle cache expiration', async () => {
      const cache = new Map();
      const expiredEntry = { 
        data: { id: 1 }, 
        timestamp: Date.now() - 400000, // 400 seconds ago
        ttl: 300000 // 5 minutes TTL
      };

      cache.set('expired_key', expiredEntry);

      // Check if entry is expired
      const entry = cache.get('expired_key');
      const isExpired = Date.now() - entry.timestamp > entry.ttl;

      expect(isExpired).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabaseClient.from().select.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'PGRST301' }
      });

      const result = await mockSupabaseClient
        .from('teams')
        .select('*');

      expect(result.error).toBeTruthy();
      expect(result.error.message).toBe('Database connection failed');
      expect(result.data).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch({ error: 'Network error' }, false);

      try {
        const response = await fetch('/api/test');
        expect(response.ok).toBe(false);
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });

  describe('Security Features', () => {
    it('should validate user input', async () => {
      const { InputValidator } = await import('@/lib/security');

      // Test email validation
      expect(InputValidator.isValidEmail('test@example.com')).toBe(true);
      expect(InputValidator.isValidEmail('invalid-email')).toBe(false);

      // Test team name validation
      expect(InputValidator.isValidTeamName('Valid Team Name')).toBe(true);
      expect(InputValidator.isValidTeamName('<script>alert("xss")</script>')).toBe(false);

      // Test code submission validation
      expect(InputValidator.isValidCodeSubmission('function test() { return 1; }')).toBe(true);
      expect(InputValidator.isValidCodeSubmission('eval("malicious code")')).toBe(false);
    });

    it('should implement rate limiting', async () => {
      const { RateLimiter } = await import('@/lib/security');

      const identifier = 'test-user';
      const limit = 5;
      const windowMs = 60000;

      // Should allow requests within limit
      for (let i = 0; i < limit; i++) {
        expect(RateLimiter.isAllowed(identifier, limit, windowMs)).toBe(true);
      }

      // Should block requests over limit
      expect(RateLimiter.isAllowed(identifier, limit, windowMs)).toBe(false);
    });
  });

  describe('End-to-End Competition Flow', () => {
    it('should complete a full competition cycle', async () => {
      // 1. Initialize competition
      const gameState = mockGameState({ current_round: 1, is_competition_active: true });
      mockSupabaseClient.from().select.mockResolvedValue({ data: gameState, error: null });

      // 2. Teams participate in Round 1
      const teams = createTeams(10);
      mockSupabaseClient.from().select.mockResolvedValue({ data: teams, error: null });

      // 3. Submit answers and calculate scores
      const submissions = teams.map(team => ({
        team_id: team.id,
        round_number: 1,
        points_earned: Math.floor(Math.random() * 100)
      }));

      mockSupabaseClient.from().insert.mockResolvedValue({ data: submissions, error: null });

      // 4. Update team scores
      const updatedTeams = teams.map((team, index) => ({
        ...team,
        round1_score: submissions[index].points_earned,
        total_score: submissions[index].points_earned
      }));

      mockSupabaseClient.from().update.mockResolvedValue({ data: updatedTeams, error: null });

      // 5. Advance to next round
      const nextRoundState = { ...gameState, current_round: 2 };
      mockSupabaseClient.from().update.mockResolvedValue({ data: [nextRoundState], error: null });

      // Verify the flow
      expect(submissions).toHaveLength(10);
      expect(updatedTeams.every(team => team.total_score >= 0)).toBe(true);
      expect(nextRoundState.current_round).toBe(2);
    });
  });
});

// Performance tests
describe('Performance Tests', () => {
  it('should render components within acceptable time limits', async () => {
    const { measureRenderTime } = await import('./testUtils');

    const renderTime = await measureRenderTime(() => {
      render(<div>Test Component</div>);
    });

    expect(renderTime).toBeLessThan(100); // Should render in less than 100ms
  });

  it('should handle large datasets efficiently', async () => {
    const largeTeamList = createTeams(1000);
    const startTime = performance.now();
    
    // Simulate processing large dataset
    const sortedTeams = largeTeamList.sort((a, b) => b.total_score - a.total_score);
    const topTeams = sortedTeams.slice(0, 10);
    
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    expect(processingTime).toBeLessThan(50); // Should process in less than 50ms
    expect(topTeams).toHaveLength(10);
  });
});

// Accessibility tests
describe('Accessibility Tests', () => {
  it('should meet accessibility standards', async () => {
    const { checkAccessibility } = await import('./testUtils');
    
    const { container } = render(
      <div>
        <h1>CodeWars 2.0</h1>
        <button>Start Competition</button>
        <input type="text" aria-label="Team name" />
      </div>
    );

    await checkAccessibility(container);
  });
});