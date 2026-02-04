// AI Evaluation System for CodeWars 2.0
// Supports OpenAI GPT and Google Gemini APIs for code evaluation

import { supabase } from "@/integrations/supabase/client";
import { mockAIEvaluator } from "./mockAI";

// Types for AI evaluation
export interface EvaluationRequest {
  question: string;
  constraints: string[];
  userCode: string;
  testCases: Array<{
    input: string;
    expected_output: string;
  }>;
  evaluationCriteria: string;
}

export interface EvaluationResponse {
  isCorrect: boolean;
  score: number;
  points: number; // Actual points awarded based on round
  feedback: string;
  reasoning: string;
  constraintViolations: string[];
  executionResult: {
    passed: boolean;
    output?: string;
    error?: string;
  };
}

export interface AIEvaluationLog {
  id?: string;
  team_id: string;
  question_id: string;
  round_number: number;
  user_code: string;
  ai_provider: 'openai' | 'gemini';
  ai_response: string;
  evaluation_result: EvaluationResponse;
  created_at?: string;
}

// OpenAI API Configuration
class OpenAIEvaluator {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }
  }

  async evaluateCode(request: EvaluationRequest): Promise<EvaluationResponse> {
    const prompt = this.buildEvaluationPrompt(request);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a code evaluation expert. Analyze the provided code against constraints and test cases. Respond with a JSON object containing: isCorrect (boolean), score (0-100), feedback (string), reasoning (string), constraintViolations (array of strings), and executionResult (object with passed boolean and optional output/error strings).'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('No response from OpenAI API');
      }

      return this.parseAIResponse(aiResponse);

    } catch (error) {
      console.error('OpenAI evaluation error:', error);
      throw error;
    }
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `
You are an expert code evaluator. Evaluate the following submission regardless of programming language, complexity, or format. Your job is to determine if the solution is correct.

**Question:** ${request.question}

**Constraints:**
${request.constraints.map(c => `- ${c}`).join('\n')}

**User Submission:**
\`\`\`
${request.userCode}
\`\`\`

**Test Cases:**
${request.testCases.map((tc, i) => `
Test Case ${i + 1}:
Input: ${tc.input}
Expected Output: ${tc.expected_output}
`).join('\n')}

**Evaluation Criteria:** ${request.evaluationCriteria}

IMPORTANT INSTRUCTIONS:
- Evaluate ANY programming language (JavaScript, Python, Java, C++, C#, Go, Rust, etc.)
- Evaluate pseudocode, natural language descriptions, or algorithm explanations
- Focus on correctness of logic and approach, not syntax perfection
- If the solution demonstrates understanding and would work with minor fixes, consider it correct
- Be lenient with syntax errors if the logic is sound
- Evaluate complex algorithms, data structures, and advanced concepts
- Always provide constructive feedback

Respond with ONLY a JSON object containing:
{
  "isCorrect": boolean,
  "score": number (0-100),
  "feedback": "detailed feedback string",
  "reasoning": "explanation of evaluation",
  "constraintViolations": ["array of violations if any"],
  "executionResult": {
    "passed": boolean,
    "output": "expected output or explanation",
    "error": "error description if any"
  }
}
    `.trim();
  }

  private parseAIResponse(response: string): EvaluationResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        isCorrect: Boolean(parsed.isCorrect),
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        points: 0, // Will be calculated in evaluateSubmission
        feedback: String(parsed.feedback || 'No feedback provided'),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        constraintViolations: Array.isArray(parsed.constraintViolations) 
          ? parsed.constraintViolations.map(String) 
          : [],
        executionResult: {
          passed: Boolean(parsed.executionResult?.passed),
          output: parsed.executionResult?.output ? String(parsed.executionResult.output) : undefined,
          error: parsed.executionResult?.error ? String(parsed.executionResult.error) : undefined,
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        isCorrect: false,
        score: 0,
        points: 0,
        feedback: 'Failed to parse AI evaluation response',
        reasoning: 'AI response parsing error',
        constraintViolations: ['AI evaluation failed'],
        executionResult: {
          passed: false,
          error: 'AI evaluation parsing failed'
        }
      };
    }
  }
}

// Gemini API Configuration
class GeminiEvaluator {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }
  }

  async evaluateCode(request: EvaluationRequest): Promise<EvaluationResponse> {
    const prompt = this.buildEvaluationPrompt(request);
    
    try {
      const response = await fetch(`${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!aiResponse) {
        throw new Error('No response from Gemini API');
      }

      return this.parseAIResponse(aiResponse);

    } catch (error) {
      console.error('Gemini evaluation error:', error);
      throw error;
    }
  }

  private buildEvaluationPrompt(request: EvaluationRequest): string {
    return `
You are an expert code evaluator. Evaluate the following submission regardless of programming language, complexity, or format. Your job is to determine if the solution is correct.

**Question:** ${request.question}

**Constraints:**
${request.constraints.map(c => `- ${c}`).join('\n')}

**User Submission:**
\`\`\`
${request.userCode}
\`\`\`

**Test Cases:**
${request.testCases.map((tc, i) => `
Test Case ${i + 1}:
Input: ${tc.input}
Expected Output: ${tc.expected_output}
`).join('\n')}

**Evaluation Criteria:** ${request.evaluationCriteria}

IMPORTANT INSTRUCTIONS:
- Evaluate ANY programming language (JavaScript, Python, Java, C++, C#, Go, Rust, etc.)
- Evaluate pseudocode, natural language descriptions, or algorithm explanations
- Focus on correctness of logic and approach, not syntax perfection
- If the solution demonstrates understanding and would work with minor fixes, consider it correct
- Be lenient with syntax errors if the logic is sound
- Evaluate complex algorithms, data structures, and advanced concepts
- Always provide constructive feedback

Respond with ONLY a JSON object containing:
{
  "isCorrect": boolean,
  "score": number (0-100),
  "feedback": "detailed feedback string",
  "reasoning": "explanation of evaluation",
  "constraintViolations": ["array of violations if any"],
  "executionResult": {
    "passed": boolean,
    "output": "expected output or explanation",
    "error": "error description if any"
  }
}
    `.trim();
  }

  private parseAIResponse(response: string): EvaluationResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        isCorrect: Boolean(parsed.isCorrect),
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        points: 0, // Will be calculated in evaluateSubmission
        feedback: String(parsed.feedback || 'No feedback provided'),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        constraintViolations: Array.isArray(parsed.constraintViolations) 
          ? parsed.constraintViolations.map(String) 
          : [],
        executionResult: {
          passed: Boolean(parsed.executionResult?.passed),
          output: parsed.executionResult?.output ? String(parsed.executionResult.output) : undefined,
          error: parsed.executionResult?.error ? String(parsed.executionResult.error) : undefined,
        }
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return {
        isCorrect: false,
        score: 0,
        points: 0,
        feedback: 'Failed to parse AI evaluation response',
        reasoning: 'AI response parsing error',
        constraintViolations: ['AI evaluation failed'],
        executionResult: {
          passed: false,
          error: 'AI evaluation parsing failed'
        }
      };
    }
  }
}

// Main AI Evaluation Service
export class AIEvaluationService {
  private openaiEvaluator: OpenAIEvaluator | null = null;
  private geminiEvaluator: GeminiEvaluator | null = null;
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    try {
      this.openaiEvaluator = new OpenAIEvaluator();
    } catch (error) {
      console.warn('OpenAI evaluator not available:', error);
    }

    try {
      this.geminiEvaluator = new GeminiEvaluator();
    } catch (error) {
      console.warn('Gemini evaluator not available:', error);
    }

    if (!this.openaiEvaluator && !this.geminiEvaluator) {
      throw new Error('No AI evaluators available. Please configure API keys.');
    }
  }

  async evaluateSubmission(
    teamId: string,
    questionId: string,
    roundNumber: number,
    request: EvaluationRequest,
    questionWeightage?: number // For Round 2 variable scoring
  ): Promise<EvaluationResponse> {
    let lastError: Error | null = null;
    
    // Try Gemini first (free), then fallback to OpenAI, then mock AI
    const evaluators = [
      { evaluator: this.geminiEvaluator, provider: 'gemini' as const },
      { evaluator: this.openaiEvaluator, provider: 'openai' as const },
      { evaluator: mockAIEvaluator, provider: 'mock' as const }
    ].filter(e => e.evaluator !== null);

    for (const { evaluator, provider } of evaluators) {
      for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
        try {
          console.log(`Attempting evaluation with ${provider} (attempt ${attempt})`);
          
          const result = await evaluator!.evaluateCode(request);
          
          // Calculate points based on round
          let points = 0;
          switch (roundNumber) {
            case 1:
              // Round 1: 10 points per correct answer, no negative marking
              points = result.isCorrect ? 10 : 0;
              break;
            case 2:
              // Round 2: Variable points for correct, -10 for incorrect
              points = result.isCorrect ? (questionWeightage || 0) : -10;
              break;
            case 3:
              // Round 3: Points handled separately in Jeopardy system
              points = result.score; // Use existing Jeopardy scoring
              break;
            default:
              points = result.isCorrect ? result.score : 0;
          }
          
          const finalResult = {
            ...result,
            points
          };
          
          // Log the evaluation
          await this.logEvaluation({
            team_id: teamId,
            question_id: questionId,
            round_number: roundNumber,
            user_code: request.userCode,
            ai_provider: provider,
            ai_response: JSON.stringify(finalResult),
            evaluation_result: finalResult
          });

          return finalResult;

        } catch (error) {
          lastError = error as Error;
          console.error(`${provider} evaluation attempt ${attempt} failed:`, error);
          
          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelay * attempt);
          }
        }
      }
    }

    // If all evaluators fail, return a default failure response
    const fallbackResult: EvaluationResponse = {
      isCorrect: false,
      score: 0,
      points: 0,
      feedback: 'AI evaluation service temporarily unavailable. Please try again later.',
      reasoning: `All AI evaluators failed. Last error: ${lastError?.message}`,
      constraintViolations: ['AI evaluation failed'],
      executionResult: {
        passed: false,
        error: 'AI evaluation service unavailable'
      }
    };

    // Log the failure
    await this.logEvaluation({
      team_id: teamId,
      question_id: questionId,
      round_number: roundNumber,
      user_code: request.userCode,
      ai_provider: 'openai', // Default for logging
      ai_response: JSON.stringify(fallbackResult),
      evaluation_result: fallbackResult
    });

    return fallbackResult;
  }

  private async logEvaluation(log: AIEvaluationLog): Promise<void> {
    try {
      // Get round ID for the log
      const { data: roundData, error: roundError } = await supabase
        .from("rounds")
        .select("id")
        .eq("round_number", log.round_number)
        .single();

      if (roundError) {
        console.error('Failed to get round ID for AI evaluation log:', roundError);
        return;
      }

      const { error } = await supabase
        .from('ai_evaluation_log')
        .insert({
          team_id: log.team_id,
          question_id: log.question_id, // Now TEXT instead of UUID
          round_id: roundData.id,
          question_text: log.evaluation_result.feedback, // Store question text
          team_answer: log.user_code,
          ai_provider: log.ai_provider,
          ai_prompt: `Question: ${log.question_id}`, // Simplified prompt
          ai_response: log.ai_response,
          ai_score: log.evaluation_result.isCorrect ? 1 : 0,
          evaluation_time_ms: null, // Could be added later if needed
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to log AI evaluation:', error);
      }
    } catch (error) {
      console.error('Error logging AI evaluation:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check for AI services
  async checkAPIHealth(): Promise<{
    openai: boolean;
    gemini: boolean;
    available: boolean;
  }> {
    const testRequest: EvaluationRequest = {
      question: "Write a function that returns 'Hello World'",
      constraints: ["No constraints"],
      userCode: "function hello() { return 'Hello World'; }",
      testCases: [{ input: "", expected_output: "Hello World" }],
      evaluationCriteria: "Function should return 'Hello World'"
    };

    const health = {
      openai: false,
      gemini: false,
      available: false
    };

    // Test OpenAI
    if (this.openaiEvaluator) {
      try {
        await this.openaiEvaluator.evaluateCode(testRequest);
        health.openai = true;
      } catch (error) {
        console.warn('OpenAI health check failed:', error);
      }
    }

    // Test Gemini
    if (this.geminiEvaluator) {
      try {
        await this.geminiEvaluator.evaluateCode(testRequest);
        health.gemini = true;
      } catch (error) {
        console.warn('Gemini health check failed:', error);
      }
    }

    health.available = health.openai || health.gemini;
    return health;
  }

  // Get evaluation statistics
  async getEvaluationStats(teamId?: string): Promise<{
    totalEvaluations: number;
    successRate: number;
    averageScore: number;
    providerUsage: Record<string, number>;
  }> {
    try {
      let query = supabase
        .from('ai_evaluation_log')
        .select('ai_provider, evaluation_result');

      if (teamId) {
        query = query.eq('team_id', teamId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const stats = {
        totalEvaluations: data.length,
        successRate: 0,
        averageScore: 0,
        providerUsage: {} as Record<string, number>
      };

      if (data.length > 0) {
        const successfulEvaluations = data.filter(d => d.evaluation_result?.isCorrect).length;
        stats.successRate = (successfulEvaluations / data.length) * 100;

        const totalScore = data.reduce((sum, d) => sum + (d.evaluation_result?.score || 0), 0);
        stats.averageScore = totalScore / data.length;

        stats.providerUsage = data.reduce((acc, d) => {
          acc[d.ai_provider] = (acc[d.ai_provider] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }

      return stats;
    } catch (error) {
      console.error('Error getting evaluation stats:', error);
      return {
        totalEvaluations: 0,
        successRate: 0,
        averageScore: 0,
        providerUsage: {}
      };
    }
  }
}

// Export singleton instance
export const aiEvaluationService = new AIEvaluationService();