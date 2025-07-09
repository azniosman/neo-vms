// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure testing library
configure({ testIdAttribute: 'data-testid' });

// Mock environment variables
process.env.REACT_APP_API_URL = 'http://localhost:3001/api';
process.env.REACT_APP_SOCKET_URL = 'http://localhost:3001';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock crypto.getRandomValues
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn(() => new Uint8Array(16)),
  },
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

// Mock File and FileReader
global.File = class File {
  constructor(bits, name, options) {
    this.bits = bits;
    this.name = name;
    this.options = options;
  }
};

global.FileReader = class FileReader {
  constructor() {
    this.readAsDataURL = jest.fn();
    this.readAsText = jest.fn();
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }
};

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        { stop: jest.fn() }
      ])
    })
  }
});

// Mock geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  }
});

// Silence console warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Clear mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});