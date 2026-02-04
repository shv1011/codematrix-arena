// Code Evaluation System for Rounds 2 & 3
// Safely executes and tests user code against test cases

export interface CodeEvaluationResult {
  isCorrect: boolean;
  points: number;
  feedback: string;
  testResults: Array<{
    input: string;
    expected: string;
    actual: string;
    passed: boolean;
  }>;
  executionError?: string;
}

export interface TestCase {
  input: string;
  expected_output: string;
}

export class CodeEvaluator {
  // Evaluate JavaScript code safely
  static evaluateJavaScript(
    userCode: string,
    testCases: TestCase[],
    points: number,
    functionName?: string
  ): CodeEvaluationResult {
    try {
      if (!userCode.trim()) {
        return {
          isCorrect: false,
          points: 0,
          feedback: "Please provide your code solution.",
          testResults: []
        };
      }

      // Basic security check - prevent dangerous operations
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /setTimeout\s*\(/,
        /setInterval\s*\(/,
        /XMLHttpRequest/,
        /fetch\s*\(/,
        /import\s+/,
        /require\s*\(/,
        /process\./,
        /global\./,
        /window\./,
        /document\./,
        /localStorage/,
        /sessionStorage/,
        /console\.log/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(userCode)) {
          return {
            isCorrect: false,
            points: 0,
            feedback: "Code contains restricted operations. Please use only basic JavaScript.",
            testResults: []
          };
        }
      }

      const testResults: Array<{
        input: string;
        expected: string;
        actual: string;
        passed: boolean;
      }> = [];

      let passedTests = 0;

      // Execute code and run test cases
      for (const testCase of testCases) {
        try {
          // Create a safe execution environment
          const safeCode = `
            ${userCode}
            
            // Try to find and execute the function
            let result;
            try {
              ${this.generateFunctionCall(userCode, testCase.input)}
            } catch (e) {
              throw new Error('Function execution failed: ' + e.message);
            }
            result;
          `;

          // Execute in a limited scope
          const result = this.safeEval(safeCode);
          const actualOutput = String(result);
          const expectedOutput = testCase.expected_output;
          const passed = actualOutput === expectedOutput;

          testResults.push({
            input: testCase.input,
            expected: expectedOutput,
            actual: actualOutput,
            passed
          });

          if (passed) passedTests++;

        } catch (error) {
          testResults.push({
            input: testCase.input,
            expected: testCase.expected_output,
            actual: `Error: ${error.message}`,
            passed: false
          });
        }
      }

      const isCorrect = passedTests === testCases.length;
      const earnedPoints = isCorrect ? points : Math.floor((passedTests / testCases.length) * points * 0.5);

      return {
        isCorrect,
        points: earnedPoints,
        feedback: isCorrect 
          ? `Perfect! All ${testCases.length} test cases passed. Earned ${points} points.`
          : `${passedTests}/${testCases.length} test cases passed. Earned ${earnedPoints} points.`,
        testResults
      };

    } catch (error) {
      return {
        isCorrect: false,
        points: 0,
        feedback: `Code evaluation error: ${error.message}`,
        testResults: [],
        executionError: error.message
      };
    }
  }

  // Generate function call based on the code structure
  private static generateFunctionCall(code: string, input: string): string {
    // Try to detect function name from common patterns
    const functionPatterns = [
      /function\s+(\w+)\s*\(/,
      /const\s+(\w+)\s*=\s*\(/,
      /let\s+(\w+)\s*=\s*\(/,
      /var\s+(\w+)\s*=\s*\(/,
      /(\w+)\s*=\s*\(/
    ];

    let functionName = null;
    for (const pattern of functionPatterns) {
      const match = code.match(pattern);
      if (match) {
        functionName = match[1];
        break;
      }
    }

    if (functionName) {
      // Try to parse input - handle different input formats
      let parsedInput;
      try {
        // Handle array inputs like "[1,2,3]"
        if (input.startsWith('[') && input.endsWith(']')) {
          parsedInput = input;
        }
        // Handle string inputs
        else if (input.startsWith('"') || input.startsWith("'")) {
          parsedInput = input;
        }
        // Handle numeric inputs
        else if (!isNaN(Number(input))) {
          parsedInput = input;
        }
        // Default to string
        else {
          parsedInput = `"${input}"`;
        }
      } catch (e) {
        parsedInput = `"${input}"`;
      }

      return `result = ${functionName}(${parsedInput});`;
    } else {
      // If no function found, try to execute the code directly
      return `result = (${code})(${input});`;
    }
  }

  // Safe evaluation with limited scope
  private static safeEval(code: string): any {
    // Create a very limited execution context
    const context = {
      Math: Math,
      String: String,
      Number: Number,
      Array: Array,
      Object: Object,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite
    };

    try {
      // Create function with limited scope
      const func = new Function(...Object.keys(context), `
        "use strict";
        ${code}
      `);

      // Execute with limited context
      return func(...Object.values(context));
    } catch (error) {
      throw new Error(`Execution error: ${error.message}`);
    }
  }

  // Evaluate Python code (basic implementation)
  static evaluatePython(
    userCode: string,
    testCases: TestCase[],
    points: number
  ): CodeEvaluationResult {
    // For now, return a placeholder - in a real system you'd use a Python executor
    return {
      isCorrect: false,
      points: 0,
      feedback: "Python evaluation not yet implemented. Please use JavaScript for now.",
      testResults: []
    };
  }

  // Auto-detect language and evaluate
  static evaluateCode(
    userCode: string,
    testCases: TestCase[],
    points: number,
    language?: string
  ): CodeEvaluationResult {
    const detectedLanguage = language || this.detectLanguage(userCode);
    
    switch (detectedLanguage) {
      case 'javascript':
        return this.evaluateJavaScript(userCode, testCases, points);
      case 'python':
        return this.evaluatePython(userCode, testCases, points);
      default:
        return this.evaluateJavaScript(userCode, testCases, points);
    }
  }

  // Simple language detection
  private static detectLanguage(code: string): string {
    if (code.includes('def ') || code.includes('import ') || code.includes('print(')) {
      return 'python';
    }
    return 'javascript';
  }
}