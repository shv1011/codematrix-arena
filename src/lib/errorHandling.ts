// Comprehensive error handling and logging system for CodeWars 2.0

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Error types
export enum ErrorType {
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  AI_SERVICE = 'AI_SERVICE',
  REALTIME = 'REALTIME',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorDetails {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  context?: any;
  userId?: string;
  teamId?: string;
  timestamp: string;
  stackTrace?: string;
  userAgent?: string;
  url?: string;
  component?: string;
}

export interface UserFriendlyError {
  title: string;
  message: string;
  action?: string;
  retry?: boolean;
}

// Error logging service
export class ErrorLogger {
  private static logs: ErrorDetails[] = [];
  private static maxLogs = 1000;
  private static isInitialized = false;

  static initialize(): void {
    if (this.isInitialized) return;

    // Set up global error handlers
    if (typeof window !== 'undefined') {
      // Handle unhandled JavaScript errors
      window.addEventListener('error', (event) => {
        this.logError({
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.HIGH,
          message: event.message,
          context: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          },
          stackTrace: event.error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.logError({
          type: ErrorType.UNKNOWN,
          severity: ErrorSeverity.HIGH,
          message: `Unhandled promise rejection: ${event.reason}`,
          context: { reason: event.reason },
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        });
      });

      // Handle network errors
      window.addEventListener('offline', () => {
        this.logError({
          type: ErrorType.NETWORK,
          severity: ErrorSeverity.MEDIUM,
          message: 'Network connection lost',
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
      });
    }

    this.isInitialized = true;
    console.log('Error logging system initialized');
  }

  static logError(error: ErrorDetails): void {
    // Add to in-memory logs
    this.logs.push(error);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Log to console based on severity
    const logMethod = this.getConsoleMethod(error.severity);
    logMethod(`[${error.type}] ${error.message}`, error);

    // Send to external logging service
    this.sendToExternalService(error);

    // Store in local storage for offline access
    this.storeLocally(error);

    // Show user notification for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.showCriticalErrorNotification(error);
    }
  }

  private static getConsoleMethod(severity: ErrorSeverity): (...args: any[]) => void {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return console.error;
      case ErrorSeverity.MEDIUM:
        return console.warn;
      case ErrorSeverity.LOW:
      default:
        return console.log;
    }
  }

  private static async sendToExternalService(error: ErrorDetails): Promise<void> {
    try {
      // In production, send to external logging service (e.g., Sentry, LogRocket)
      // For now, store in Supabase
      await supabase.from('error_logs').insert({
        type: error.type,
        severity: error.severity,
        message: error.message,
        code: error.code,
        context: error.context,
        user_id: error.userId,
        team_id: error.teamId,
        timestamp: error.timestamp,
        stack_trace: error.stackTrace,
        user_agent: error.userAgent,
        url: error.url,
        component: error.component
      });
    } catch (logError) {
      console.error('Failed to send error to external service:', logError);
    }
  }

  private static storeLocally(error: ErrorDetails): void {
    try {
      const existingLogs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      existingLogs.push(error);

      // Keep only last 50 errors locally
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }

      localStorage.setItem('error_logs', JSON.stringify(existingLogs));
    } catch (storageError) {
      console.error('Failed to store error locally:', storageError);
    }
  }

  private static showCriticalErrorNotification(error: ErrorDetails): void {
    const userError = ErrorHandler.getUserFriendlyError(error);
    toast.error(userError.title, {
      description: userError.message,
      duration: 10000,
      action: userError.action ? {
        label: userError.action,
        onClick: () => window.location.reload()
      } : undefined
    });
  }

  static getLogs(filter?: {
    type?: ErrorType;
    severity?: ErrorSeverity;
    userId?: string;
    component?: string;
    since?: Date;
  }): ErrorDetails[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.type) {
        filteredLogs = filteredLogs.filter(log => log.type === filter.type);
      }
      if (filter.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filter.severity);
      }
      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
      }
      if (filter.component) {
        filteredLogs = filteredLogs.filter(log => log.component === filter.component);
      }
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= filter.since!
        );
      }
    }

    return filteredLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  static getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const byType = Object.values(ErrorType).reduce((acc, type) => {
      acc[type] = this.logs.filter(log => log.type === type).length;
      return acc;
    }, {} as Record<ErrorType, number>);

    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = this.logs.filter(log => log.severity === severity).length;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const recentErrors = this.logs.filter(log => 
      new Date(log.timestamp) >= oneHourAgo
    ).length;

    return {
      total: this.logs.length,
      byType,
      bySeverity,
      recentErrors
    };
  }

  static clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('error_logs');
  }
}

// Error handler with user-friendly messages
export class ErrorHandler {
  static handle(error: any, context?: {
    component?: string;
    userId?: string;
    teamId?: string;
    action?: string;
  }): void {
    const errorDetails = this.parseError(error, context);
    ErrorLogger.logError(errorDetails);

    // Show user-friendly message
    const userError = this.getUserFriendlyError(errorDetails);
    
    if (errorDetails.severity === ErrorSeverity.CRITICAL) {
      toast.error(userError.title, {
        description: userError.message,
        duration: 10000
      });
    } else if (errorDetails.severity === ErrorSeverity.HIGH) {
      toast.error(userError.title, {
        description: userError.message,
        duration: 5000
      });
    } else if (errorDetails.severity === ErrorSeverity.MEDIUM) {
      toast.warning(userError.title, {
        description: userError.message
      });
    }
  }

  private static parseError(error: any, context?: any): ErrorDetails {
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let message = 'An unknown error occurred';
    let code: string | undefined;

    // Parse different error types
    if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Determine error type and severity
    if (error?.code) {
      code = error.code;
      
      // Supabase errors
      if (error.code.startsWith('PGRST')) {
        type = ErrorType.DATABASE;
        severity = ErrorSeverity.HIGH;
      }
      
      // Network errors
      if (['NETWORK_ERROR', 'TIMEOUT', 'CONNECTION_FAILED'].includes(error.code)) {
        type = ErrorType.NETWORK;
        severity = ErrorSeverity.MEDIUM;
      }
      
      // Authentication errors
      if (['AUTH_ERROR', 'UNAUTHORIZED', 'TOKEN_EXPIRED'].includes(error.code)) {
        type = ErrorType.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
      }
    }

    // Check message content for error type
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      type = ErrorType.NETWORK;
    } else if (lowerMessage.includes('auth') || lowerMessage.includes('login')) {
      type = ErrorType.AUTHENTICATION;
    } else if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden')) {
      type = ErrorType.AUTHORIZATION;
    } else if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.LOW;
    } else if (lowerMessage.includes('ai') || lowerMessage.includes('openai') || lowerMessage.includes('gemini')) {
      type = ErrorType.AI_SERVICE;
    }

    return {
      type,
      severity,
      message,
      code,
      context: {
        ...context,
        originalError: error
      },
      userId: context?.userId,
      teamId: context?.teamId,
      timestamp: new Date().toISOString(),
      stackTrace: error?.stack,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      component: context?.component
    };
  }

  static getUserFriendlyError(error: ErrorDetails): UserFriendlyError {
    switch (error.type) {
      case ErrorType.NETWORK:
        return {
          title: 'Connection Problem',
          message: 'Please check your internet connection and try again.',
          action: 'Retry',
          retry: true
        };

      case ErrorType.DATABASE:
        return {
          title: 'Data Error',
          message: 'There was a problem accessing your data. Please try again in a moment.',
          action: 'Retry',
          retry: true
        };

      case ErrorType.AUTHENTICATION:
        return {
          title: 'Authentication Required',
          message: 'Please log in again to continue.',
          action: 'Login',
          retry: false
        };

      case ErrorType.AUTHORIZATION:
        return {
          title: 'Access Denied',
          message: 'You don\'t have permission to perform this action.',
          retry: false
        };

      case ErrorType.VALIDATION:
        return {
          title: 'Invalid Input',
          message: 'Please check your input and try again.',
          retry: false
        };

      case ErrorType.AI_SERVICE:
        return {
          title: 'AI Service Unavailable',
          message: 'The AI evaluation service is temporarily unavailable. Please try again later.',
          action: 'Retry',
          retry: true
        };

      case ErrorType.REALTIME:
        return {
          title: 'Connection Issue',
          message: 'Real-time updates are temporarily unavailable. The page will refresh automatically.',
          action: 'Refresh',
          retry: true
        };

      case ErrorType.PERFORMANCE:
        return {
          title: 'Performance Issue',
          message: 'The application is running slowly. Consider refreshing the page.',
          action: 'Refresh',
          retry: true
        };

      case ErrorType.SECURITY:
        return {
          title: 'Security Alert',
          message: 'A security issue was detected. Please contact support if this continues.',
          retry: false
        };

      default:
        return {
          title: 'Something Went Wrong',
          message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
          action: 'Retry',
          retry: true
        };
    }
  }
}

// React Error Boundary
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    ErrorHandler.handle(error, {
      component: 'ErrorBoundary',
      action: 'render',
      context: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error!} />;
    }

    return this.props.children;
  }
}

// Default error fallback component
const DefaultErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center p-8 max-w-md">
      <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-muted-foreground mb-6">
        We're sorry, but something unexpected happened. Please try refreshing the page.
      </p>
      <div className="space-y-2">
        <Button onClick={() => window.location.reload()} className="w-full">
          Refresh Page
        </Button>
        <Button 
          variant="outline" 
          onClick={() => window.history.back()} 
          className="w-full"
        >
          Go Back
        </Button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Error Details (Development)
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  </div>
);

// Utility functions for common error scenarios
export const handleAsyncError = async <T>(
  asyncFn: () => Promise<T>,
  context?: any
): Promise<T | null> => {
  try {
    return await asyncFn();
  } catch (error) {
    ErrorHandler.handle(error, context);
    return null;
  }
};

export const withErrorHandling = <T extends (...args: any[]) => any>(
  fn: T,
  context?: any
): T => {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          ErrorHandler.handle(error, context);
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      ErrorHandler.handle(error, context);
      throw error;
    }
  }) as T;
};

// Initialize error handling system
export const initializeErrorHandling = (): void => {
  ErrorLogger.initialize();
  
  // Set up periodic error reporting
  setInterval(() => {
    const stats = ErrorLogger.getErrorStats();
    if (stats.recentErrors > 10) {
      console.warn('High error rate detected:', stats);
    }
  }, 300000); // Check every 5 minutes
  
  console.log('Error handling system initialized');
};

// Import required components
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';