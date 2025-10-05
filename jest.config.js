module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // File patterns to test
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Transform files using Babel
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
};
