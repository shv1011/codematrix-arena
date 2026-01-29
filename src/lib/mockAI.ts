// Mock AI Evaluator for Testing Without API Keys
// This provides a simple rule-based evaluation for testing your CodeWars 2.0 platform

import { EvaluationRequest, EvaluationResponse } from './aiEvaluation';

export class MockAIEvaluator {
  async evaluateCode(request: EvaluationRequest): Promise<EvaluationResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const code = request.userCode.toLowerCase();
    const question = request.question.toLowerCase();
    
    // Simple rule-based evaluation
    let score = 50; // Base score
    let isCorrect = false;
    let feedback = "Code submitted successfully.";
    let reasoning = "Mock evaluation based on simple rules.";
    let constraintViolations: string[] = [];

    // Check for common programming patterns
    if (code.includes('function') || code.includes('def ') || code.includes('public ')) {
      score += 20;
      feedback += " Function definition detected.";
    }

    if (code.includes('return')) {
      score += 15;
      feedback += " Return statement found.";
    }

    if (code.includes('if') || code.includes('for') || code.includes('while')) {
      score += 10;
      feedback += " Control structures used.";
    }

    // Check constraints violations (mock)
    for (const constraint of request.constraints) {
      const constraintLower = constraint.toLowerCase();
      
      if (constraintLower.includes('no using reverse') && code.includes('reverse')) {
        constraintViolations.push("Used reverse() method which is not allowed");
        score -= 30;
      }
      
      if (constraintLower.includes('no using loops') && (code.includes('for') || code.includes('while'))) {
        constraintViolations.push("Used loops which are not allowed");
        score -= 25;
      }
      
      if (constraintLower.includes('no using math.max') && code.includes('math.max')) {
        constraintViolations.push("Used Math.max() which is not allowed");
        score -= 20;
      }
    }

    // Determine if correct based on score and violations
    isCorrect = score >= 70 && constraintViolations.length === 0;
    
    // Adjust score based on violations
    score = Math.max(0, Math.min(100, score));

    // Generate more specific feedback
    if (constraintViolations.length > 0) {
      feedback += ` However, there are constraint violations: ${constraintViolations.join(', ')}.`;
      reasoning += " Code violates specified constraints.";
    } else if (score >= 80) {
      feedback += " Great job! Code looks well-structured.";
      reasoning += " Code follows good practices and meets requirements.";
    } else if (score >= 60) {
      feedback += " Good attempt, but could be improved.";
      reasoning += " Code is functional but may lack some best practices.";
    } else {
      feedback += " Code needs significant improvement.";
      reasoning += " Code may be incomplete or have logical issues.";
    }

    return {
      isCorrect,
      score,
      feedback,
      reasoning,
      constraintViolations,
      executionResult: {
        passed: isCorrect,
        output: isCorrect ? "Mock execution successful" : undefined,
        error: !isCorrect ? "Mock execution failed" : undefined
      }
    };
  }
}

// Export for use in main AI service
export const mockAIEvaluator = new MockAIEvaluator();