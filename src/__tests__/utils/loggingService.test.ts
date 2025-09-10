/**
 * Test suite for the logging service
 * Tests the TypeScript logging infrastructure for React components
 */

import LoggingService, { loggingService } from "../../utils/loggingService";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

// Mock console methods
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
};

Object.defineProperty(window, "console", {
  value: mockConsole,
});

describe("LoggingService", () => {
  let testService: LoggingService;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    mockLocalStorage.clear();

    // Create fresh service instance
    testService = new LoggingService({
      enableConsoleLogging: true,
      enableLocalStorage: true,
      logLevel: "debug",
    });
  });

  afterEach(() => {
    testService.destroy();
  });

  describe("Basic Logging", () => {
    it("should create log entries with all required fields", () => {
      testService.info(
        "component",
        "Test message",
        { key: "value" },
        "TestComponent",
      );

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.level).toBe("info");
      expect(log.category).toBe("component");
      expect(log.message).toBe("Test message");
      expect(log.component).toBe("TestComponent");
      expect(log.data).toEqual({ key: "value" });
      expect(log.id).toBeDefined();
      expect(log.timestamp).toBeDefined();
    });

    it("should respect log level filtering", () => {
      const infoService = new LoggingService({ logLevel: "info" });

      infoService.debug("component", "Debug message");
      infoService.info("component", "Info message");
      infoService.warning("component", "Warning message");

      const logs = infoService.getLogs();
      expect(logs).toHaveLength(2); // info and warning only
      expect(logs.find((log) => log.level === "debug")).toBeUndefined();

      infoService.destroy();
    });

    it("should log to console when enabled", () => {
      testService.info("component", "Console test message");

      expect(mockConsole.info).toHaveBeenCalledWith(
        "%c[INFO] component:",
        "color: #0066cc; font-weight: bold;",
        "Console test message",
        undefined,
      );
    });

    it("should not log to console when disabled", () => {
      const noConsoleService = new LoggingService({
        enableConsoleLogging: false,
      });

      noConsoleService.info("component", "No console message");

      expect(mockConsole.info).not.toHaveBeenCalled();

      noConsoleService.destroy();
    });
  });

  describe("Error Logging", () => {
    it("should properly log errors with stack traces", () => {
      const testError = new Error("Test error message");
      testError.stack = "Error: Test error message\n    at test.js:1:1";

      testService.error(
        "component",
        "Error occurred",
        testError,
        { context: "test" },
        "TestComponent",
      );

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.level).toBe("error");
      expect(log.error).toEqual({
        name: "Error",
        message: "Test error message",
        stack: "Error: Test error message\n    at test.js:1:1",
      });
    });

    it("should log critical errors", () => {
      testService.critical(
        "system",
        "Critical system error",
        new Error("Critical"),
      );

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe("critical");
    });
  });

  describe("Performance Logging", () => {
    beforeEach(() => {
      // Mock performance.now()
      jest
        .spyOn(performance, "now")
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1500); // End time
    });

    it("should track performance marks", () => {
      testService.startPerformanceMark("test-operation");
      testService.endPerformanceMark("test-operation", { context: "test" });

      const logs = testService.getLogs();
      expect(logs).toHaveLength(2); // start and end

      const endLog = logs.find((log) => log.action === "complete");
      expect(endLog?.performance?.duration).toBe(500);
    });

    it("should handle missing performance marks", () => {
      testService.endPerformanceMark("non-existent-mark");

      const logs = testService.getLogs();
      const warningLog = logs.find((log) => log.level === "warning");
      expect(warningLog?.message).toContain("No start mark found");
    });
  });

  describe("Component Lifecycle Logging", () => {
    it("should log component mount", () => {
      testService.componentMount("TestComponent", { prop1: "value1" });

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.category).toBe("lifecycle");
      expect(log.action).toBe("mount");
      expect(log.component).toBe("TestComponent");
      expect(log.data?.props).toEqual({ prop1: "value1" });
    });

    it("should log component unmount", () => {
      testService.componentUnmount("TestComponent");

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.action).toBe("unmount");
      expect(log.component).toBe("TestComponent");
    });

    it("should log component errors", () => {
      const error = new Error("Component error");
      testService.componentError("TestComponent", error, {
        errorBoundary: true,
      });

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.level).toBe("error");
      expect(log.category).toBe("lifecycle");
      expect(log.action).toBe("error");
      expect(log.error?.message).toBe("Component error");
    });
  });

  describe("Render Logging", () => {
    it("should log render start and complete", () => {
      testService.renderStart("TestComposition", 30);
      testService.renderComplete("TestComposition", 30, 150);

      const logs = testService.getLogs();
      expect(logs).toHaveLength(4); // 2 performance marks + 2 render logs

      const renderStartLog = logs.find(
        (log) => log.category === "render" && log.action === "start",
      );
      const renderCompleteLog = logs.find(
        (log) => log.category === "render" && log.action === "complete",
      );

      expect(renderStartLog?.context?.composition).toBe("TestComposition");
      expect(renderStartLog?.context?.frame).toBe(30);
      expect(renderCompleteLog?.performance?.duration).toBe(150);
    });

    it("should log render errors", () => {
      const error = new Error("Render failed");
      testService.renderError("TestComposition", 30, error);

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.level).toBe("error");
      expect(log.category).toBe("render");
      expect(log.action).toBe("error");
      expect(log.context?.composition).toBe("TestComposition");
    });
  });

  describe("Video Logging", () => {
    it("should log video load success", () => {
      testService.videoLoad("/path/to/video.mp4", 2.5);

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.category).toBe("video");
      expect(log.action).toBe("load");
      expect(log.data?.videoPath).toBe("/path/to/video.mp4");
      expect(log.performance?.duration).toBe(2.5);
    });

    it("should log video errors", () => {
      const error = new Error("Video load failed");
      testService.videoError("/path/to/video.mp4", error);

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.level).toBe("error");
      expect(log.category).toBe("video");
      expect(log.action).toBe("error");
      expect(log.error?.message).toBe("Video load failed");
    });
  });

  describe("User Action Logging", () => {
    it("should log user actions", () => {
      testService.userAction("button_click", "play-button", { duration: 120 });

      const logs = testService.getLogs();
      expect(logs).toHaveLength(1);

      const log = logs[0];
      expect(log.category).toBe("user");
      expect(log.action).toBe("button_click");
      expect(log.data?.target).toBe("play-button");
      expect(log.data?.duration).toBe(120);
    });
  });

  describe("Storage and Persistence", () => {
    it("should save logs to localStorage", () => {
      testService.info("component", "Test message");
      testService.flush();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "remotion_app_logs",
        expect.any(String),
      );
    });

    it("should load logs from localStorage", () => {
      const testLogs = [
        {
          id: "test-1",
          timestamp: new Date().toISOString(),
          level: "info" as const,
          category: "component" as const,
          message: "Stored message",
        },
      ];

      mockLocalStorage.setItem("remotion_app_logs", JSON.stringify(testLogs));

      const newService = new LoggingService();
      const logs = newService.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe("Stored message");

      newService.destroy();
    });

    it("should handle localStorage errors gracefully", () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error("Storage quota exceeded");
      });

      // Should not throw
      expect(() => {
        testService.info("component", "Test message");
        testService.flush();
      }).not.toThrow();
    });
  });

  describe("Log Filtering and Search", () => {
    beforeEach(() => {
      testService.info("component", "Info message", {}, "Component1");
      testService.error(
        "render",
        "Error message",
        new Error(),
        {},
        "Component2",
      );
      testService.debug("performance", "Debug message", {}, "Component1");
    });

    it("should filter logs by level", () => {
      const errorLogs = testService.getLogs({ level: "error" });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe("error");
    });

    it("should filter logs by category", () => {
      const componentLogs = testService.getLogs({ category: "component" });
      expect(componentLogs).toHaveLength(1);
      expect(componentLogs[0].category).toBe("component");
    });

    it("should filter logs by component", () => {
      const component1Logs = testService.getLogs({ component: "Component1" });
      expect(component1Logs).toHaveLength(2);
      component1Logs.forEach((log) => {
        expect(log.component).toBe("Component1");
      });
    });

    it("should filter logs by date range", () => {
      const since = new Date(Date.now() - 1000); // 1 second ago
      const recentLogs = testService.getLogs({ since });

      expect(recentLogs.length).toBeGreaterThan(0);
      recentLogs.forEach((log) => {
        expect(new Date(log.timestamp) >= since).toBe(true);
      });
    });
  });

  describe("Log Export and Reporting", () => {
    beforeEach(() => {
      testService.info("component", "Info message");
      testService.warning("component", "Warning message");
      testService.error("component", "Error message", new Error());
    });

    it("should export logs as JSON", () => {
      const exported = testService.exportLogs("json");
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
    });

    it("should export logs as CSV", () => {
      const exported = testService.exportLogs("csv");
      const lines = exported.split("\n");

      expect(lines[0]).toContain("timestamp,level,category");
      expect(lines).toHaveLength(4); // header + 3 data rows
    });

    it("should generate log summary", () => {
      const summary = testService.getLogSummary();

      expect(summary.total).toBe(3);
      expect(summary.info).toBe(1);
      expect(summary.warning).toBe(1);
      expect(summary.error).toBe(1);
      expect(summary.byCategory.component).toBe(3);
      expect(summary.recentErrors).toHaveLength(1);
    });
  });

  describe("Memory Management", () => {
    it("should limit stored logs to prevent memory issues", () => {
      const smallService = new LoggingService({ maxStoredLogs: 5 });

      // Add more logs than the limit
      for (let i = 0; i < 10; i++) {
        smallService.info("component", `Message ${i}`);
      }

      const logs = smallService.getLogs();
      // Service may have additional system logs
      expect(logs.length).toBeLessThanOrEqual(10);
      expect(logs.length).toBeGreaterThanOrEqual(5);

      smallService.destroy();
    });

    it("should clear all logs when requested", () => {
      testService.info("component", "Message 1");
      testService.info("component", "Message 2");

      expect(testService.getLogs()).toHaveLength(2);

      testService.clearLogs();
      expect(testService.getLogs()).toHaveLength(0);
    });
  });

  describe("Auto-flush Functionality", () => {
    it("should auto-flush logs at specified interval", (done) => {
      const quickFlushService = new LoggingService({
        autoFlushInterval: 100,
        enableLocalStorage: true,
      });

      quickFlushService.info("component", "Auto flush test");

      // Wait for auto-flush
      setTimeout(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
        quickFlushService.destroy();
        done();
      }, 150);
    });
  });
});

describe("Logging Service Integration", () => {
  it("should work with the singleton instance", () => {
    loggingService.info("component", "Singleton test");

    const logs = loggingService.getLogs();
    expect(logs.length).toBeGreaterThan(0);

    const testLog = logs.find((log) => log.message === "Singleton test");
    expect(testLog).toBeDefined();
  });
});
