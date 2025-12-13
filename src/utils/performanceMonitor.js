/**
 * @module performanceMonitor
 * @description Performance measurement and tracking utility
 * 
 * Measures and tracks performance metrics throughout the application,
 * including latency measurements and statistical analysis. Uses circular
 * buffers to prevent memory bloat during long sessions.
 */

class PerformanceMonitor {
  /**
   * Create a new PerformanceMonitor
   */
  constructor() {
    this._metrics = new Map();
    this._activeMeasurements = new Map();
    this._maxMeasurements = 100;
  }

  /**
   * Start a performance measurement
   * 
   * @param {string} label - Measurement label
   * 
   * @example
   * performanceMonitor.startMeasurement('pitchDetection');
   */
  startMeasurement(label) {
    this._activeMeasurements.set(label, {
      startTime: Date.now(),
      startMark: `${label}_start_${Date.now()}`
    });
    

  }

  /**
   * End a performance measurement and return duration
   * 
   * @param {string} label - Measurement label
   * @returns {number} Duration in milliseconds
   * 
   * @example
   * const duration = performanceMonitor.endMeasurement('pitchDetection');
   * console.log(`Detection took ${duration}ms`);
   */
  endMeasurement(label) {
    const measurement = this._activeMeasurements.get(label);
    
    if (!measurement) {
      console.warn(`PerformanceMonitor: No active measurement for '${label}'`);
      return 0;
    }
    
    const endTime = Date.now();
    const duration = endTime - measurement.startTime;
    
    // Record the measurement
    this.recordMetric(label, duration);
    
    // Clean up
    this._activeMeasurements.delete(label);
    
    return duration;
  }

  /**
   * Record a metric value
   * 
   * @param {string} label - Metric label
   * @param {number} value - Metric value
   * 
   * @example
   * performanceMonitor.recordMetric('memoryUsage', 150.5);
   */
  recordMetric(label, value) {
    if (!this._metrics.has(label)) {
      this._metrics.set(label, []);
    }
    
    const measurements = this._metrics.get(label);
    measurements.push(value);
    
    // Maintain circular buffer
    if (measurements.length > this._maxMeasurements) {
      measurements.splice(0, measurements.length - this._maxMeasurements);
    }
  }

  /**
   * Get statistics for a metric
   * 
   * @param {string} label - Metric label
   * @returns {Object} Statistics object with avg, min, max, p95
   * 
   * @example
   * const stats = performanceMonitor.getStats('pitchDetection');
   * console.log(`Avg: ${stats.avg}ms, Min: ${stats.min}ms`);
   */
  getStats(label) {
    const measurements = this._metrics.get(label);
    
    if (!measurements || measurements.length === 0) {
      return { avg: 0, min: 0, max: 0, p95: 0 };
    }
    
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((acc, val) => acc + val, 0);
    const avg = sum / measurements.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || max;
    
    return {
      avg: Number(avg.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      p95: Number(p95.toFixed(2)),
      count: measurements.length
    };
  }

  /**
   * Log all statistics to console
   * 
   * @example
   * performanceMonitor.logStats();
   */
  logStats() {
    console.log('\n=== Performance Statistics ===');
    
    this._metrics.forEach((measurements, label) => {
      const stats = this.getStats(label);
      console.log(`${label}: avg=${stats.avg}ms, min=${stats.min}ms, max=${stats.max}ms, p95=${stats.p95}ms (${stats.count} samples)`);
    });
    
    console.log('==============================\n');
  }

  /**
   * Get all metrics labels
   * 
   * @returns {Array} Array of metric labels
   * 
   * @example
   * const labels = performanceMonitor.getMetricLabels();
   */
  getMetricLabels() {
    return Array.from(this._metrics.keys());
  }

  /**
   * Clear all measurements for a specific metric
   * 
   * @param {string} label - Metric label to clear
   * 
   * @example
   * performanceMonitor.clearMetric('pitchDetection');
   */
  clearMetric(label) {
    this._metrics.delete(label);
  }

  /**
   * Clear all measurements
   * 
   * @example
   * performanceMonitor.clearAll();
   */
  clearAll() {
    this._metrics.clear();
    this._activeMeasurements.clear();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
export default PerformanceMonitor;
