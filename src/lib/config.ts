// Environment configuration and validation for CodeWars 2.0

interface Config {
  supabase: {
    projectId: string;
    publishableKey: string;
    url: string;
  };
  ai: {
    openaiApiKey: string;
    geminiApiKey: string;
  };
  competition: {
    round1TimeLimit: number;
    round2TimeLimit: number;
    round3TimeLimit: number;
    jeopardyLockTimeout: number;
  };
}

// Get environment variable with validation
function getEnvVar(key: string, required: boolean = true): string {
  const value = import.meta.env[key];
  
  if (required && (!value || value.trim() === '')) {
    console.warn(`Missing required environment variable: ${key}`);
    return '';
  }
  
  return value || '';
}

// Get numeric environment variable
function getEnvNumber(key: string, defaultValue: number): number {
  const value = import.meta.env[key];
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Configuration object
export const config: Config = {
  supabase: {
    projectId: getEnvVar('VITE_SUPABASE_PROJECT_ID'),
    publishableKey: getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY'),
    url: getEnvVar('VITE_SUPABASE_URL'),
  },
  ai: {
    openaiApiKey: getEnvVar('VITE_OPENAI_API_KEY', false),
    geminiApiKey: getEnvVar('VITE_GEMINI_API_KEY', false),
  },
  competition: {
    round1TimeLimit: getEnvNumber('VITE_ROUND1_TIME_LIMIT', 1800), // 30 minutes
    round2TimeLimit: getEnvNumber('VITE_ROUND2_TIME_LIMIT', 3600), // 60 minutes
    round3TimeLimit: getEnvNumber('VITE_ROUND3_TIME_LIMIT', 5400), // 90 minutes
    jeopardyLockTimeout: getEnvNumber('VITE_JEOPARDY_LOCK_TIMEOUT', 300), // 5 minutes
  },
};

// Validation functions
export const validateConfig = {
  hasSupabaseConfig(): boolean {
    return !!(config.supabase.projectId && config.supabase.publishableKey && config.supabase.url);
  },

  hasAIConfig(): boolean {
    return !!(config.ai.openaiApiKey || config.ai.geminiApiKey);
  },

  getAvailableAIProviders(): string[] {
    const providers: string[] = [];
    if (config.ai.openaiApiKey) providers.push('openai');
    if (config.ai.geminiApiKey) providers.push('gemini');
    return providers;
  },

  validateAll(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.hasSupabaseConfig()) {
      errors.push('Supabase configuration is incomplete');
    }

    if (!this.hasAIConfig()) {
      errors.push('At least one AI provider (OpenAI or Gemini) must be configured');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

// Development mode helpers
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// Log configuration status in development
if (isDevelopment) {
  console.log('🔧 Configuration Status:');
  console.log('  Supabase:', validateConfig.hasSupabaseConfig() ? '✅' : '❌');
  console.log('  AI Providers:', validateConfig.getAvailableAIProviders().join(', ') || '❌ None');
  
  const validation = validateConfig.validateAll();
  if (!validation.isValid) {
    console.warn('⚠️ Configuration Issues:');
    validation.errors.forEach(error => console.warn(`  - ${error}`));
  }
}