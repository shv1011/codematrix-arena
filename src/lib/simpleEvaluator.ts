import { CodeEvaluator, CodeEvaluationResult, TestCase } from "./codeEvaluator";

// Simple answer evaluator for basic questions
// Handles math questions, MCQ, and delegates coding to CodeEvaluator

export interface SimpleEvaluationResult {
  isCorrect: boolean;
  points: number;
  feedback: string;
  testResults?: Array<{
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
}

export class SimpleEvaluator {
  // Evaluate MCQ answers
  static evaluateMCQ(
    selectedAnswer: string,
    correctAnswerIndex: number,
    options: string[],
    points: number
  ): SimpleEvaluationResult {
    const selectedIndex = options.indexOf(selectedAnswer);
    const isCorrect = selectedIndex === correctAnswerIndex;
    
    return {
      isCorrect,
      points: isCorrect ? points : 0,
      feedback: isCorrect 
        ? "Correct answer!" 
        : `Incorrect. The correct answer was: ${options[correctAnswerIndex]}`
    };
  }

  // Evaluate simple math questions
  static evaluateMath(
    userAnswer: string,
    questionText: string,
    points: number
  ): SimpleEvaluationResult {
    try {
      const cleanAnswer = userAnswer.trim().toLowerCase();
      const cleanQuestion = questionText.toLowerCase();
      
      // Extract math expression from question like "What is 4+5?"
      if (cleanQuestion.includes("what is") && cleanQuestion.includes("?")) {
        const mathExpression = cleanQuestion
          .replace("what is", "")
          .replace("?", "")
          .trim()
          .replace(/\s+/g, ""); // Remove spaces
        
        // Simple math evaluation (only allow basic operations)
        if (/^[\d+\-*/().\s]+$/.test(mathExpression)) {
          const expectedAnswer = eval(mathExpression).toString();
          const isCorrect = cleanAnswer === expectedAnswer;
          
          return {
            isCorrect,
            points: isCorrect ? points : 0,
            feedback: isCorrect 
              ? `Correct! ${mathExpression} = ${expectedAnswer}` 
              : `Incorrect. ${mathExpression} = ${expectedAnswer}, but you answered ${userAnswer}`
          };
        }
      }
      
      // Fallback for other text questions
      return {
        isCorrect: false,
        points: 0,
        feedback: "Could not evaluate this answer automatically."
      };
      
    } catch (error) {
      console.error("Math evaluation error:", error);
      return {
        isCorrect: false,
        points: 0,
        feedback: "Error evaluating answer."
      };
    }
  }

  // Evaluate coding questions (Round 2 & 3) with proper code execution
  static evaluateCode(
    userCode: string,
    testCases: TestCase[],
    points: number
  ): SimpleEvaluationResult {
    try {
      const result = CodeEvaluator.evaluateCode(userCode, testCases, points);
      
      return {
        isCorrect: result.isCorrect,
        points: result.points,
        feedback: result.feedback,
        testResults: result.testResults
      };
      
    } catch (error) {
      console.error("Code evaluation error:", error);
      return {
        isCorrect: false,
        points: 0,
        feedback: "Error evaluating code solution."
      };
    }
  }

  // Evaluate text answers with simple comparison
  static evaluateText(
    userAnswer: string,
    expectedAnswer: string,
    points: number,
    caseSensitive: boolean = false
  ): SimpleEvaluationResult {
    const userClean = caseSensitive ? userAnswer.trim() : userAnswer.trim().toLowerCase();
    const expectedClean = caseSensitive ? expectedAnswer.trim() : expectedAnswer.trim().toLowerCase();
    
    const isCorrect = userClean === expectedClean;
    
    return {
      isCorrect,
      points: isCorrect ? points : 0,
      feedback: isCorrect 
        ? "Correct answer!" 
        : `Incorrect. Expected: ${expectedAnswer}, but you answered: ${userAnswer}`
    };
  }
}