# AI Evaluation System - CodeWars 2.0

## System Overview

The AI evaluation system is **fully functional** and handles answer checking, scoring, and point calculation. Here's how it works:

## 🤖 AI Evaluation Flow

### 1. Answer Submission
```typescript
// User submits answer (MCQ or code)
const userAnswer = "O(log n)"; // Example MCQ answer
// OR
const userCode = "function reverse(str) { ... }"; // Example code
```

### 2. AI Processing
```typescript
const aiResult = await aiEvaluationService.evaluateSubmission(
  teamId,
  questionId, 
  roundNumber,
  {
    question: "What is the time complexity of binary search?",
    userCode: userAnswer,
    testCases: [{ input: "question", expected_output: "O(log n)" }],
    constraints: [],
    evaluationCriteria: "Multiple choice question. Correct answer is O(log n)"
  }
);
```

### 3. AI Response
```typescript
// AI returns evaluation result:
{
  isCorrect: true,        // ✅ 1 or 0 equivalent
  score: 100,            // 0-100 quality score
  points: 10,            // Actual points awarded
  feedback: "Correct! Binary search has O(log n) complexity...",
  reasoning: "The answer demonstrates understanding...",
  constraintViolations: [],
  executionResult: { passed: true }
}
```

### 4. Points Calculation
```typescript
// Points calculated based on round:
switch (roundNumber) {
  case 1: // MCQ Round
    points = aiResult.isCorrect ? 10 : 0;
    break;
  case 2: // Coding Round  
    points = aiResult.isCorrect ? questionWeightage : -10;
    break;
  case 3: // Jeopardy Round
    points = aiResult.score; // Variable based on difficulty
    break;
}
```

### 5. Database Logging
```sql
-- Every evaluation logged to ai_evaluation_log:
INSERT INTO ai_evaluation_log (
  team_id,           -- UUID of team
  question_id,       -- TEXT (JSON question ID)
  round_id,          -- UUID of round
  question_text,     -- The actual question
  team_answer,       -- User's submitted answer
  ai_provider,       -- 'openai', 'gemini', or 'mock'
  ai_prompt,         -- Prompt sent to AI
  ai_response,       -- Full AI response JSON
  ai_score,          -- 1 for correct, 0 for incorrect
  evaluation_time_ms -- Response time
);
```

## 🔄 AI Provider Fallback System

### Priority Order:
1. **Gemini API** (free tier, tried first)
2. **OpenAI GPT-4** (fallback if Gemini fails)
3. **Mock AI** (final fallback for development/testing)

### Retry Logic:
- **3 attempts** per provider
- **Exponential backoff** (1s, 2s, 3s delays)
- **Graceful degradation** if all providers fail

## 📊 Scoring System

### Round 1 (Aptitude Arena - MCQ)
- ✅ **Correct Answer**: +10 points
- ❌ **Wrong Answer**: 0 points (no negative marking)

### Round 2 (Constraint Paradox - Coding)
- ✅ **Correct Solution**: +50 to +100 points (based on question difficulty)
- ❌ **Wrong Solution**: -10 points (negative marking)

### Round 3 (Code Jeopardy)
- ✅ **Correct Answer**: +100 to +2500 points (based on difficulty)
- ❌ **Wrong Answer**: Lose the points (jeopardy style)

## 🛡️ Error Handling

### If AI APIs Fail:
```typescript
// Fallback response returned:
{
  isCorrect: false,
  score: 0,
  points: 0,
  feedback: "AI evaluation service temporarily unavailable. Please try again later.",
  reasoning: "All AI evaluators failed. Last error: [error message]",
  constraintViolations: ["AI evaluation failed"],
  executionResult: { passed: false, error: "AI evaluation service unavailable" }
}
```

### Logging Still Works:
- Even failures are logged to `ai_evaluation_log`
- Complete audit trail maintained
- Admins can see evaluation statistics

## 📈 Monitoring & Statistics

### AI Health Check:
```typescript
const health = await aiEvaluationService.checkAPIHealth();
// Returns: { openai: boolean, gemini: boolean, available: boolean }
```

### Evaluation Statistics:
```typescript
const stats = await aiEvaluationService.getEvaluationStats(teamId);
// Returns: { totalEvaluations, successRate, averageScore, providerUsage }
```

### Database Functions:
```sql
-- Get AI evaluation statistics
SELECT * FROM public.get_ai_evaluation_stats();

-- Returns evaluation counts, success rates, and provider usage per round
```

## 🔧 Configuration

### Environment Variables:
```env
VITE_OPENAI_API_KEY=your_openai_key_here
VITE_GEMINI_API_KEY=your_gemini_key_here
```

### API Endpoints:
- **OpenAI**: `https://api.openai.com/v1/chat/completions`
- **Gemini**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`

## ✅ What's Working:

1. **AI Evaluation**: ✅ OpenAI & Gemini APIs evaluate answers
2. **Scoring**: ✅ Points calculated based on AI response (1 or 0)
3. **Database Logging**: ✅ All evaluations logged to `ai_evaluation_log`
4. **Fallback System**: ✅ Multiple providers with retry logic
5. **Error Handling**: ✅ Graceful degradation if APIs fail
6. **Statistics**: ✅ Complete evaluation analytics
7. **Question Loading**: ✅ JSON-based with shuffling
8. **Submissions**: ✅ Stored with AI feedback and evaluation

## 🚀 Ready for Competition:

The AI evaluation system is **production-ready** and will:
- ✅ Check all answers automatically
- ✅ Return 1 (correct) or 0 (incorrect) 
- ✅ Calculate points based on round rules
- ✅ Log everything for audit and analytics
- ✅ Handle API failures gracefully
- ✅ Provide detailed feedback to teams

The system is reliable, scalable, and maintains complete evaluation logs for fair competition scoring!