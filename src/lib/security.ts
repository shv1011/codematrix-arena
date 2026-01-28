// Security utilities and hardening for CodeWars 2.0

import DOMPurify from 'dompurify';

// Input validation and sanitization
export class InputValidator {
  // Email validation
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Team name validation
  static isValidTeamName(name: string): boolean {
    // Allow alphanumeric, spaces, hyphens, underscores
    const nameRegex = /^[a-zA-Z0-9\s\-_]{2,50}$/;
    return nameRegex.test(name.trim());
  }

  // Team code validation
  static isValidTeamCode(code: string): boolean {
    // Alphanumeric, 4-20 characters
    const codeRegex = /^[a-zA-Z0-9]{4,20}$/;
    return codeRegex.test(code);
  }

  // Password validation
  static isValidPassword(password: string): boolean {
    // At least 8 characters, contains uppercase, lowercase, number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  // Code submission validation
  static isValidCodeSubmission(code: string): boolean {
    if (!code || code.trim().length === 0) return false;
    if (code.length > 50000) return false; // Max 50KB

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /document\./i,
      /window\./i,
      /process\./i,
      /require\s*\(/i,
      /import\s+.*from/i,
      /__import__/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /shell_exec/i,
      /passthru/i,
      /file_get_contents/i,
      /file_put_contents/i,
      /fopen/i,
      /fwrite/i,
      /include/i,
      /require/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(code));
  }

  // Sanitize HTML content
  static sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p'],
      ALLOWED_ATTR: []
    });
  }

  // Sanitize user input for database
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  }

  // Validate file upload
  static isValidFileUpload(file: File, allowedTypes: string[], maxSize: number): boolean {
    if (!allowedTypes.includes(file.type)) return false;
    if (file.size > maxSize) return false;
    
    // Check file extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = allowedTypes.map(type => type.split('/')[1]);
    
    return extension ? allowedExtensions.includes(extension) : false;
  }
}

// Rate limiting
export class RateLimiter {
  private static requests: Map<string, { count: number; resetTime: number }> = new Map();
  private static readonly DEFAULT_WINDOW = 60000; // 1 minute
  private static readonly DEFAULT_LIMIT = 100; // 100 requests per minute

  static isAllowed(
    identifier: string, 
    limit: number = this.DEFAULT_LIMIT, 
    windowMs: number = this.DEFAULT_WINDOW
  ): boolean {
    const now = Date.now();
    const key = `${identifier}_${Math.floor(now / windowMs)}`;
    
    const current = this.requests.get(key) || { count: 0, resetTime: now + windowMs };
    
    if (now > current.resetTime) {
      // Reset window
      current.count = 0;
      current.resetTime = now + windowMs;
    }

    if (current.count >= limit) {
      return false;
    }

    current.count++;
    this.requests.set(key, current);
    
    // Cleanup old entries
    this.cleanup();
    
    return true;
  }

  private static cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  static getRemainingRequests(identifier: string, limit: number = this.DEFAULT_LIMIT): number {
    const now = Date.now();
    const key = `${identifier}_${Math.floor(now / this.DEFAULT_WINDOW)}`;
    const current = this.requests.get(key);
    
    return current ? Math.max(0, limit - current.count) : limit;
  }
}

// CSRF protection
export class CSRFProtection {
  private static tokens: Map<string, { token: string; expires: number }> = new Map();
  private static readonly TOKEN_EXPIRY = 3600000; // 1 hour

  static generateToken(sessionId: string): string {
    const token = this.generateRandomString(32);
    const expires = Date.now() + this.TOKEN_EXPIRY;
    
    this.tokens.set(sessionId, { token, expires });
    
    // Cleanup expired tokens
    this.cleanup();
    
    return token;
  }

  static validateToken(sessionId: string, token: string): boolean {
    const stored = this.tokens.get(sessionId);
    
    if (!stored) return false;
    if (Date.now() > stored.expires) {
      this.tokens.delete(sessionId);
      return false;
    }
    
    return stored.token === token;
  }

  private static generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private static cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.tokens.entries()) {
      if (now > value.expires) {
        this.tokens.delete(key);
      }
    }
  }
}

// XSS protection
export class XSSProtection {
  // Escape HTML entities
  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Validate and sanitize URLs
  static sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return '';
      }
      
      return parsed.toString();
    } catch {
      return '';
    }
  }

  // Content Security Policy headers (for server-side implementation)
  static getCSPHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Monaco editor needs unsafe-eval
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self' wss: https:",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'"
      ].join('; ')
    };
  }
}

// Session security
export class SessionSecurity {
  private static readonly SESSION_TIMEOUT = 3600000; // 1 hour
  private static sessions: Map<string, { 
    userId: string; 
    lastActivity: number; 
    ipAddress: string;
    userAgent: string;
  }> = new Map();

  static createSession(
    sessionId: string, 
    userId: string, 
    ipAddress: string, 
    userAgent: string
  ): void {
    this.sessions.set(sessionId, {
      userId,
      lastActivity: Date.now(),
      ipAddress,
      userAgent
    });
  }

  static validateSession(
    sessionId: string, 
    ipAddress: string, 
    userAgent: string
  ): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) return false;
    
    // Check session timeout
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.sessions.delete(sessionId);
      return false;
    }
    
    // Check IP address consistency (optional, can be disabled for mobile users)
    // if (session.ipAddress !== ipAddress) return false;
    
    // Check user agent consistency
    if (session.userAgent !== userAgent) return false;
    
    // Update last activity
    session.lastActivity = Date.now();
    
    return true;
  }

  static destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  static cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

// Audit logging
export class AuditLogger {
  private static logs: Array<{
    timestamp: string;
    userId?: string;
    action: string;
    resource: string;
    details: any;
    ipAddress?: string;
    userAgent?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  static log(
    action: string,
    resource: string,
    details: any = {},
    severity: 'low' | 'medium' | 'high' | 'critical' = 'low',
    userId?: string,
    ipAddress?: string,
    userAgent?: string
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      resource,
      details,
      ipAddress,
      userAgent,
      severity
    };

    this.logs.push(logEntry);
    
    // Log to console for development
    if (severity === 'critical' || severity === 'high') {
      console.warn('Security event:', logEntry);
    }

    // Keep only last 1000 logs in memory
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // In production, send to external logging service
    this.sendToExternalLogger(logEntry);
  }

  private static async sendToExternalLogger(logEntry: any): Promise<void> {
    // In a real implementation, send to external logging service
    // For now, just store in localStorage for demo
    try {
      const existingLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 100 logs in localStorage
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      localStorage.setItem('audit_logs', JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Failed to store audit log:', error);
    }
  }

  static getLogs(severity?: string): any[] {
    if (severity) {
      return this.logs.filter(log => log.severity === severity);
    }
    return [...this.logs];
  }

  static getSecurityEvents(): any[] {
    return this.logs.filter(log => 
      log.severity === 'high' || 
      log.severity === 'critical' ||
      log.action.includes('failed') ||
      log.action.includes('blocked')
    );
  }
}

// Security middleware for API calls
export const securityMiddleware = {
  // Validate request before sending
  validateRequest: (request: any): boolean => {
    // Check rate limiting
    const identifier = request.userId || request.ipAddress || 'anonymous';
    if (!RateLimiter.isAllowed(identifier)) {
      AuditLogger.log('rate_limit_exceeded', 'api', { identifier }, 'medium');
      return false;
    }

    // Validate input
    if (request.data) {
      for (const [key, value] of Object.entries(request.data)) {
        if (typeof value === 'string') {
          request.data[key] = InputValidator.sanitizeInput(value);
        }
      }
    }

    return true;
  },

  // Log security events
  logSecurityEvent: (event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void => {
    AuditLogger.log(event, 'security', details, severity);
  }
};

// Security configuration
export const securityConfig = {
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  },

  // Session settings
  session: {
    timeout: 3600000, // 1 hour
    renewThreshold: 300000, // 5 minutes
    maxConcurrentSessions: 3
  },

  // Rate limiting
  rateLimiting: {
    api: { requests: 100, window: 60000 }, // 100 requests per minute
    login: { requests: 5, window: 300000 }, // 5 login attempts per 5 minutes
    submission: { requests: 10, window: 60000 } // 10 submissions per minute
  },

  // File upload
  fileUpload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['text/plain', 'application/json'],
    scanForMalware: true
  }
};

// Initialize security features
export const initializeSecurity = (): void => {
  // Set up periodic cleanup
  setInterval(() => {
    SessionSecurity.cleanupExpiredSessions();
  }, 300000); // Every 5 minutes

  // Set up security headers (if running in browser)
  if (typeof window !== 'undefined') {
    // Add security event listeners
    window.addEventListener('error', (event) => {
      AuditLogger.log('javascript_error', 'client', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }, 'medium');
    });

    // Monitor for potential XSS attempts
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('script') || message.includes('eval')) {
        AuditLogger.log('potential_xss', 'client', { message }, 'high');
      }
      originalConsoleError.apply(console, args);
    };
  }

  console.log('Security features initialized');
};