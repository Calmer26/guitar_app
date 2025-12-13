/**
 * Unit tests for Storage module
 * 
 * Tests LocalStorage abstraction with schema versioning,
 * quota management, and error recovery.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { Storage, STORAGE_KEYS } from '../../core/storage.js';

// Mock localStorage for Node.js testing
class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }
  
  getItem(key) {
    return this.store.get(key) || null;
  }
  
  setItem(key, value) {
    this.store.set(key, value);
  }
  
  removeItem(key) {
    this.store.delete(key);
  }
  
  clear() {
    this.store.clear();
  }
  
  key(index) {
    return Array.from(this.store.keys())[index];
  }
  
  get length() {
    return this.store.size;
  }
}

// Helper to create fresh storage with isolated localStorage
function createIsolatedStorage() {
  global.localStorage = new LocalStorageMock();
  return new Storage();
}

test('Storage - get/set/delete operations', () => {
  const storage = createIsolatedStorage();
  
  // Set value
  const success = storage.set('testKey', { foo: 'bar' });
  assert.strictEqual(success, true, 'Set should succeed');
  
  // Get value
  const value = storage.get('testKey');
  assert.deepStrictEqual(value, { foo: 'bar' }, 'Retrieved value should match');
  
  // Delete value
  storage.delete('testKey');
  const deletedValue = storage.get('testKey', 'default');
  assert.strictEqual(deletedValue, 'default', 'Deleted key should return default');
});

test('Storage - namespace collision prevention', () => {
  const storage = createIsolatedStorage();
  
  storage.set('testKey', 'namespaced');
  
  // Check that key is prefixed
  const rawValue = localStorage.getItem('g4:testKey');
  assert.ok(rawValue, 'Key should be prefixed with g4:');
  
  // Non-namespaced key should not interfere
  localStorage.setItem('testKey', 'direct');
  const namespacedValue = storage.get('testKey');
  assert.strictEqual(namespacedValue, 'namespaced', 'Namespace should prevent collision');
});

test('Storage - schema versioning (wrap/unwrap)', () => {
  const storage = createIsolatedStorage();
  
  storage.set('versionedKey', { data: 'test' });
  
  // Check wrapped structure
  const rawValue = localStorage.getItem('g4:versionedKey');
  const wrapped = JSON.parse(rawValue);
  
  assert.ok(wrapped.version, 'Data should have version');
  assert.ok(wrapped.timestamp, 'Data should have timestamp');
  assert.deepStrictEqual(wrapped.data, { data: 'test' }, 'Data should be wrapped');
  
  // Unwrap should return original data
  const unwrapped = storage.get('versionedKey');
  assert.deepStrictEqual(unwrapped, { data: 'test' }, 'Unwrapped data should match');
});

test('Storage - quota exceeded handling', () => {
  const storage = createIsolatedStorage();
  
  // Mock quota exceeded error
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => {
    const error = new Error('QuotaExceededError');
    error.name = 'QuotaExceededError';
    throw error;
  };
  
  // Should not crash, should return false
  const success = storage.set('largeKey', 'data');
  assert.strictEqual(success, false, 'Set should fail gracefully on quota exceeded');
  
  // Restore original
  localStorage.setItem = originalSetItem;
});

test('Storage - circular buffer for history (prune at 100)', () => {
  const storage = createIsolatedStorage();
  
  // Add 105 entries
  for (let i = 0; i < 105; i++) {
    const result = {
      exerciseId: `ex-${i}`,
      timestamp: Date.now() + i,
      aggregate: { correctPercentage: 80 + i },
      tolerances: { pitch: 50, timing: 100 },
      duration: 60000
    };
    storage.addPerformanceResult(result);
  }
  
  const history = storage.get(STORAGE_KEYS.PERFORMANCE_HISTORY, []);
  
  assert.strictEqual(history.length, 100, 'History should be limited to 100 entries');
  assert.strictEqual(history[0].exerciseId, 'ex-5', 'Oldest entries should be removed');
  assert.strictEqual(history[99].exerciseId, 'ex-104', 'Newest entries should be kept');
});

test('Storage - keys() method lists all namespaced keys', () => {
  const storage = createIsolatedStorage();
  
  storage.set('key1', 'value1');
  storage.set('key2', 'value2');
  storage.set('key3', 'value3');
  
  const keys = storage.keys();
  
  assert.ok(keys.includes('key1'), 'Should include key1');
  assert.ok(keys.includes('key2'), 'Should include key2');
  assert.ok(keys.includes('key3'), 'Should include key3');
  assert.strictEqual(keys.length, 3, 'Should have exactly 3 keys');
});

test('Storage - keys() with prefix filter', () => {
  const storage = createIsolatedStorage();
  
  storage.set('exerciseCache:ex1', 'data1');
  storage.set('exerciseCache:ex2', 'data2');
  storage.set('settings', 'data3');
  
  const cacheKeys = storage.keys('exerciseCache:');
  
  assert.strictEqual(cacheKeys.length, 2, 'Should find 2 cache keys');
  assert.ok(cacheKeys.includes('exerciseCache:ex1'), 'Should include ex1');
  assert.ok(cacheKeys.includes('exerciseCache:ex2'), 'Should include ex2');
});

test('Storage - has() method checks existence', () => {
  const storage = createIsolatedStorage();
  
  storage.set('existingKey', 'value');
  
  assert.strictEqual(storage.has('existingKey'), true, 'Should return true for existing key');
  assert.strictEqual(storage.has('nonExistentKey'), false, 'Should return false for non-existent key');
});

test('Storage - clear() removes all namespaced keys', () => {
  const storage = createIsolatedStorage();
  
  storage.set('key1', 'value1');
  storage.set('key2', 'value2');
  
  storage.clear();
  
  const keys = storage.keys();
  assert.strictEqual(keys.length, 0, 'Should have no keys after clear');
});

test('Storage - getStorageUsage() calculates usage', () => {
  const storage = createIsolatedStorage();
  
  storage.set('testData', { large: 'x'.repeat(1000) });
  
  const usage = storage.getStorageUsage();
  
  assert.ok(usage.usedBytes > 0, 'Should report usage in bytes');
  assert.ok(usage.usedKB > 0, 'Should report usage in KB');
  assert.ok(usage.usedMB >= 0, 'Should report usage in MB');
});

test('Storage - exportData() produces valid JSON', () => {
  const storage = createIsolatedStorage();
  
  storage.set('key1', { data: 'test1' });
  storage.set('key2', { data: 'test2' });
  
  const exported = storage.exportData();
  const parsed = JSON.parse(exported);
  
  assert.ok(parsed.key1, 'Should include key1 in export');
  assert.ok(parsed.key2, 'Should include key2 in export');
  assert.deepStrictEqual(parsed.key1, { data: 'test1' }, 'Exported data should match');
});

test('Storage - importData() imports valid JSON', () => {
  const storage = createIsolatedStorage();
  
  const data = {
    key1: { data: 'imported1' },
    key2: { data: 'imported2' }
  };
  
  const jsonData = JSON.stringify(data);
  const success = storage.importData(jsonData);
  
  assert.strictEqual(success, true, 'Import should succeed');
  assert.deepStrictEqual(storage.get('key1'), { data: 'imported1' }, 'Should import key1');
  assert.deepStrictEqual(storage.get('key2'), { data: 'imported2' }, 'Should import key2');
});

test('Storage - default values returned when key not found', () => {
  const storage = createIsolatedStorage();
  
  const defaultObj = { default: true };
  const value = storage.get('nonExistent', defaultObj);
  
  assert.deepStrictEqual(value, defaultObj, 'Should return default value');
});

test('Storage - handles invalid JSON gracefully', () => {
  const storage = createIsolatedStorage();
  
  // Manually corrupt data in localStorage
  localStorage.setItem('g4:corruptKey', '{invalid json}');
  
  const value = storage.get('corruptKey', 'fallback');
  assert.strictEqual(value, 'fallback', 'Should return fallback on invalid JSON');
});

test('Storage - in-memory fallback when LocalStorage unavailable', () => {
  // Mock localStorage throwing error
  const original = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('SecurityError');
  };
  
  const storage = createIsolatedStorage();
  assert.strictEqual(storage.usingFallback, true, 'Should use fallback when localStorage fails');
  
  // Test operations still work
  const success = storage.set('fallbackKey', 'fallbackValue');
  assert.strictEqual(success, true, 'Set should work in fallback mode');
  
  const value = storage.get('fallbackKey');
  assert.strictEqual(value, 'fallbackValue', 'Get should work in fallback mode');
  
  // Restore
  localStorage.setItem = original;
});

test('Storage - cleanup() frees space', () => {
  const storage = createIsolatedStorage();
  
  // Add some data
  storage.set('testData', 'x'.repeat(100));
  
  const beforeCleanup = storage.getStorageUsage();
  
  // Cleanup should succeed
  const success = storage.cleanup(1000);
  assert.strictEqual(success, true, 'Cleanup should succeed');
  
  const afterCleanup = storage.getStorageUsage();
  assert.ok(afterCleanup.usedBytes <= beforeCleanup.usedBytes, 'Should reduce usage');
});

test('Storage - addPerformanceResult() adds to history', () => {
  const storage = createIsolatedStorage();
  
  const result = {
    exerciseId: 'test-exercise',
    timestamp: Date.now(),
    aggregate: { correctPercentage: 85, notesCorrect: 34 },
    tolerances: { pitch: 50, timing: 100 },
    duration: 120000
  };
  
  const success = storage.addPerformanceResult(result);
  assert.strictEqual(success, true, 'Should successfully add result');
  
  const history = storage.get(STORAGE_KEYS.PERFORMANCE_HISTORY, []);
  assert.strictEqual(history.length, 1, 'History should have 1 entry');
  assert.strictEqual(history[0].exerciseId, 'test-exercise', 'Should store exercise ID');
  assert.deepStrictEqual(history[0].score, result.aggregate, 'Should store score');
});

test('Storage - STORAGE_KEYS constants defined correctly', () => {
  assert.strictEqual(STORAGE_KEYS.SETTINGS, 'settings', 'SETTINGS should be "settings"');
  assert.strictEqual(STORAGE_KEYS.LAST_EXERCISE, 'lastExercise', 'LAST_EXERCISE should be "lastExercise"');
  assert.strictEqual(STORAGE_KEYS.EXERCISE_CACHE, 'exerciseCache:', 'EXERCISE_CACHE should have colon');
  assert.strictEqual(STORAGE_KEYS.PERFORMANCE_HISTORY, 'perfHistory', 'PERFORMANCE_HISTORY should be "perfHistory"');
  assert.strictEqual(STORAGE_KEYS.AUDIO_CONTEXT_STATE, 'audioContextState', 'AUDIO_CONTEXT_STATE should be "audioContextState"');
});
