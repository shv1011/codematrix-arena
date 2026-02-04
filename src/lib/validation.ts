// Input validation and sanitization utilities

import DOMPurify from 'dompurify';

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Team name validation
export const validateTeamName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, error: "Team name is required" };
  }
  
  if (trimmed.length < 2) {
    return { isValid: false, error: "Team name must be at least 2 characters" };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, error: "Team name must be less than 50 characters" };
  }
  
  // Allow alphanumeric, spaces, hyphens, underscores
  const nameRegex = /^[a-zA-Z0-9\s\-_]+$/;
  if (!nameRegex.test(trimmed)) {
    return { isValid: false, error: "Team name can only contain letters, numbers, spaces, hyphens, and underscores" };
  }
  
  return { isValid: true };
};

// Code validation for submissions
export const validateCode = (code: string, language: string): { isValid: boolean; error?: string } => {
  const trimmed = code.trim();
  
  if (!trimmed) {
    return { isValid: false, error: "Code cannot be empty" };
  }
  
  if (trimmed.length > 10000) {
    return { isValid: false, error: "Code must be less than 10,000 characters" };
  }
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/i,
    /exec\s*\(/i,
    /system\s*\(/i,
    /shell_exec\s*\(/i,
    /passthru\s*\(/i,
    /file_get_contents\s*\(/i,
    /file_put_contents\s*\(/i,
    /fopen\s*\(/i,
    /fwrite\s*\(/i,
    /require\s*\(/i,
    /include\s*\(/i,
    /import\s+os/i,
    /import\s+subprocess/i,
    /import\s+sys/i,
    /__import__\s*\(/i,
    /process\./i,
    /child_process/i,
    /fs\./i,
    /require\s*\(\s*['"]fs['"]/i,
    /require\s*\(\s*['"]child_process['"]/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { isValid: false, error: "Code contains potentially dangerous operations" };
    }
  }
  
  return { isValid: true };
};

// Sanitize HTML content
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p'],
    ALLOWED_ATTR: []
  });
};

// Sanitize text input
export const sanitizeText = (text: string): string => {
  return text
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
};

// Validate question ID
export const validateQuestionId = (id: string): boolean => {
  const idRegex = /^[a-zA-Z0-9_-]+$/;
  return idRegex.test(id) && id.length <= 50;
};

// Validate team ID (UUID format)
export const validateTeamId = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Validate round number
export const validateRoundNumber = (round: number): boolean => {
  return Number.isInteger(round) && round >= 1 && round <= 3;
};

// Validate score
export const validateScore = (score: number): boolean => {
  return Number.isFinite(score) && score >= -1000 && score <= 10000;
};

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(identifier: string): number {
    const requests = this.requests.get(identifier) || [];
    if (requests.length === 0) return 0;
    
    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs;
  }
}

// Create rate limiters for different operations
export const submissionRateLimiter = new RateLimiter(5, 60000); // 5 submissions per minute
export const loginRateLimiter = new RateLimiter(5, 300000); // 5 login attempts per 5 minutes
export const apiRateLimiter = new RateLimiter(100, 60000); // 100 API calls per minute

// Validation middleware for forms
export const validateSubmissionForm = (data: {
  teamId: string;
  questionId: string;
  code: string;
  language: string;
  roundNumber: number;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!validateTeamId(data.teamId)) {
    errors.push("Invalid team ID");
  }

  if (!validateQuestionId(data.questionId)) {
    errors.push("Invalid question ID");
  }

  const codeValidation = validateCode(data.code, data.language);
  if (!codeValidation.isValid) {
    errors.push(codeValidation.error!);
  }

  if (!validateRoundNumber(data.roundNumber)) {
    errors.push("Invalid round number");
  }

  const allowedLanguages = ['javascript', 'python', 'java', 'cpp', 'c'];
  if (!allowedLanguages.includes(data.language)) {
    errors.push("Invalid programming language");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// XSS Protection
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// CSRF Token generation (for forms)
export const generateCSRFToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Validate CSRF token
export const validateCSRFToken = (token: string, storedToken: string): boolean => {
  return token === storedToken && token.length === 64;
};

// SQL Injection prevention (for dynamic queries)
export const sanitizeSqlInput = (input: string): string => {
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments
    .replace(/\*\//g, '')
    .trim();
};

// File upload validation
export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['application/json', 'text/plain', 'text/csv'];
  
  if (file.size > maxSize) {
    return { isValid: false, error: "File size must be less than 5MB" };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: "Invalid file type. Only JSON, TXT, and CSV files are allowed" };
  }
  
  return { isValid: true };
};

// Password strength validation
export const validatePassword = (password: string): { isValid: boolean; error?: string; strength: number } => {
  if (password.length < 8) {
    return { isValid: false, error: "Password must be at least 8 characters", strength: 0 };
  }
  
  let strength = 0;
  
  // Check for lowercase
  if (/[a-z]/.test(password)) strength++;
  
  // Check for uppercase
  if (/[A-Z]/.test(password)) strength++;
  
  // Check for numbers
  if (/\d/.test(password)) strength++;
  
  // Check for special characters
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
  
  // Check length bonus
  if (password.length >= 12) strength++;
  
  const isValid = strength >= 3;
  
  return {
    isValid,
    error: isValid ? undefined : "Password must contain at least 3 of: lowercase, uppercase, numbers, special characters",
    strength
  };
};

export default {
  validateEmail,
  validateTeamName,
  validateCode,
  sanitizeHtml,
  sanitizeText,
  validateQuestionId,
  validateTeamId,
  validateRoundNumber,
  validateScore,
  validateSubmissionForm,
  escapeHtml,
  generateCSRFToken,
  validateCSRFToken,
  sanitizeSqlInput,
  validateFileUpload,
  validatePassword,
  RateLimiter,
  submissionRateLimiter,
  loginRateLimiter,
  apiRateLimiter
};