// Question loading and validation utilities for CodeWars 2.0

// Type definitions for question structures
export interface Round1Question {
  id: number;
  question: string;
  options: string[];
  correct_answer: number;
  points: number;
  category: string;
  difficulty: string;
  explanation?: string;
}

export interface Round1Data {
  round_info: {
    round_number: number;
    round_name: string;
    round_type: string;
    time_limit_seconds: number;
    total_questions: number;
    description: string;
  };
  questions: Round1Question[];
}

export interface Round2Question {
  id: number;
  question: string;
  constraints: string[];
  sample_input: string;
  sample_output: string;
  points: number;
  category: string;
  difficulty: string;
  test_cases: Array<{
    input: string;
    expected_output: string;
  }>;
  evaluation_criteria: string;
}

export interface Round2Data {
  round_info: {
    round_number: number;
    round_name: string;
    round_type: string;
    time_limit_seconds: number;
    total_questions: number;
    description: string;
  };
  questions: Round2Question[];
}

export interface JeopardyQuestion {
  points: number;
  reward: number;
  difficulty: string;
  question: string;
  sample_input: string;
  sample_output: string;
  test_cases: Array<{
    input: string;
    expected_output: string;
  }>;
}

export interface Round3Data {
  round_info: {
    round_number: number;
    round_name: string;
    round_type: string;
    time_limit_seconds: number;
    grid_size: string;
    description: string;
  };
  categories: Record<string, {
    name: string;
    questions: JeopardyQuestion[];
  }>;
}

// Question loader class
export class QuestionLoader {
  private static cache: Map<string, any> = new Map();

  // Load Round 1 questions
  static async loadRound1Questions(): Promise<Round1Data> {
    const cacheKey = 'round1_questions';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('/questions/round1_questions.json');
      if (!response.ok) {
        throw new Error(`Failed to load Round 1 questions: ${response.statusText}`);
      }
      
      const data: Round1Data = await response.json();
      this.validateRound1Data(data);
      
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error loading Round 1 questions:', error);
      throw error;
    }
  }

  // Load Round 2 questions
  static async loadRound2Questions(): Promise<Round2Data> {
    const cacheKey = 'round2_questions';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('/questions/round2_questions.json');
      if (!response.ok) {
        throw new Error(`Failed to load Round 2 questions: ${response.statusText}`);
      }
      
      const data: Round2Data = await response.json();
      this.validateRound2Data(data);
      
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error loading Round 2 questions:', error);
      throw error;
    }
  }

  // Load Round 3 questions
  static async loadRound3Questions(): Promise<Round3Data> {
    const cacheKey = 'round3_questions';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('/questions/round3_questions.json');
      if (!response.ok) {
        throw new Error(`Failed to load Round 3 questions: ${response.statusText}`);
      }
      
      const data: Round3Data = await response.json();
      this.validateRound3Data(data);
      
      this.cache.set(cacheKey, data);
      return data;
    } catch (error) {
      console.error('Error loading Round 3 questions:', error);
      throw error;
    }
  }

  // Validation functions
  private static validateRound1Data(data: Round1Data): void {
    if (!data.round_info || !data.questions) {
      throw new Error('Invalid Round 1 data structure');
    }

    if (data.round_info.round_number !== 1) {
      throw new Error('Round number mismatch for Round 1 data');
    }

    data.questions.forEach((question, index) => {
      if (!question.id || !question.question || !question.options || question.correct_answer === undefined) {
        throw new Error(`Invalid question structure at index ${index}`);
      }

      if (question.options.length < 2) {
        throw new Error(`Question ${question.id} must have at least 2 options`);
      }

      if (question.correct_answer < 0 || question.correct_answer >= question.options.length) {
        throw new Error(`Question ${question.id} has invalid correct_answer index`);
      }
    });
  }

  private static validateRound2Data(data: Round2Data): void {
    if (!data.round_info || !data.questions) {
      throw new Error('Invalid Round 2 data structure');
    }

    if (data.round_info.round_number !== 2) {
      throw new Error('Round number mismatch for Round 2 data');
    }

    data.questions.forEach((question, index) => {
      if (!question.id || !question.question || !question.constraints || !question.test_cases) {
        throw new Error(`Invalid question structure at index ${index}`);
      }

      if (question.constraints.length === 0) {
        throw new Error(`Question ${question.id} must have at least one constraint`);
      }

      if (question.test_cases.length === 0) {
        throw new Error(`Question ${question.id} must have at least one test case`);
      }
    });
  }

  private static validateRound3Data(data: Round3Data): void {
    if (!data.round_info || !data.categories) {
      throw new Error('Invalid Round 3 data structure');
    }

    if (data.round_info.round_number !== 3) {
      throw new Error('Round number mismatch for Round 3 data');
    }

    const categoryNames = Object.keys(data.categories);
    if (categoryNames.length !== 7) {
      throw new Error('Round 3 must have exactly 7 categories for 7x5 grid');
    }

    categoryNames.forEach(categoryKey => {
      const category = data.categories[categoryKey];
      if (!category.name || !category.questions) {
        throw new Error(`Invalid category structure for ${categoryKey}`);
      }

      if (category.questions.length !== 5) {
        throw new Error(`Category ${categoryKey} must have exactly 5 questions`);
      }

      category.questions.forEach((question, index) => {
        if (!question.points || !question.reward || !question.question) {
          throw new Error(`Invalid question structure in ${categoryKey} at index ${index}`);
        }
      });
    });
  }

  // Utility functions
  static clearCache(): void {
    this.cache.clear();
  }

  static getCacheStatus(): Record<string, boolean> {
    return {
      round1: this.cache.has('round1_questions'),
      round2: this.cache.has('round2_questions'),
      round3: this.cache.has('round3_questions'),
    };
  }

  // Get questions for a specific round
  static async getQuestionsForRound(roundNumber: number): Promise<Round1Data | Round2Data | Round3Data> {
    switch (roundNumber) {
      case 1:
        return this.loadRound1Questions();
      case 2:
        return this.loadRound2Questions();
      case 3:
        return this.loadRound3Questions();
      default:
        throw new Error(`Invalid round number: ${roundNumber}`);
    }
  }

  // Convert Round 3 data to grid format for Jeopardy component
  static convertRound3ToGrid(data: Round3Data): Array<Array<JeopardyQuestion & { category: string }>> {
    const categories = Object.keys(data.categories);
    const grid: Array<Array<JeopardyQuestion & { category: string }>> = [];

    // Create 5 rows (difficulty levels)
    for (let row = 0; row < 5; row++) {
      const gridRow: Array<JeopardyQuestion & { category: string }> = [];
      
      // Create 7 columns (categories)
      for (let col = 0; col < 7; col++) {
        const categoryKey = categories[col];
        const category = data.categories[categoryKey];
        const question = category.questions[row];
        
        gridRow.push({
          ...question,
          category: categoryKey,
        });
      }
      
      grid.push(gridRow);
    }

    return grid;
  }
}