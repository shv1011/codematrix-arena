// Performance monitoring and optimization utilities

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ComponentMetric {
  componentName: string;
  renderTime: number;
  renderCount: number;
  lastRender: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private componentMetrics: Map<string, ComponentMetric> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private maxMetrics = 1000; // Keep last 1000 metrics

  constructor() {
    this.setupPerformanceObservers();
  }

  // Setup performance observers
  private setupPerformanceObservers() {
    if (typeof window === 'undefined') return;

    // Observe navigation timing
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            this.recordMetric('navigation', entry.duration, {
              type: entry.entryType,
              name: entry.name
            });
          });
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navObserver);
      } catch (error) {
        console.warn('Navigation observer not supported:', error);
      }

      // Observe resource loading
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 100) { // Only log slow resources
              this.recordMetric('resource', entry.duration, {
                name: entry.name,
                type: entry.initiatorType
              });
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.set('resource', resourceObserver);
      } catch (error) {
        console.warn('Resource observer not supported:', error);
      }

      // Observe long tasks
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            this.recordMetric('longtask', entry.duration, {
              startTime: entry.startTime
            });
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }
    }
  }

  // Record a performance metric
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log performance issues
    this.checkPerformanceThresholds(metric);
  }

  // Check for performance issues
  private checkPerformanceThresholds(metric: PerformanceMetric) {
    const thresholds = {
      'api_call': 2000, // 2 seconds
      'component_render': 16, // 16ms (60fps)
      'database_query': 1000, // 1 second
      'ai_evaluation': 10000, // 10 seconds
      'longtask': 50, // 50ms
      'resource': 1000 // 1 second
    };

    const threshold = thresholds[metric.name as keyof typeof thresholds];
    if (threshold && metric.value > threshold) {
      console.warn(`Performance issue detected: ${metric.name} took ${metric.value}ms (threshold: ${threshold}ms)`, metric.metadata);
    }
  }

  // Time a function execution
  async timeFunction<T>(name: string, fn: () => Promise<T> | T, metadata?: Record<string, any>): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  // Time a synchronous function
  timeFunctionSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  // Record component render metrics
  recordComponentRender(componentName: string, renderTime: number) {
    const existing = this.componentMetrics.get(componentName);
    if (existing) {
      existing.renderTime = renderTime;
      existing.renderCount++;
      existing.lastRender = Date.now();
    } else {
      this.componentMetrics.set(componentName, {
        componentName,
        renderTime,
        renderCount: 1,
        lastRender: Date.now()
      });
    }

    this.recordMetric('component_render', renderTime, { componentName });
  }

  // Get performance summary
  getPerformanceSummary(): {
    totalMetrics: number;
    averageApiTime: number;
    slowestOperations: PerformanceMetric[];
    componentStats: ComponentMetric[];
    memoryUsage?: MemoryInfo;
  } {
    const apiMetrics = this.metrics.filter(m => m.name === 'api_call');
    const averageApiTime = apiMetrics.length > 0 
      ? apiMetrics.reduce((sum, m) => sum + m.value, 0) / apiMetrics.length 
      : 0;

    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const componentStats = Array.from(this.componentMetrics.values())
      .sort((a, b) => b.renderTime - a.renderTime);

    const summary = {
      totalMetrics: this.metrics.length,
      averageApiTime,
      slowestOperations,
      componentStats,
      memoryUsage: this.getMemoryUsage()
    };

    return summary;
  }

  // Get memory usage (if available)
  private getMemoryUsage(): MemoryInfo | undefined {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory;
    }
    return undefined;
  }

  // Get metrics by name
  getMetricsByName(name: string, limit = 100): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.name === name)
      .slice(-limit);
  }

  // Clear all metrics
  clearMetrics() {
    this.metrics = [];
    this.componentMetrics.clear();
  }

  // Get real-time performance stats
  getRealTimeStats(): {
    fps: number;
    memoryUsage: number;
    activeConnections: number;
    lastUpdate: number;
  } {
    const memoryInfo = this.getMemoryUsage();
    
    return {
      fps: this.calculateFPS(),
      memoryUsage: memoryInfo ? memoryInfo.usedJSHeapSize / 1024 / 1024 : 0, // MB
      activeConnections: this.getActiveConnectionCount(),
      lastUpdate: Date.now()
    };
  }

  // Calculate approximate FPS
  private calculateFPS(): number {
    const renderMetrics = this.metrics
      .filter(m => m.name === 'component_render')
      .slice(-60); // Last 60 renders

    if (renderMetrics.length < 2) return 0;

    const timeSpan = renderMetrics[renderMetrics.length - 1].timestamp - renderMetrics[0].timestamp;
    return Math.round((renderMetrics.length / timeSpan) * 1000);
  }

  // Get active connection count (WebSocket, etc.)
  private getActiveConnectionCount(): number {
    // This would be implemented based on your connection management
    return 0;
  }

  // Cleanup observers
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const startTime = performance.now();

  return {
    recordRender: () => {
      const renderTime = performance.now() - startTime;
      performanceMonitor.recordComponentRender(componentName, renderTime);
    }
  };
};

// Decorator for timing functions
export const timed = (name: string, metadata?: Record<string, any>) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.timeFunction(
        name || `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args),
        metadata
      );
    };

    return descriptor;
  };
};

// Memory leak detection
export class MemoryLeakDetector {
  private snapshots: Map<string, number> = new Map();
  private thresholds = {
    components: 1000,
    eventListeners: 500,
    timers: 100
  };

  takeSnapshot(label: string) {
    if (typeof window === 'undefined') return;

    const memoryInfo = (performance as any).memory;
    if (memoryInfo) {
      this.snapshots.set(label, memoryInfo.usedJSHeapSize);
    }
  }

  compareSnapshots(before: string, after: string): number {
    const beforeSize = this.snapshots.get(before) || 0;
    const afterSize = this.snapshots.get(after) || 0;
    return afterSize - beforeSize;
  }

  detectLeaks(): string[] {
    const warnings: string[] = [];

    // Check for excessive DOM nodes
    if (typeof document !== 'undefined') {
      const nodeCount = document.querySelectorAll('*').length;
      if (nodeCount > this.thresholds.components) {
        warnings.push(`High DOM node count: ${nodeCount}`);
      }
    }

    // Check memory growth
    const snapshots = Array.from(this.snapshots.entries());
    if (snapshots.length >= 2) {
      const growth = snapshots[snapshots.length - 1][1] - snapshots[0][1];
      if (growth > 50 * 1024 * 1024) { // 50MB growth
        warnings.push(`High memory growth: ${Math.round(growth / 1024 / 1024)}MB`);
      }
    }

    return warnings;
  }
}

export const memoryLeakDetector = new MemoryLeakDetector();

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if (typeof window === 'undefined') return null;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

  return {
    scriptCount: scripts.length,
    styleCount: styles.length,
    totalResources: scripts.length + styles.length,
    scripts: scripts.map(s => (s as HTMLScriptElement).src),
    styles: styles.map(s => (s as HTMLLinkElement).href)
  };
};

// Performance optimization recommendations
export const getOptimizationRecommendations = (): string[] => {
  const recommendations: string[] = [];
  const summary = performanceMonitor.getPerformanceSummary();

  if (summary.averageApiTime > 1000) {
    recommendations.push("Consider implementing API response caching");
  }

  if (summary.componentStats.some(c => c.renderTime > 16)) {
    recommendations.push("Some components are rendering slowly - consider React.memo or useMemo");
  }

  const memoryWarnings = memoryLeakDetector.detectLeaks();
  recommendations.push(...memoryWarnings.map(w => `Memory issue: ${w}`));

  if (summary.slowestOperations.some(op => op.name === 'longtask' && op.value > 50)) {
    recommendations.push("Long tasks detected - consider breaking up heavy computations");
  }

  return recommendations;
};

export default {
  performanceMonitor,
  usePerformanceMonitor,
  timed,
  memoryLeakDetector,
  analyzeBundleSize,
  getOptimizationRecommendations
};