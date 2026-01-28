// Tests for AI Evaluation System
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIEvaluationService, EvaluationRequest, EvaluationResponse } from '@/lib/aiEvaluation';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock environment variables
vi.mock('import.meta.env', () => ({
  VITE_OPENAI_API_KEY: 'sk-test-key-123',
  VITE_GEMINI_API_KEY: 'gemini-test-key-123'
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null }))
    }))
  }
}));

describe('AIEvaluationService', () => {
  let aiService: AIEvaluationService;
  let mockRequest: EvaluationRequest;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    import.meta.env.VITE_OPENAI_API_KEY = 'sk-test-key-123';
    import.meta.env.VITE_GEMINI_API_KEY = 'gemini-test-key-123';
    
    aiService = new AIEvaluationService();
    
    mockRequest = {
      question: "Write a function to reverse a string without using built-in methods",
      constraints: ["No using reverse() method", "No using loops"],
      userCode: "function reverseString(str) { return str.split('').reverse().join(''); }",
      testCases: [
        { input: "hello", expected_output: "olleh" },
        { input: "world", expected_output: "dlrow" }
      ],
      evaluationCriteria: "Function should reverse string without violating constraints"
    };
  });

  describe('OpenAI Integration', () => {
    it('should successfully evaluate code with OpenAI', async () => {
      const mockResponse = {
        isCorrect: false,
        score: 30,
        feedback: "Code violates the constraint by using reverse() method",
        reasoning: "The solution uses the built-in reverse() method which is explicitly forbidden",
        constraintViolations: ["Uses reverse() method"],
        executionResult: {
          passed: true,
          output: "olleh"
        }
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify(mockResponse)
            }
          }]
        })
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(30);
      expect(result.constraintViolations).toContain("Uses reverse() method");
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key-123'
          })
        })
      );
    });

    it('should handle OpenAI API errors gracefully', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Rate limit exceeded'
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.isCorrect).toBe(false);
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('temporarily unavailable');
    });

    it('should parse malformed JSON responses', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Invalid JSON response from AI'
            }
          }]
        })
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.isCorrect).toBe(false);
      expect(result.feedback).toContain('Failed to parse');
    });
  });

  describe('Gemini Integration', () => {
    it('should fallback to Gemini when OpenAI fails', async () => {
      // Mock OpenAI failure
      (fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'OpenAI Error'
        })
        // Mock Gemini success
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    isCorrect: true,
                    score: 85,
                    feedback: "Good solution using recursion",
                    reasoning: "Uses recursion to avoid loops and built-in methods",
                    constraintViolations: [],
                    executionResult: { passed: true, output: "olleh" }
                  })
                }]
              }
            }]
          })
        });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(85);
      expect(fetch).toHaveBeenCalledTimes(2); // OpenAI + Gemini
    });
  });

  describe('Evaluation Request Validation', () => {
    it('should handle empty constraints', async () => {
      const requestWithoutConstraints = {
        ...mockRequest,
        constraints: []
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                isCorrect: true,
                score: 100,
                feedback: "Perfect solution",
                reasoning: "No constraints to violate",
                constraintViolations: [],
                executionResult: { passed: true }
              })
            }
          }]
        })
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        requestWithoutConstraints
      );

      expect(result.isCorrect).toBe(true);
      expect(result.constraintViolations).toHaveLength(0);
    });

    it('should handle multiple test cases', async () => {
      const requestWithMultipleTests = {
        ...mockRequest,
        testCases: [
          { input: "hello", expected_output: "olleh" },
          { input: "world", expected_output: "dlrow" },
          { input: "a", expected_output: "a" },
          { input: "", expected_output: "" }
        ]
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                isCorrect: true,
                score: 95,
                feedback: "Handles all test cases correctly",
                reasoning: "Solution works for all edge cases",
                constraintViolations: [],
                executionResult: { passed: true }
              })
            }
          }]
        })
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        requestWithMultipleTests
      );

      expect(result.score).toBe(95);
    });
  });

  describe('Health Check', () => {
    it('should check API health correctly', async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"isCorrect": true, "score": 100}' } }]
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: '{"isCorrect": true, "score": 100}' }] } }]
          })
        });

      const health = await aiService.checkAPIHealth();

      expect(health.openai).toBe(true);
      expect(health.gemini).toBe(true);
      expect(health.available).toBe(true);
    });

    it('should handle API health check failures', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const health = await aiService.checkAPIHealth();

      expect(health.openai).toBe(false);
      expect(health.gemini).toBe(false);
      expect(health.available).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      (fetch as any)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{
              message: {
                content: JSON.stringify({
                  isCorrect: true,
                  score: 90,
                  feedback: "Success on retry",
                  reasoning: "Worked after retry",
                  constraintViolations: [],
                  executionResult: { passed: true }
                })
              }
            }]
          })
        });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.isCorrect).toBe(true);
      expect(result.score).toBe(90);
      expect(fetch).toHaveBeenCalledTimes(2); // Initial + retry
    });
  });

  describe('Score Validation', () => {
    it('should clamp scores to valid range', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                isCorrect: true,
                score: 150, // Invalid score > 100
                feedback: "Great work",
                reasoning: "Excellent solution",
                constraintViolations: [],
                executionResult: { passed: true }
              })
            }
          }]
        })
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.score).toBe(100); // Should be clamped to 100
    });

    it('should handle negative scores', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                isCorrect: false,
                score: -10, // Invalid negative score
                feedback: "Poor solution",
                reasoning: "Many issues",
                constraintViolations: ["Multiple violations"],
                executionResult: { passed: false }
              })
            }
          }]
        })
      });

      const result = await aiService.evaluateSubmission(
        'team-123',
        'question-456',
        2,
        mockRequest
      );

      expect(result.score).toBe(0); // Should be clamped to 0
    });
  });
});