// Testing utilities and helpers for CodeWars 2.0

import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';

// Mock data generators
export const mockTeam = (overrides: Partial<any> = {}) => ({
  id: 'team-123',
  team_name: 'Test Team',
  team_code: 'TEST123',
  leader_email: 'test@example.com',
  round1_score: 100,
  round2_score: 200,
  round3_score: 300,
  total_score: 600,
  is_active: true,
  is_disqualified: false,
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
});

export const mockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  role: 'user',
  created_at: '2024-01-01T00:00:00Z',
  ...overrides
});

export const mockQuestion = (overrides: Partial<any> = {}) => ({
  id: 1,
  question: 'What is the time complexity of binary search?',
  options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
  correct_answer: 1,
  points: 10,
  category: 'Algorithms',
  difficulty: 'easy',
  explanation: 'Binary search has O(log n) time complexity.',
  ...overrides
});

export const mockSubmission = (overrides: Partial<any> = {}) => ({
  id: 'submission-123',
  team_id: 'team-123',
  question_id: '1',
  round_number: 1,
  answer: 'O(log n)',
  is_correct: true,
  points_earned: 10,
  submitted_at: '2024-01-01T00:00:00Z',
  ...overrides
});

export const mockGameState = (overrides: Partial<any> = {}) => ({
  id: 1,
  current_round: 1,
  is_competition_active: true,
  competition_status: 'active',
  competition_name: 'CodeWars 2.0',
  round_start_time: '2024-01-01T00:00:00Z',
  ...overrides
});

export const mockAIEvaluation = (overrides: Partial<any> = {}) => ({
  isCorrect: true,
  score: 85,
  feedback: 'Good solution with proper logic.',
  reasoning: 'The code correctly implements the required algorithm.',
  constraintViolations: [],
  executionResult: {
    passed: true,
    output: 'Expected output'
  },
  ...overrides
});

// Mock Supabase client
export const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockResolvedValue({ data: [], error: null })
  })),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: mockUser() }, error: null }),
    signIn: jest.fn().mockResolvedValue({ data: { user: mockUser() }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } })
  },
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
  })),
  realtime: {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onError: jest.fn()
  }
};

// Mock fetch for API calls
export const mockFetch = (response: any, ok: boolean = true) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(response),
    text: jest.fn().mockResolvedValue(JSON.stringify(response))
  });
};

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      })
    },
    writable: true
  });
  
  return store;
};

// Mock timers
export const mockTimers = () => {
  jest.useFakeTimers();
  return {
    advanceTime: (ms: number) => jest.advanceTimersByTime(ms),
    runAllTimers: () => jest.runAllTimers(),
    restore: () => jest.useRealTimers()
  };
};

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Test helpers
export const waitForLoadingToFinish = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

export const createMockEvent = (type: string, properties: any = {}) => {
  const event = new Event(type);
  Object.assign(event, properties);
  return event;
};

export const mockConsole = () => {
  const originalConsole = { ...console };
  
  beforeEach(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};

// Performance testing helpers
export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const start = performance.now();
  renderFn();
  await waitForLoadingToFinish();
  const end = performance.now();
  return end - start;
};

export const expectRenderTimeToBeLessThan = async (
  renderFn: () => void,
  maxTime: number
): Promise<void> => {
  const renderTime = await measureRenderTime(renderFn);
  expect(renderTime).toBeLessThan(maxTime);
};

// Accessibility testing helpers
export const checkAccessibility = async (container: HTMLElement) => {
  const { axe, toHaveNoViolations } = await import('jest-axe');
  expect.extend(toHaveNoViolations);
  
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// Mock intersection observer
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
  
  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: mockResizeObserver,
  });
};

// Mock matchMedia
export const mockMatchMedia = (matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Database testing helpers
export const createTestDatabase = () => {
  const tables: Record<string, any[]> = {
    teams: [],
    users: [],
    questions: [],
    submissions: [],
    game_state: [mockGameState()]
  };
  
  return {
    insert: (table: string, data: any) => {
      if (!tables[table]) tables[table] = [];
      const item = { ...data, id: `${table}-${tables[table].length + 1}` };
      tables[table].push(item);
      return item;
    },
    
    select: (table: string, filter?: (item: any) => boolean) => {
      if (!tables[table]) return [];
      return filter ? tables[table].filter(filter) : [...tables[table]];
    },
    
    update: (table: string, id: string, updates: any) => {
      if (!tables[table]) return null;
      const index = tables[table].findIndex(item => item.id === id);
      if (index === -1) return null;
      tables[table][index] = { ...tables[table][index], ...updates };
      return tables[table][index];
    },
    
    delete: (table: string, id: string) => {
      if (!tables[table]) return false;
      const index = tables[table].findIndex(item => item.id === id);
      if (index === -1) return false;
      tables[table].splice(index, 1);
      return true;
    },
    
    clear: (table?: string) => {
      if (table) {
        tables[table] = [];
      } else {
        Object.keys(tables).forEach(key => {
          tables[key] = [];
        });
      }
    },
    
    getTables: () => ({ ...tables })
  };
};

// Integration test helpers
export const setupIntegrationTest = () => {
  const testDb = createTestDatabase();
  
  // Add some default test data
  testDb.insert('teams', mockTeam());
  testDb.insert('users', mockUser());
  testDb.insert('questions', mockQuestion());
  
  return {
    db: testDb,
    cleanup: () => testDb.clear()
  };
};

// Mock environment variables
export const mockEnvVars = (vars: Record<string, string>) => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv, ...vars };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
};

// Snapshot testing helpers
export const createSnapshot = (component: ReactElement, name?: string) => {
  const { container } = render(component);
  expect(container.firstChild).toMatchSnapshot(name);
};

// Mock API responses
export const mockApiResponse = (endpoint: string, response: any, delay: number = 0) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(response);
    }, delay);
  });
};

// Test data factories
export const createTeams = (count: number) => {
  return Array.from({ length: count }, (_, i) => mockTeam({
    id: `team-${i + 1}`,
    team_name: `Team ${i + 1}`,
    team_code: `TEAM${i + 1}`,
    total_score: Math.floor(Math.random() * 1000)
  }));
};

export const createQuestions = (count: number, round: number = 1) => {
  return Array.from({ length: count }, (_, i) => mockQuestion({
    id: i + 1,
    question: `Question ${i + 1} for Round ${round}`,
    points: (i + 1) * 10
  }));
};

export const createSubmissions = (teamId: string, questionIds: number[]) => {
  return questionIds.map(questionId => mockSubmission({
    team_id: teamId,
    question_id: questionId.toString(),
    is_correct: Math.random() > 0.3, // 70% correct rate
    points_earned: Math.random() > 0.3 ? 10 : 0
  }));
};

// Export commonly used mocks
export {
  mockSupabaseClient,
  mockFetch,
  mockLocalStorage,
  mockTimers,
  mockIntersectionObserver,
  mockResizeObserver,
  mockMatchMedia
};