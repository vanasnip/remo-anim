import { renderHook, act, waitFor } from "@testing-library/react";
import { useVideoLoader } from "../../hooks/useVideoLoader";

// Mock fetch
global.fetch = jest.fn();

describe("useVideoLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("basic functionality", () => {
    it("should initialize with loading state", () => {
      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {}),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.videoUrl).toBeNull();
      // Progress may be updated immediately when loading starts
      expect(result.current.progress).toBeGreaterThanOrEqual(0);
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(true);
      expect(result.current.isRetrying).toBe(false);
    });

    it("should return empty state for empty video path", () => {
      const { result } = renderHook(() => useVideoLoader("", {}));

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.videoUrl).toBeNull();
    });

    it("should handle successful video loading", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "video/mp4"]]),
      });

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {}),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.videoUrl).toBe("/test-video.mp4");
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle fetch errors and try fallback paths", async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([["content-type", "video/mp4"]]),
        });

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {
          fallbackPaths: ["/fallback-video.mp4"],
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.videoUrl).toBe("/fallback-video.mp4");
      expect(result.current.retryCount).toBe(0);
    });

    it("should set error state when all attempts fail", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {
          fallbackPaths: ["/fallback-video.mp4"],
          maxRetries: 2,
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.toString()).toContain("VIDEO_NOT_FOUND");
      expect(result.current.videoUrl).toBeNull();
      expect(result.current.retryCount).toBe(2);
      expect(result.current.canRetry).toBe(false);
    });

    it("should handle non-video content type", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "text/html"]]),
      });

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {}),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(
        expect.objectContaining({
          name: "INVALID_VIDEO_FORMAT",
          message: expect.stringContaining("Expected video content"),
        }),
      );
    });
  });

  describe("retry functionality", () => {
    it("should retry on manual retry call", async () => {
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Map([["content-type", "video/mp4"]]),
        });

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", { maxRetries: 3 }),
      );

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      const initialError = result.current.error;

      // Retry manually
      act(() => {
        result.current.retry();
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.isRetrying).toBe(true);
      expect(result.current.error).toBe(initialError); // Error persists during retry

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.videoUrl).toBe("/test-video.mp4");
      expect(result.current.isRetrying).toBe(false);
    });

    it("should not allow retry when max retries exceeded", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", { maxRetries: 1 }),
      );

      await waitFor(() => {
        expect(result.current.canRetry).toBe(false);
      });

      const retryResult = result.current.retry();
      expect(retryResult).toBe(false);
    });
  });

  describe("progressive loading", () => {
    it("should preload metadata when enabled", async () => {
      const mockVideo = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        load: jest.fn(),
        src: "",
      };

      // Mock createElement to return our mock video
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === "video") {
          return mockVideo as any;
        }
        return originalCreateElement.call(document, tagName);
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        headers: new Map([["content-type", "video/mp4"]]),
      });

      renderHook(() =>
        useVideoLoader("/test-video.mp4", {
          enableProgressiveLoading: true,
          preloadMetadata: true,
        }),
      );

      await waitFor(() => {
        expect(document.createElement).toHaveBeenCalledWith("video");
      });

      expect(mockVideo.load).toHaveBeenCalled();

      // Restore original createElement
      document.createElement = originalCreateElement;
    });
  });

  describe("cleanup", () => {
    it("should cleanup on unmount", async () => {
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 1000);
          }),
      );

      const { result, unmount } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {}),
      );

      expect(result.current.loading).toBe(true);

      unmount();

      // Should not throw or cause memory leaks
      act(() => {
        jest.advanceTimersByTime(2000);
      });
    });

    it("should abort fetch requests on cleanup", async () => {
      const mockAbortController = {
        abort: jest.fn(),
        signal: {},
      };

      // Mock AbortController
      (global as any).AbortController = jest.fn(() => mockAbortController);

      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true }), 1000);
          }),
      );

      const { unmount } = renderHook(() =>
        useVideoLoader("/test-video.mp4", {}),
      );

      unmount();

      expect(mockAbortController.abort).toHaveBeenCalled();
    });
  });

  describe("options validation", () => {
    it("should handle invalid maxRetries", () => {
      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", { maxRetries: -1 }),
      );

      // Should default to 3
      expect(result.current.canRetry).toBe(true);
    });

    it("should handle empty fallback paths", async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useVideoLoader("/test-video.mp4", { fallbackPaths: [] }),
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toContain("No fallback paths");
    });
  });
});
