import { logger, LogLevel, useLogger } from "../../services/logger";
import { renderHook } from "@testing-library/react";

describe("Logger Service", () => {
  beforeEach(() => {
    logger.clearLogs();
    logger.configure({
      enableConsole: false,
      enableRemote: false,
      logLevel: LogLevel.DEBUG,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic logging", () => {
    it("should log debug messages", () => {
      logger.debug("TestComponent", "Debug message", { test: true });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe("Debug message");
      expect(logs[0].context).toEqual({ test: true });
    });

    it("should log info messages", () => {
      logger.info("TestComponent", "Info message");
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
    });

    it("should log warning messages", () => {
      logger.warning("TestComponent", "Warning message");
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.WARNING);
    });

    it("should log error messages with Error object", () => {
      const error = new Error("Test error");
      logger.error("TestComponent", "Error occurred", error, {
        errorCode: 500,
      });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error?.message).toBe("Test error");
      expect(logs[0].context).toEqual({ errorCode: 500 });
    });

    it("should log critical messages", () => {
      const error = new Error("Critical error");
      logger.critical("TestComponent", "System failure", error);
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.CRITICAL);
    });
  });

  describe("Log filtering", () => {
    beforeEach(() => {
      logger.debug("Component1", "Debug message");
      logger.info("Component2", "Info message");
      logger.warning("Component1", "Warning message");
      logger.error("Component2", "Error message");
    });

    it("should filter logs by level", () => {
      const errorLogs = logger.getLogs({ level: LogLevel.ERROR });
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe(LogLevel.ERROR);
    });

    it("should filter logs by component", () => {
      const component1Logs = logger.getLogs({ component: "Component1" });
      expect(component1Logs).toHaveLength(2);
      expect(
        component1Logs.every((log) => log.component === "Component1"),
      ).toBe(true);
    });

    it("should limit number of logs returned", () => {
      const limitedLogs = logger.getLogs({ limit: 2 });
      expect(limitedLogs).toHaveLength(2);
    });

    it("should combine filters", () => {
      const filteredLogs = logger.getLogs({
        component: "Component1",
        level: LogLevel.WARNING,
      });
      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].component).toBe("Component1");
      expect(filteredLogs[0].level).toBe(LogLevel.WARNING);
    });
  });

  describe("Log level configuration", () => {
    it("should respect log level settings", () => {
      logger.configure({ logLevel: LogLevel.WARNING });

      logger.debug("Test", "Debug message");
      logger.info("Test", "Info message");
      logger.warning("Test", "Warning message");
      logger.error("Test", "Error message");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARNING);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    it("should not log below configured level", () => {
      logger.configure({ logLevel: LogLevel.ERROR });

      logger.debug("Test", "Debug");
      logger.info("Test", "Info");
      logger.warning("Test", "Warning");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe("Specialized logging methods", () => {
    it("should log component lifecycle", () => {
      logger.logComponentLifecycle("TestComponent", "mount", { id: 123 });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain("Component mount");
      expect(logs[0].context?.lifecycle).toBe("mount");
      expect(logs[0].context?.props).toEqual({ id: 123 });
    });

    it("should log render performance", () => {
      logger.logRenderPerformance("TestComponent", 16.7, 100);
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain("Render completed");
      expect(logs[0].context?.performance?.duration).toBe(16.7);
      expect(logs[0].context?.frame).toBe(100);
    });

    it("should log video events", () => {
      logger.logVideoEvent("video.mp4", "play", { currentTime: 10 });
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain("Video event: play");
      expect(logs[0].context?.videoFile).toBe("video.mp4");
      expect(logs[0].context?.currentTime).toBe(10);
    });

    it("should log API calls", () => {
      logger.logApiCall("/api/data", "GET", 200, 125.5);
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain("GET /api/data - 200");
      expect(logs[0].context?.status).toBe(200);
      expect(logs[0].performance?.duration).toBe(125.5);
    });

    it("should log API errors with error level", () => {
      logger.logApiCall("/api/data", "POST", 500, 50);
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });
  });

  describe("Log management", () => {
    it("should clear all logs", () => {
      logger.info("Test", "Message 1");
      logger.info("Test", "Message 2");
      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0); // Logs should be empty after clear
    });

    it("should export logs as JSON", () => {
      logger.info("Test", "Export test");
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe("Export test");
    });

    it("should respect max logs limit", () => {
      logger.configure({ maxLogs: 5 });

      for (let i = 0; i < 10; i++) {
        logger.info("Test", `Message ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Performance timing", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should track timer duration", () => {
      const mockPerformance = {
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByName: jest.fn().mockReturnValue([{ duration: 100 }]),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn(),
      };

      Object.defineProperty(window, "performance", {
        value: mockPerformance,
        writable: true,
      });

      logger.startTimer("test-operation");
      const duration = logger.endTimer("test-operation");

      expect(mockPerformance.mark).toHaveBeenCalledWith("test-operation-start");
      expect(mockPerformance.mark).toHaveBeenCalledWith("test-operation-end");
      expect(mockPerformance.measure).toHaveBeenCalledWith(
        "test-operation",
        "test-operation-start",
        "test-operation-end",
      );
      expect(duration).toBe(100);
    });
  });

  describe("useLogger hook", () => {
    it("should provide component-scoped logging functions", () => {
      const { result } = renderHook(() => useLogger("TestComponent"));

      result.current.info("Hook test message");
      const logs = logger.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].component).toBe("TestComponent");
      expect(logs[0].message).toBe("Hook test message");
    });

    it("should provide all log levels", () => {
      const { result } = renderHook(() => useLogger("TestComponent"));

      expect(result.current.debug).toBeDefined();
      expect(result.current.info).toBeDefined();
      expect(result.current.warning).toBeDefined();
      expect(result.current.error).toBeDefined();
      expect(result.current.logLifecycle).toBeDefined();
      expect(result.current.startTimer).toBeDefined();
      expect(result.current.endTimer).toBeDefined();
    });

    it("should scope timers to component", () => {
      const mockPerformance = {
        mark: jest.fn(),
        measure: jest.fn(),
        getEntriesByName: jest.fn().mockReturnValue([{ duration: 50 }]),
        clearMarks: jest.fn(),
        clearMeasures: jest.fn(),
      };

      Object.defineProperty(window, "performance", {
        value: mockPerformance,
        writable: true,
      });

      const { result } = renderHook(() => useLogger("TestComponent"));

      result.current.startTimer("operation");
      result.current.endTimer("operation");

      expect(mockPerformance.mark).toHaveBeenCalledWith(
        "TestComponent-operation-start",
      );
      expect(mockPerformance.mark).toHaveBeenCalledWith(
        "TestComponent-operation-end",
      );
    });
  });

  describe("Session management", () => {
    it("should generate unique session ID", () => {
      const config1 = logger.getConfig();

      expect(config1.sessionId).toBeDefined();
      expect(config1.sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it("should include session ID in log entries", () => {
      logger.info("Test", "Message");
      const logs = logger.getLogs();

      expect(logs[0].sessionId).toBeDefined();
      expect(logs[0].sessionId).toMatch(/^session-/);
    });
  });

  describe("Configuration", () => {
    it("should update configuration", () => {
      logger.configure({
        maxLogs: 100,
        enableConsole: false,
        logLevel: LogLevel.ERROR,
      });

      const config = logger.getConfig();
      expect(config.maxLogs).toBe(100);
      expect(config.enableConsole).toBe(false);
      expect(config.logLevel).toBe(LogLevel.ERROR);
    });

    it("should log configuration changes", () => {
      // Enable console to trigger configuration logging
      logger.configure({ maxLogs: 50, enableConsole: true });
      const logs = logger.getLogs();

      const configLog = logs.find(
        (log) => log.message === "Configuration updated",
      );
      expect(configLog).toBeDefined();
      expect(configLog?.context).toEqual({ maxLogs: 50, enableConsole: true });
    });
  });
});
