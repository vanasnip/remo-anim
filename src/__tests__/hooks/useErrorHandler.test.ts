import { renderHook, act } from "@testing-library/react";
import {
  useErrorHandler,
  useAsyncOperation,
  createVideoLoadError,
  createNetworkError,
  createRenderError,
  type ErrorHandlerOptions,
} from "../../hooks/useErrorHandler";

describe("useErrorHandler", () => {
  let mockConsoleError: jest.Mock;
  let originalConsoleError: typeof console.error;

  beforeAll(() => {
    // Store original console.error and create mock
    originalConsoleError = console.error;
    mockConsoleError = jest.fn();
    (console as any).error = mockConsoleError;
  });

  beforeEach(() => {
    mockConsoleError.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });

  describe("basic functionality", () => {
    it("should initialize with no error", () => {
      const { result } = renderHook(() => useErrorHandler());

      expect(result.current.errorState.hasError).toBe(false);
      expect(result.current.errorState.error).toBeUndefined();
      expect(result.current.errorState.errorId).toBeUndefined();
      expect(result.current.errorState.timestamp).toBeUndefined();
    });

    it("should handle errors and update state", () => {
      const { result } = renderHook(() => useErrorHandler());
      const testError = new Error("Test error");

      act(() => {
        result.current.handleError(testError, "test context");
      });

      expect(result.current.errorState.hasError).toBe(true);
      expect(result.current.errorState.error).toBe(testError);
      expect(result.current.errorState.errorId).toMatch(
        /^error_\d+_[a-z0-9]+$/,
      );
      expect(result.current.errorState.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T/,
      );
    });

    it("should clear error state", () => {
      const { result } = renderHook(() => useErrorHandler());
      const testError = new Error("Test error");

      act(() => {
        result.current.handleError(testError);
      });

      expect(result.current.errorState.hasError).toBe(true);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.errorState.hasError).toBe(false);
      expect(result.current.errorState.error).toBeUndefined();
    });

    it("should generate unique error IDs", () => {
      const { result } = renderHook(() => useErrorHandler());

      act(() => {
        result.current.handleError(new Error("Error 1"));
      });
      const firstId = result.current.errorState.errorId;

      act(() => {
        result.current.clearError();
        result.current.handleError(new Error("Error 2"));
      });
      const secondId = result.current.errorState.errorId;

      expect(firstId).not.toBe(secondId);
      expect(firstId).toMatch(/^error_\d+_[a-z0-9]+$/);
      expect(secondId).toMatch(/^error_\d+_[a-z0-9]+$/);
    });
  });

  describe("configuration options", () => {
    it("should call custom error handler", () => {
      const mockOnError = jest.fn();
      const options: ErrorHandlerOptions = { onError: mockOnError };
      const { result } = renderHook(() => useErrorHandler(options));
      const testError = new Error("Test error");

      act(() => {
        result.current.handleError(testError, "test context");
      });

      expect(mockOnError).toHaveBeenCalledWith(testError, "test context");
    });

    it("should handle errors in custom error handler", () => {
      const faultyOnError = jest.fn(() => {
        throw new Error("Error handler error");
      });
      const options: ErrorHandlerOptions = {
        onError: faultyOnError,
        logToConsole: true,
      };
      const { result } = renderHook(() => useErrorHandler(options));

      // Clear any previous calls
      mockConsoleError.mockClear();

      act(() => {
        result.current.handleError(new Error("Test error"));
      });

      expect(faultyOnError).toHaveBeenCalled();

      // Should have logged the custom error handler error
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Custom error handler threw an error:",
        expect.any(Error),
      );

      // Should still update error state despite handler error
      expect(result.current.errorState.hasError).toBe(true);
    });

    it("should respect logToConsole option", () => {
      const { result: resultWithLogging } = renderHook(() =>
        useErrorHandler({ logToConsole: true }),
      );
      const { result: resultWithoutLogging } = renderHook(() =>
        useErrorHandler({ logToConsole: false }),
      );

      // Clear any previous calls
      mockConsoleError.mockClear();

      act(() => {
        resultWithLogging.current.handleError(new Error("Logged error"));
      });

      // Should log for first handler
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error handled by useErrorHandler:",
        expect.objectContaining({
          message: "Logged error",
        }),
      );

      // Clear mock for silent error test
      mockConsoleError.mockClear();

      act(() => {
        resultWithoutLogging.current.handleError(new Error("Silent error"));
      });

      // The silent error should not have logged anything new
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe("executeWithErrorHandling", () => {
    it("should execute successful operations", async () => {
      const { result } = renderHook(() => useErrorHandler());
      const mockOperation = jest.fn().mockResolvedValue("success result");

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.executeWithErrorHandling(
          mockOperation,
          "test operation",
        );
      });

      expect(mockOperation).toHaveBeenCalled();
      expect(operationResult).toBe("success result");
      expect(result.current.errorState.hasError).toBe(false);
    });

    it("should handle failing operations", async () => {
      const { result } = renderHook(() => useErrorHandler());
      const testError = new Error("Operation failed");
      const mockOperation = jest.fn().mockRejectedValue(testError);

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.executeWithErrorHandling(
          mockOperation,
          "test operation",
        );
      });

      expect(mockOperation).toHaveBeenCalled();
      expect(operationResult).toBeNull();
      expect(result.current.errorState.hasError).toBe(true);
      expect(result.current.errorState.error).toBe(testError);
    });

    it("should handle synchronous operations", async () => {
      const { result } = renderHook(() => useErrorHandler());
      const syncOperation = jest.fn().mockReturnValue("sync result");

      let operationResult: any;
      await act(async () => {
        operationResult =
          await result.current.executeWithErrorHandling(syncOperation);
      });

      expect(syncOperation).toHaveBeenCalled();
      expect(operationResult).toBe("sync result");
    });

    it("should handle synchronous operations that throw", async () => {
      const { result } = renderHook(() => useErrorHandler());
      const testError = new Error("Sync error");
      const syncOperation = jest.fn().mockImplementation(() => {
        throw testError;
      });

      let operationResult: any;
      await act(async () => {
        operationResult =
          await result.current.executeWithErrorHandling(syncOperation);
      });

      expect(operationResult).toBeNull();
      expect(result.current.errorState.hasError).toBe(true);
      expect(result.current.errorState.error).toBe(testError);
    });
  });

  describe("retry functionality", () => {
    it("should retry last action successfully", async () => {
      const { result } = renderHook(() =>
        useErrorHandler({ retryAttempts: 2 }),
      );
      let callCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("First attempt failed");
        }
        return "success on retry";
      });

      // First attempt should fail
      await act(async () => {
        await result.current.executeWithErrorHandling(
          mockOperation,
          "retry test",
        );
      });

      expect(result.current.errorState.hasError).toBe(true);

      // Retry should succeed
      let retryResult: any;
      await act(async () => {
        retryResult = await result.current.retryLastAction();
      });

      expect(retryResult).toBe("success on retry");
      expect(result.current.errorState.hasError).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should not retry when no action is stored", async () => {
      const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();
      const { result } = renderHook(() => useErrorHandler());

      await act(async () => {
        await result.current.retryLastAction();
      });

      expect(mockConsoleWarn).toHaveBeenCalledWith("No action to retry");
      mockConsoleWarn.mockRestore();
    });

    it("should respect retry attempt limits", async () => {
      const mockConsoleWarn = jest.spyOn(console, "warn").mockImplementation();
      const { result } = renderHook(() =>
        useErrorHandler({ retryAttempts: 1 }),
      );
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("Always fails"));

      // Execute initial action
      await act(async () => {
        await result.current.executeWithErrorHandling(mockOperation);
      });

      // First retry
      await act(async () => {
        await result.current.retryLastAction();
      });

      // Second retry should be blocked
      await act(async () => {
        await result.current.retryLastAction();
      });

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        "Maximum retry attempts (1) reached for action",
      );
      expect(mockOperation).toHaveBeenCalledTimes(2); // Initial + 1 retry
      mockConsoleWarn.mockRestore();
    });

    it("should handle retry failures", async () => {
      const { result } = renderHook(() =>
        useErrorHandler({ retryAttempts: 2 }),
      );
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new Error("Always fails"));

      // Execute initial action
      await act(async () => {
        await result.current.executeWithErrorHandling(mockOperation);
      });

      // Retry should also fail
      await act(async () => {
        await result.current.retryLastAction();
      });

      expect(result.current.errorState.hasError).toBe(true);
      expect(result.current.errorState.error?.message).toBe("Always fails");
    });
  });

  describe("error logging", () => {
    it("should log detailed error information", () => {
      const { result } = renderHook(() =>
        useErrorHandler({ logToConsole: true }),
      );
      const testError = new Error("Detailed error");
      testError.stack = "Error stack trace";

      // Clear any previous calls
      mockConsoleError.mockClear();

      act(() => {
        result.current.handleError(testError, "detailed context");
      });

      expect(mockConsoleError).toHaveBeenCalledWith(
        "Error handled by useErrorHandler:",
        expect.objectContaining({
          id: expect.any(String),
          message: "Detailed error",
          name: "Error",
          stack: "Error stack trace",
          context: "detailed context",
          timestamp: expect.any(String),
        }),
      );
    });
  });
});

describe("useAsyncOperation", () => {
  it("should manage loading state", async () => {
    const { result } = renderHook(() => useAsyncOperation());
    const mockOperation = jest.fn().mockResolvedValue("result");

    expect(result.current.isLoading).toBe(false);

    let operationPromise: Promise<any>;
    act(() => {
      operationPromise = result.current.executeAsync(mockOperation);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await operationPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("should handle async errors", async () => {
    const { result } = renderHook(() => useAsyncOperation());
    const testError = new Error("Async error");
    const mockOperation = jest.fn().mockRejectedValue(testError);

    await act(async () => {
      await result.current.executeAsync(mockOperation);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.errorState.hasError).toBe(true);
    expect(result.current.errorState.error).toBe(testError);
  });

  it("should provide error management functions", async () => {
    const { result } = renderHook(() => useAsyncOperation());

    expect(typeof result.current.clearError).toBe("function");
    expect(typeof result.current.retryLastAction).toBe("function");
    expect(typeof result.current.executeAsync).toBe("function");
  });
});

describe("error utility functions", () => {
  describe("createVideoLoadError", () => {
    it("should create video load error with correct properties", () => {
      const videoPath = "/path/to/video.mp4";
      const originalError = new Error("Original error");
      const videoError = createVideoLoadError(videoPath, originalError);

      expect(videoError.message).toBe(
        "Failed to load video: /path/to/video.mp4",
      );
      expect(videoError.name).toBe("VideoLoadError");
      expect(videoError.cause).toBe(originalError);
    });

    it("should work without original error", () => {
      const videoPath = "/path/to/video.mp4";
      const videoError = createVideoLoadError(videoPath);

      expect(videoError.message).toBe(
        "Failed to load video: /path/to/video.mp4",
      );
      expect(videoError.name).toBe("VideoLoadError");
      expect(videoError.cause).toBeUndefined();
    });
  });

  describe("createNetworkError", () => {
    it("should create network error with correct properties", () => {
      const operation = "fetch data";
      const originalError = new Error("Connection failed");
      const networkError = createNetworkError(operation, originalError);

      expect(networkError.message).toBe("Network error during fetch data");
      expect(networkError.name).toBe("NetworkError");
      expect(networkError.cause).toBe(originalError);
    });
  });

  describe("createRenderError", () => {
    it("should create render error with correct properties", () => {
      const component = "MyComponent";
      const originalError = new Error("Render failed");
      const renderError = createRenderError(component, originalError);

      expect(renderError.message).toBe(
        "Render error in component: MyComponent",
      );
      expect(renderError.name).toBe("RenderError");
      expect(renderError.cause).toBe(originalError);
    });
  });
});
