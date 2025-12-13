/**
 * @module eventEmitter
 * @description Event-driven communication utility for loose coupling between modules
 * 
 * Provides a lightweight event system that allows modules to communicate
 * without direct dependencies. Supports multiple listeners, error handling,
 * and cleanup functions.
 */

/**
 * @module eventEmitter
 * @description Event-driven communication utility for loose coupling between modules
 * 
 * Provides a lightweight event system that allows modules to communicate
 * without direct dependencies. Supports multiple listeners, error handling,
 * and cleanup functions.
 */

export class EventEmitter {
  /**
   * Create a new EventEmitter
   */
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Register an event listener
   * 
   * @param {string} event - Event name (e.g., 'playback:tick')
   * @param {Function} listener - Function to call when event is emitted
   * @returns {Function} Unsubscribe function to remove the listener
   * 
   * @example
   * const emitter = new EventEmitter();
   * const unsubscribe = emitter.on('user:login', (data) => {
   *   console.log('User logged in:', data);
   * });
   * // Later: unsubscribe();
   */
  on(event, listener) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    
    const listeners = this._listeners.get(event);
    listeners.push(listener);
    
    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Remove an event listener
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Listener function to remove
   */
  off(event, listener) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // Clean up empty listener arrays
      if (listeners.length === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all listeners
   * 
   * @param {string} event - Event name
   * @param {*} data - Data to pass to listeners
   */
  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      // Create copy to avoid issues if listeners modify array
      const listenersCopy = [...listeners];
      
      listenersCopy.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`EventEmitter: Error in '${event}' listener:`, error);
          // Continue with other listeners even if one fails
        }
      });
    }
  }

  /**
   * Register a listener that fires only once
   * 
   * @param {string} event - Event name
   * @param {Function} listener - Function to call once
   * @returns {Function} Unsubscribe function
   * 
   * @example
   * const emitter = new EventEmitter();
   * emitter.once('data:loaded', (data) => {
   *   console.log('Data loaded once:', data);
   * });
   */
  once(event, listener) {
    const onceListener = (data) => {
      listener(data);
      this.off(event, onceListener);
    };
    
    return this.on(event, onceListener);
  }
}
