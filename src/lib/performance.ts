// Performance optimization utilities for CodeWars 2.0

import { supabase } from "@/integrations/supabase/client";

// Cache management
class CacheManager {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private maxSize = 100; // Maximum cache entries

  set(key: string, data: any, ttlSeconds: number = 300): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // Would need to track hits/misses for accurate calculation
    };
  }
}

export const cacheManager = new CacheManager();

// Database query optimization
export class QueryOptimizer {
  // Optimized team leaderboard query with caching
  static async getOptimizedLeaderboard(useCache: boolean = true): Promise<any[]> {
    const cacheKey = 'leaderboard_data';
    
    if (useCache) {
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Optimized query with selective fields and proper indexing
      const { data, error } = await supabase
        .from("teams")
        .select(`
          id,
          team_name,
          team_code,
          round1_score,
          round2_score,
          round3_score,
          total_score,
          is_active,
          is_disqualified,
          round_eliminated
        `)
        .order("total_score", { ascending: false })
        .limit(50); // Limit results for performance

      if (error) throw error;

      const processedData = data.map((team, index) => ({
        ...team,
        rank: index + 1,
        round1_score: team.round1_score || 0,
        round2_score: team.round2_score || 0,
        round3_score: team.round3_score || 0,
        total_score: team.total_score || 0
      }));

      if (useCache) {
        cacheManager.set(cacheKey, processedData, 30); // Cache for 30 seconds
      }

      return processedData;

    } catch (error) {
      console.error("Error fetching optimized leaderboard:", error);
      return [];
    }
  }

  // Batch fetch team data
  static async batchFetchTeams(teamIds: string[]): Promise<any[]> {
    if (teamIds.length === 0) return [];

    const cacheKey = `teams_batch_${teamIds.sort().join(',')}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .in("id", teamIds);

      if (error) throw error;

      cacheManager.set(cacheKey, data, 60); // Cache for 1 minute
      return data;

    } catch (error) {
      console.error("Error batch fetching teams:", error);
      return [];
    }
  }

  // Optimized submission history query
  static async getOptimizedSubmissions(
    teamId?: string, 
    roundNumber?: number,
    limit: number = 100
  ): Promise<any[]> {
    const cacheKey = `submissions_${teamId || 'all'}_${roundNumber || 'all'}_${limit}`;
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      let query = supabase
        .from("submissions")
        .select(`
          id,
          team_id,
          question_id,
          round_number,
          is_correct,
          points_earned,
          submitted_at,
          teams!inner(team_name)
        `)
        .order("submitted_at", { ascending: false })
        .limit(limit);

      if (teamId) {
        query = query.eq("team_id", teamId);
      }

      if (roundNumber) {
        query = query.eq("round_number", roundNumber);
      }

      const { data, error } = await query;

      if (error) throw error;

      cacheManager.set(cacheKey, data, 60); // Cache for 1 minute
      return data;

    } catch (error) {
      console.error("Error fetching optimized submissions:", error);
      return [];
    }
  }
}

// Component performance monitoring
export class PerformanceMonitor {
  private static metrics: Map<string, {
    renderCount: number;
    totalRenderTime: number;
    lastRenderTime: number;
    averageRenderTime: number;
  }> = new Map();

  static startMeasure(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      this.recordMetric(componentName, renderTime);
    };
  }

  private static recordMetric(componentName: string, renderTime: number): void {
    const existing = this.metrics.get(componentName) || {
      renderCount: 0,
      totalRenderTime: 0,
      lastRenderTime: 0,
      averageRenderTime: 0
    };

    existing.renderCount++;
    existing.totalRenderTime += renderTime;
    existing.lastRenderTime = renderTime;
    existing.averageRenderTime = existing.totalRenderTime / existing.renderCount;

    this.metrics.set(componentName, existing);

    // Log slow renders
    if (renderTime > 100) {
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  }

  static getMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    this.metrics.forEach((metric, componentName) => {
      result[componentName] = {
        ...metric,
        lastRenderTime: Math.round(metric.lastRenderTime * 100) / 100,
        averageRenderTime: Math.round(metric.averageRenderTime * 100) / 100
      };
    });

    return result;
  }

  static clearMetrics(): void {
    this.metrics.clear();
  }
}

// Bundle size optimization helpers
export const lazyLoadComponent = (importFn: () => Promise<any>) => {
  return React.lazy(importFn);
};

// Image optimization
export const optimizeImage = (src: string, width?: number, height?: number): string => {
  // In a real implementation, this would integrate with an image optimization service
  // For now, return the original src
  return src;
};

// Memory management
export class MemoryManager {
  private static observers: Set<IntersectionObserver> = new Set();
  private static timeouts: Set<NodeJS.Timeout> = new Set();
  private static intervals: Set<NodeJS.Timeout> = new Set();

  // Clean up intersection observers
  static addObserver(observer: IntersectionObserver): void {
    this.observers.add(observer);
  }

  static removeObserver(observer: IntersectionObserver): void {
    observer.disconnect();
    this.observers.delete(observer);
  }

  // Clean up timeouts
  static addTimeout(timeout: NodeJS.Timeout): void {
    this.timeouts.add(timeout);
  }

  static removeTimeout(timeout: NodeJS.Timeout): void {
    clearTimeout(timeout);
    this.timeouts.delete(timeout);
  }

  // Clean up intervals
  static addInterval(interval: NodeJS.Timeout): void {
    this.intervals.add(interval);
  }

  static removeInterval(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  // Clean up all resources
  static cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.intervals.forEach(interval => clearInterval(interval));
    
    this.observers.clear();
    this.timeouts.clear();
    this.intervals.clear();
    
    cacheManager.clear();
  }

  // Get memory usage stats
  static getMemoryStats(): {
    observers: number;
    timeouts: number;
    intervals: number;
    cacheSize: number;
  } {
    return {
      observers: this.observers.size,
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      cacheSize: cacheManager.getStats().size
    };
  }
}

// Network optimization
export class NetworkOptimizer {
  private static requestQueue: Array<{
    request: () => Promise<any>;
    priority: number;
    timestamp: number;
  }> = [];
  
  private static isProcessing = false;
  private static maxConcurrentRequests = 3;
  private static activeRequests = 0;

  // Add request to queue with priority
  static queueRequest(
    request: () => Promise<any>, 
    priority: number = 1
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        request: async () => {
          try {
            const result = await request();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        priority,
        timestamp: Date.now()
      });

      // Sort by priority (higher first) and timestamp (older first)
      this.requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });

      this.processQueue();
    });
  }

  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeRequests >= this.maxConcurrentRequests) {
      return;
    }

    if (this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const requestItem = this.requestQueue.shift();

    if (requestItem) {
      this.activeRequests++;
      
      try {
        await requestItem.request();
      } catch (error) {
        console.error('Queued request failed:', error);
      } finally {
        this.activeRequests--;
      }
    }

    this.isProcessing = false;
    
    // Process next request if queue is not empty
    if (this.requestQueue.length > 0) {
      setTimeout(() => this.processQueue(), 10);
    }
  }

  // Get queue stats
  static getQueueStats(): {
    queueLength: number;
    activeRequests: number;
    maxConcurrentRequests: number;
  } {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      maxConcurrentRequests: this.maxConcurrentRequests
    };
  }
}

// React performance hooks
export const usePerformanceMonitor = (componentName: string) => {
  React.useEffect(() => {
    const endMeasure = PerformanceMonitor.startMeasure(componentName);
    return endMeasure;
  });
};

export const useMemoryCleanup = (cleanupFn: () => void) => {
  React.useEffect(() => {
    return () => {
      cleanupFn();
    };
  }, [cleanupFn]);
};

// Performance optimization recommendations
export const getPerformanceRecommendations = (): string[] => {
  const recommendations: string[] = [];
  const metrics = PerformanceMonitor.getMetrics();
  const memoryStats = MemoryManager.getMemoryStats();
  const queueStats = NetworkOptimizer.getQueueStats();

  // Check for slow components
  Object.entries(metrics).forEach(([component, metric]) => {
    if (metric.averageRenderTime > 50) {
      recommendations.push(`Consider optimizing ${component} - average render time: ${metric.averageRenderTime}ms`);
    }
  });

  // Check memory usage
  if (memoryStats.observers > 10) {
    recommendations.push(`High number of intersection observers (${memoryStats.observers}) - consider cleanup`);
  }

  if (memoryStats.timeouts > 20) {
    recommendations.push(`High number of active timeouts (${memoryStats.timeouts}) - consider cleanup`);
  }

  // Check network queue
  if (queueStats.queueLength > 10) {
    recommendations.push(`High network request queue (${queueStats.queueLength}) - consider request batching`);
  }

  return recommendations;
};

// Global performance monitoring setup
if (typeof window !== 'undefined') {
  // Monitor page load performance
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    console.log('Page load performance:', {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      totalTime: navigation.loadEventEnd - navigation.fetchStart
    });
  });

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.9) {
        console.warn('High memory usage detected:', {
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
          limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
        });
      }
    }, 30000); // Check every 30 seconds
  }
}