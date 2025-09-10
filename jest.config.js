module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",

  // Ensure proper parsing of TypeScript files
  extensionsToTreatAsEsm: [],

  // Root directories
  roots: ["<rootDir>/src"],

  // Directories to ignore completely
  testPathIgnorePatterns: ["/node_modules/"],

  // Test file patterns
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.(ts|tsx|js)",
    "<rootDir>/src/**/*.(test|spec).(ts|tsx|js)",
  ],

  // Module file extensions
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Transform configuration
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
      },
    ],
    "^.+\\.jsx?$": [
      "ts-jest",
      {
        useESM: false,
      },
    ],
  },

  // Module name mapping for assets and styles
  moduleNameMapper: {
    // Mock Remotion modules
    "^remotion$": "<rootDir>/src/__mocks__/remotion.tsx",
    "^@remotion/(.*)$": "<rootDir>/src/__mocks__/@remotion/cli.js",

    // Handle CSS imports
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",

    // Handle static files
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/src/__mocks__/fileMock.js",

    // Handle module path mapping
    "^@/(.*)$": "<rootDir>/src/$1",
    "^~/(.*)$": "<rootDir>/src/$1",
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],

  // Coverage configuration
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/index.ts",
    "!src/**/__tests__/**/*",
    "!src/**/*.test.*",
    "!src/**/*.spec.*",
    "!src/**/__mocks__/**/*",
  ],

  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Test environment options
  testEnvironmentOptions: {
    url: "http://localhost:3000",
    customExportConditions: ["node", "node-addons"],
  },

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Timeout configuration
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Transform ignore patterns for node_modules
  transformIgnorePatterns: [
    "node_modules/(?!(remotion|@remotion|@mui|@emotion)/)",
  ],

  // Global setup and teardown
  globalSetup: undefined,
  globalTeardown: undefined,
};
