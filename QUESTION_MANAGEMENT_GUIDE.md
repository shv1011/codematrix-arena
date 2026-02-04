# Question Management Guide - CodeWars 2.0

## System Overview

CodeWars 2.0 uses **JSON files** exclusively for storing and loading questions. The database schema has been simplified to remove the questions table, making the system more streamlined and reliable for competition use.

## JSON-Based Questions System

### How Questions Are Loaded

Questions are loaded from JSON files in the `public/questions/` directory:
- `round1_questions.json` - MCQ questions for Aptitude Arena
- `round2_questions.json` - Coding questions with constraints  
- `round3_questions.json` - Jeopardy-style questions

The enhanced `QuestionLoader` class in `src/lib/questionLoader.ts` provides:
- ✅ **Question Shuffling** for Rounds 1 & 2
- ✅ **Option Shuffling** for Round 1 MCQs
- ✅ **Team-based Deterministic Shuffling** (same team gets same order)
- ✅ **Caching** for better performance
- ✅ **Validation** of question data structure

### New Shuffling Features

#### Round 1 (MCQ) Shuffling & Random Selection
```typescript
// Load with question selection, shuffling and option shuffling
const roundData = await QuestionLoader.loadRound1Questions({
  shuffle: true,        // Shuffle question order
  teamId: team.id,      // Consistent shuffling per team
  shuffleOptions: true, // Shuffle answer options
  selectCount: 45       // Randomly select 45 out of 61 questions
});
```

**Key Features:**
- **Random Selection**: Each team gets 45 randomly selected questions from a pool of 61
- **Deterministic per Team**: Same team always gets the same 45 questions
- **Fair Distribution**: All teams get questions of similar difficulty distribution
- **Question Shuffling**: Selected questions are then shuffled in random order
- **Option Shuffling**: Answer options within each question are shuffled

#### Round 2 (Coding) Shuffling
```typescript
// Load with question shuffling
const roundData = await QuestionLoader.loadRound2Questions({
  shuffle: true,        // Shuffle question order
  teamId: team.id       // Consistent shuffling per team
});
```

#### Shuffling Algorithm
- Uses **Fisher-Yates shuffle** with deterministic seeding
- **Team-based seeding**: Same team always gets same question selection and order
- **Random Selection**: 45 questions randomly selected from pool of 61
- **Separate seeds**: Different seed for each question's options
- **Consistent across sessions**: Team sees same questions and order even after refresh
- **Fair Distribution**: Selection algorithm ensures balanced difficulty distribution

### Advantages of JSON-Only Approach

- ✅ **Fast Loading**: No database queries needed
- ✅ **Reliable**: No database dependency during competition
- ✅ **Version Control**: Easy to track question changes
- ✅ **Simple Deployment**: Questions bundled with app
- ✅ **Offline Capable**: Works without database connection
- ✅ **Random Question Selection**: 45 questions selected from pool of 61 per team
- ✅ **Deterministic Selection**: Same team gets same questions consistently
- ✅ **Easy Review**: Questions can be reviewed in plain text

## Database Schema Changes

### Removed Tables
- ❌ `questions` table (questions now in JSON)
- ❌ `question_locks` table (jeopardy FCFS handled differently)

### Updated Tables
- ✅ `submissions` table updated to work with JSON question IDs
- ✅ `ai_evaluation_log` table updated to work with JSON question IDs
- ✅ New fields in submissions: `question_text`, `ai_feedback`, `ai_evaluation`
- ✅ `question_id` changed from UUID to TEXT in both tables

### AI Evaluation System
- ✅ **AI evaluation still works** - answers are checked by OpenAI/Gemini APIs
- ✅ **Scoring system intact** - correct answers get points, incorrect lose points
- ✅ **Logging maintained** - all AI evaluations logged to `ai_evaluation_log`
- ✅ **Fallback system** - Mock AI if APIs fail

### Migration Required
Run the migration to update your database:
```sql
-- File: supabase/migrations/20260204000001_remove_questions_table.sql
-- This removes questions table and updates submissions table
```

## Question File Structure

### Round 1 Questions (MCQ)
```json
{
  "round_info": {
    "round_number": 1,
    "round_name": "Aptitude Arena",
    "round_type": "quiz",
    "time_limit_seconds": 1800,
    "total_questions": 20,
    "description": "Multiple choice questions..."
  },
  "questions": [
    {
      "id": 1,
      "question": "What is the time complexity of binary search?",
      "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      "correct_answer": 1,
      "points": 10,
      "category": "Algorithms",
      "difficulty": "easy",
      "explanation": "Binary search divides the search space..."
    }
  ]
}
```

### Round 2 Questions (Coding)
```json
{
  "round_info": {
    "round_number": 2,
    "round_name": "Constraint Paradox",
    "round_type": "constraint",
    "time_limit_seconds": 3600,
    "total_questions": 10,
    "description": "Coding problems with constraints..."
  },
  "questions": [
    {
      "id": 1,
      "question": "Write a function to reverse a string...",
      "constraints": [
        "No using reverse() method",
        "No using for/while loops"
      ],
      "sample_input": "hello",
      "sample_output": "olleh",
      "points": 50,
      "category": "String Manipulation",
      "difficulty": "medium",
      "test_cases": [...],
      "evaluation_criteria": "Function should use recursion..."
    }
  ]
}
```

## Implementation Details

### QuestionLoader Enhanced Features

```typescript
export class QuestionLoader {
  // Deterministic shuffling based on team ID
  private static generateSeed(teamId?: string): number {
    // Creates consistent seed from team ID
  }

  // Seeded random number generator
  private static seededRandom(seed: number): () => number {
    // Ensures same sequence for same seed
  }

  // Load Round 1 with shuffling options
  static async loadRound1Questions(options?: {
    shuffle?: boolean;
    teamId?: string;
    shuffleOptions?: boolean;
  }): Promise<Round1Data>

  // Load Round 2 with shuffling options  
  static async loadRound2Questions(options?: {
    shuffle?: boolean;
    teamId?: string;
  }): Promise<Round2Data>
}
```

## AI Evaluation & Scoring System

### How AI Evaluation Works
The system uses **OpenAI GPT-4** and **Google Gemini** APIs to evaluate answers:

1. **Question Submission**: Team submits answer (MCQ choice or code)
2. **AI Processing**: 
   - Gemini API tried first (free tier)
   - Falls back to OpenAI if Gemini fails
   - Mock AI as final fallback
3. **Evaluation Response**: AI returns `isCorrect: true/false` 
4. **Points Calculation**:
   - **Round 1**: 10 points for correct, 0 for incorrect
   - **Round 2**: Variable points for correct, -10 for incorrect  
   - **Round 3**: Jeopardy scoring system
5. **Database Logging**: All evaluations logged to `ai_evaluation_log`

### AI Evaluation Flow
```typescript
// AI evaluates the submission
const aiResult = await aiEvaluationService.evaluateSubmission(
  teamId,
  questionId,
  roundNumber,
  {
    question: "What is binary search complexity?",
    userCode: "O(log n)", // User's answer
    testCases: [{ input: "question", expected_output: "O(log n)" }],
    constraints: [],
    evaluationCriteria: "Multiple choice question..."
  }
);

// Result contains:
// - isCorrect: boolean (1 or 0 equivalent)
// - points: number (calculated based on round)
// - feedback: string (AI explanation)
// - reasoning: string (detailed analysis)
```

### Database Logging
Every AI evaluation is logged:
```sql
-- ai_evaluation_log table stores:
INSERT INTO ai_evaluation_log (
  team_id,           -- Which team
  question_id,       -- JSON question ID (now TEXT)
  round_id,          -- Which round
  question_text,     -- The actual question
  team_answer,       -- User's submitted answer
  ai_provider,       -- 'openai', 'gemini', or 'mock'
  ai_prompt,         -- Prompt sent to AI
  ai_response,       -- Full AI response
  ai_score,          -- 1 for correct, 0 for incorrect
  evaluation_time_ms -- Response time (optional)
);
```

### Scoring System
- **Round 1 (MCQ)**: 10 points per correct answer, 0 for wrong
- **Round 2 (Coding)**: Variable points (50-100) for correct, -10 for wrong
- **Round 3 (Jeopardy)**: Points based on question difficulty (100-2500)

### Reliability Features
- **Multiple AI Providers**: Gemini → OpenAI → Mock AI fallback
- **Retry Logic**: 3 attempts per provider with exponential backoff
- **Error Handling**: Graceful degradation if AI services fail
- **Logging**: Complete audit trail of all evaluations

### Submission Handling
Updated to work without questions table:
```typescript
// Submissions now include question text and AI evaluation
const submission = {
  team_id: team.id,
  question_id: question.id.toString(), // Now TEXT, not UUID
  round_id: roundData.id,
  question_text: question.question,    // NEW: Store question text
  answer: userAnswer,
  is_correct: result.isCorrect,
  points_earned: pointsEarned,
  ai_feedback: result.feedback,        // NEW: AI feedback
  ai_evaluation: result,               // NEW: Full AI evaluation
  submitted_at: new Date().toISOString()
};
```

## Competition Setup

### 1. Participant Management
```sql
-- Run create-participants.sql to set up teams and roles
-- This creates teams, assigns roles, and provides management functions
```

### 2. Question Preparation
1. **Edit JSON files** in `public/questions/`
2. **Test locally** to ensure questions load correctly
3. **Deploy** - questions are bundled with the application

### 3. Competition Flow
1. **Teams login** and get assigned shuffled questions
2. **Consistent experience** - same team sees same question order
3. **Fair competition** - all teams get same questions, different order
4. **Real-time scoring** - submissions tracked in database

## Benefits for Competition

### Reliability
- ✅ No database queries for questions = faster loading
- ✅ No risk of database issues affecting question display
- ✅ Questions always available, even if database has issues

### Fairness
- ✅ All teams get exactly the same questions
- ✅ Shuffling prevents cheating/collaboration
- ✅ Deterministic shuffling ensures consistency

### Performance
- ✅ Questions cached in browser after first load
- ✅ No network requests during competition
- ✅ Faster question navigation

### Management
- ✅ Easy to review questions before competition
- ✅ Version control tracks all changes
- ✅ Simple to update questions for future competitions

## Quick Start Commands

### Setup Database
```bash
# Run the migration to remove questions table
# Copy the SQL from supabase/migrations/20260204000001_remove_questions_table.sql
# Paste into Supabase SQL Editor and run
```

### Create Participants
```bash
# Run create-participants.sql in Supabase SQL Editor
# This creates sample teams and assigns roles
```

### Verify Setup
```sql
-- Check teams were created
SELECT COUNT(*) FROM public.teams WHERE is_active = true;

-- Check user roles
SELECT role, COUNT(*) FROM public.user_roles GROUP BY role;

-- Check submissions table structure
\d public.submissions;
```

This streamlined approach makes CodeWars 2.0 more reliable and easier to manage while adding the requested shuffling functionality for fair competition.