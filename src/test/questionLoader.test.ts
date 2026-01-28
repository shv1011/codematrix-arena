// Test file for question loader functionality
import { describe, it, expect } from 'vitest';
import { QuestionLoader } from '@/lib/questionLoader';

describe('QuestionLoader', () => {
  it('should load Round 1 questions successfully', async () => {
    const data = await QuestionLoader.loadRound1Questions();
    
    expect(data.round_info.round_number).toBe(1);
    expect(data.round_info.round_name).toBe('Aptitude Arena');
    expect(data.questions).toBeInstanceOf(Array);
    expect(data.questions.length).toBeGreaterThan(0);
    
    // Test first question structure
    const firstQuestion = data.questions[0];
    expect(firstQuestion).toHaveProperty('id');
    expect(firstQuestion).toHaveProperty('question');
    expect(firstQuestion).toHaveProperty('options');
    expect(firstQuestion).toHaveProperty('correct_answer');
    expect(firstQuestion.options.length).toBeGreaterThanOrEqual(2);
  });

  it('should load Round 2 questions successfully', async () => {
    const data = await QuestionLoader.loadRound2Questions();
    
    expect(data.round_info.round_number).toBe(2);
    expect(data.round_info.round_name).toBe('Constraint Paradox');
    expect(data.questions).toBeInstanceOf(Array);
    expect(data.questions.length).toBeGreaterThan(0);
    
    // Test first question structure
    const firstQuestion = data.questions[0];
    expect(firstQuestion).toHaveProperty('id');
    expect(firstQuestion).toHaveProperty('question');
    expect(firstQuestion).toHaveProperty('constraints');
    expect(firstQuestion).toHaveProperty('test_cases');
    expect(firstQuestion.constraints.length).toBeGreaterThan(0);
  });

  it('should load Round 3 questions successfully', async () => {
    const data = await QuestionLoader.loadRound3Questions();
    
    expect(data.round_info.round_number).toBe(3);
    expect(data.round_info.round_name).toBe('Code Jeopardy');
    expect(data.categories).toBeDefined();
    
    const categoryKeys = Object.keys(data.categories);
    expect(categoryKeys.length).toBe(7); // 7 categories for 7x5 grid
    
    // Test first category structure
    const firstCategory = data.categories[categoryKeys[0]];
    expect(firstCategory).toHaveProperty('name');
    expect(firstCategory).toHaveProperty('questions');
    expect(firstCategory.questions.length).toBe(5); // 5 difficulty levels
  });

  it('should convert Round 3 data to grid format', async () => {
    const data = await QuestionLoader.loadRound3Questions();
    const grid = QuestionLoader.convertRound3ToGrid(data);
    
    expect(grid.length).toBe(5); // 5 rows (difficulty levels)
    expect(grid[0].length).toBe(7); // 7 columns (categories)
    
    // Test grid structure
    const firstQuestion = grid[0][0];
    expect(firstQuestion).toHaveProperty('points');
    expect(firstQuestion).toHaveProperty('reward');
    expect(firstQuestion).toHaveProperty('category');
  });

  it('should handle cache correctly', async () => {
    // Clear cache first
    QuestionLoader.clearCache();
    
    let cacheStatus = QuestionLoader.getCacheStatus();
    expect(cacheStatus.round1).toBe(false);
    
    // Load questions (should cache them)
    await QuestionLoader.loadRound1Questions();
    
    cacheStatus = QuestionLoader.getCacheStatus();
    expect(cacheStatus.round1).toBe(true);
    
    // Clear cache again
    QuestionLoader.clearCache();
    cacheStatus = QuestionLoader.getCacheStatus();
    expect(cacheStatus.round1).toBe(false);
  });

  it('should get questions for specific round', async () => {
    const round1Data = await QuestionLoader.getQuestionsForRound(1);
    expect(round1Data.round_info.round_number).toBe(1);
    
    const round2Data = await QuestionLoader.getQuestionsForRound(2);
    expect(round2Data.round_info.round_number).toBe(2);
    
    const round3Data = await QuestionLoader.getQuestionsForRound(3);
    expect(round3Data.round_info.round_number).toBe(3);
  });

  it('should throw error for invalid round number', async () => {
    await expect(QuestionLoader.getQuestionsForRound(4)).rejects.toThrow('Invalid round number: 4');
  });
});