/**
 * Test setup for Node.js environment
 * Provides browser API mocks for DOMParser, localStorage, and FileReader
 */

import { JSDOM } from 'jsdom';

// Mock DOMParser
global.DOMParser = class DOMParser {
  parseFromString(string, type) {
    const parser = new JSDOM(string, {
      contentType: 'text/xml'
    });
    return parser.window.document;
  }
};

// Mock localStorage
const storageData = {};
global.localStorage = {
  getItem(key) {
    return storageData[key] || null;
  },
  
  setItem(key, value) {
    storageData[key] = value;
  },
  
  removeItem(key) {
    delete storageData[key];
  },
  
  clear() {
    Object.keys(storageData).forEach(key => delete storageData[key]);
  },
  
  get length() {
    return Object.keys(storageData).length;
  },
  
  key(index) {
    return Object.keys(storageData)[index];
  }
};

// Mock FileReader
global.FileReader = class FileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
  
  readAsText(file) {
    // Simulate async file reading
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: this });
      }
    }, 0);
  }
};

// Mock performance API
global.performance = {
  now: () => Date.now(),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
    jsHeapSizeLimit: 500 * 1024 * 1024 // 500MB
  }
};

// Mock Tone.js for testing
global.Tone = {
  Transport: {
    bpm: { value: 120 },
    start: () => {},
    stop: () => {},
    pause: () => {},
    scheduledEvents: [],
    schedule: (callback, time) => {
      const eventId = `event-${Math.random()}`;
      global.Tone.Transport.scheduledEvents.push({ id: eventId, callback, time });
      return eventId;
    },
    clear: (eventId) => {
      global.Tone.Transport.scheduledEvents =
        global.Tone.Transport.scheduledEvents.filter(event => event.id !== eventId);
    }
  },
  context: {
    state: 'running'
  },
  // Mock constructors for audio components
  AMSynth: class MockAMSynth {},
  MembraneSynth: class MockMembraneSynth {
    constructor() {
      this.volume = { value: 0 };
      this.triggerCount = 0;
    }
    toDestination() { return this; }
    triggerAttackRelease(note, duration, time) {
      this.triggerCount++;
      this.lastNote = note;
      this.lastTime = time;
    }
  },
  PolySynth: class MockPolySynth {
    constructor() {
      this.volume = { value: 0 };
      this.maxPolyphony = 6;
      this.notes = [];
    }
    set(config) {
      Object.assign(this, config);
      return this;
    }
    toDestination() { return this; }
    triggerAttackRelease(frequency, duration, time, velocity) {
      this.notes.push({ frequency, duration, time, velocity });
    }
  },
  Sampler: class MockSampler {
    constructor(config) {
      this.urls = config.urls;
      this.baseUrl = config.baseUrl;
      this.volume = { value: config.volume };
      this.notes = [];
      this.loaded = false;

      // Simulate async loading
      setTimeout(() => {
        this.loaded = true;
        if (config.onload) config.onload();
      }, 10);
    }
    toDestination() { return this; }
    triggerAttackRelease(noteName, duration, time, velocity) {
      this.notes.push({ noteName, duration, time, velocity });
    }
  },
  Frequency: {
    midi: {
      toFrequency: (midi) => midi * 10, // Mock frequency conversion
      toNote: (midi) => `Note${midi}`
    }
  }
};

// Mock OpenSheetMusicDisplay for testing
global.opensheetmusicdisplay = {
  OpenSheetMusicDisplay: class MockOpenSheetMusicDisplay {
    constructor(container, config) {
      this.container = container;
      this.config = config;
      this.musicXML = null;
      this.isRendered = false;
    }

    async load(xmlString) {
      this.musicXML = xmlString;
      return Promise.resolve();
    }

    async render() {
      this.isRendered = true;
      // Create a mock SVG element
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.innerHTML = '<g data-note="mock-note"><ellipse cx="50" cy="100" rx="5" ry="5"/></g>';
      this.container.appendChild(svg);
      return Promise.resolve();
    }

    clear() {
      this.musicXML = null;
      this.isRendered = false;
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }
};

// Save original console methods
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console)
};

// Mock console colors for tests
global.console = {
  ...originalConsole,
  log: (...args) => {
    // Strip color codes in tests for cleaner output
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? arg.replace(/\u001b\[[0-9;]*m/g, '') : arg
    );
    originalConsole.log(...cleanArgs);
  },
  error: (...args) => {
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? arg.replace(/\u001b\[[0-9;]*m/g, '') : arg
    );
    originalConsole.error(...cleanArgs);
  },
  warn: (...args) => {
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? arg.replace(/\u001b\[[0-9;]*m/g, '') : arg
    );
    originalConsole.warn(...cleanArgs);
  },
  info: (...args) => {
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? arg.replace(/\u001b\[[0-9;]*m/g, '') : arg
    );
    originalConsole.info(...cleanArgs);
  },
  debug: (...args) => {
    const cleanArgs = args.map(arg => 
      typeof arg === 'string' ? arg.replace(/\u001b\[[0-9;]*m/g, '') : arg
    );
    originalConsole.debug(...cleanArgs);
  }
};

console.log('Test environment setup complete');
