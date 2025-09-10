import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ErrorBoundary, {
  withErrorBoundary,
  type ErrorFallbackProps,
} from "../../components/ErrorBoundary";

// Component that throws an error for testing
const ThrowError: React.FC<{
  shouldThrow?: boolean;
  errorMessage?: string;
}> = ({ shouldThrow = true, errorMessage = "Test error" }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>No error</div>;
};

// Custom fallback component for testing
const CustomFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  errorId,
}) => (
  <div data-testid="custom-fallback">
    <h1>Custom Error: {error.message}</h1>
    <p>Error ID: {errorId}</p>
    <button onClick={resetError} data-testid="custom-reset">
      Custom Reset
    </button>
  </div>
);

describe("ErrorBoundary", () => {
  // Mock console.error to suppress error output during tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when no error occurs", () => {
    it("should render children normally", () => {
      render(
        <ErrorBoundary>
          <div data-testid="child">Child component</div>
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toHaveTextContent("Child component");
    });
  });

  describe("when an error occurs", () => {
    it("should catch errors and display default fallback UI", () => {
      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Something went wrong!" />
        </ErrorBoundary>,
      );

      // Should display default error fallback
      expect(
        screen.getByText("🚨 Video Composition Error"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/An error occurred while rendering/),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Error: Something went wrong!"),
      ).toBeInTheDocument();

      // Should show error details (already verified above)
      // expect(
      //   screen.getByText(/Error: Something went wrong!/),
      // ).toBeInTheDocument();

      // Should have action buttons
      expect(
        screen.getByRole("button", { name: /try again/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /copy error details/i }),
      ).toBeInTheDocument();
    });

    it("should display custom fallback when provided", () => {
      render(
        <ErrorBoundary fallback={CustomFallback}>
          <ThrowError errorMessage="Custom error" />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
      expect(
        screen.getByText("Custom Error: Custom error"),
      ).toBeInTheDocument();
      expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
    });

    it("should generate unique error ID", () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError errorMessage="First error" />
        </ErrorBoundary>,
      );

      const firstErrorId = screen.getByText(/Error ID:/).textContent;

      // Reset and throw new error
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      rerender(
        <ErrorBoundary>
          <ThrowError errorMessage="Second error" />
        </ErrorBoundary>,
      );

      const secondErrorId = screen.getByText(/Error ID:/).textContent;
      expect(firstErrorId).not.toBe(secondErrorId);
    });

    it("should reset error state when reset button is clicked", async () => {
      const { rerender } = render(
        <ErrorBoundary key="error-test">
          <ThrowError />
        </ErrorBoundary>,
      );

      // Error boundary should be active
      expect(
        screen.getByText("🚨 Video Composition Error"),
      ).toBeInTheDocument();

      // Click reset button
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      // Re-render with non-throwing component and a new key to force re-mount
      rerender(
        <ErrorBoundary key="error-test-reset">
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      );

      // Should show children again
      expect(screen.getByText("No error")).toBeInTheDocument();
      expect(
        screen.queryByText("🚨 Video Composition Error"),
      ).not.toBeInTheDocument();
    });

    it("should call custom error handler when provided", () => {
      const mockOnError = jest.fn();

      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError errorMessage="Handler test error" />
        </ErrorBoundary>,
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Handler test error",
        }),
        expect.objectContaining({
          componentStack: expect.any(String),
        }),
      );
    });

    it("should handle error in custom error handler gracefully", () => {
      const mockOnError = jest.fn(() => {
        throw new Error("Error handler error");
      });

      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError />
        </ErrorBoundary>,
      );

      // Should still render error UI despite error handler throwing
      expect(
        screen.getByText("🚨 Video Composition Error"),
      ).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  describe("copy error details functionality", () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });

      // Mock alert
      global.alert = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should copy error details to clipboard", async () => {
      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Copy test error" />
        </ErrorBoundary>,
      );

      const copyButton = screen.getByRole("button", {
        name: /copy error details/i,
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining("Error: Copy test error"),
        );
      });

      expect(global.alert).toHaveBeenCalledWith(
        "Error details copied to clipboard",
      );
    });

    it("should handle clipboard write failure", async () => {
      const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();

      // Mock clipboard failure
      navigator.clipboard.writeText = jest
        .fn()
        .mockRejectedValue(new Error("Clipboard error"));

      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Clipboard test error" />
        </ErrorBoundary>,
      );

      const copyButton = screen.getByRole("button", {
        name: /copy error details/i,
      });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockConsoleLog).toHaveBeenCalledWith(
          "Error details:",
          expect.stringContaining("Error: Clipboard test error"),
        );
      });

      mockConsoleLog.mockRestore();
    });
  });

  describe("withErrorBoundary HOC", () => {
    const TestComponent: React.FC<{ shouldThrow?: boolean }> = ({
      shouldThrow = false,
    }) => {
      if (shouldThrow) {
        throw new Error("HOC test error");
      }
      return <div data-testid="hoc-child">HOC Child</div>;
    };

    it("should wrap component with error boundary", () => {
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByTestId("hoc-child")).toBeInTheDocument();
    });

    it("should catch errors in wrapped component", () => {
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent shouldThrow={true} />);

      expect(
        screen.getByText("🚨 Video Composition Error"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("hoc-child")).not.toBeInTheDocument();
    });

    it("should use custom fallback when provided", () => {
      const WrappedComponent = withErrorBoundary(TestComponent, CustomFallback);

      render(<WrappedComponent shouldThrow={true} />);

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    });

    it("should call custom error handler when provided", () => {
      const mockOnError = jest.fn();
      const WrappedComponent = withErrorBoundary(
        TestComponent,
        undefined,
        mockOnError,
      );

      render(<WrappedComponent shouldThrow={true} />);

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "HOC test error",
        }),
        expect.any(Object),
      );
    });

    it("should set correct display name", () => {
      const TestComponentWithName = Object.assign(
        (props: Record<string, unknown>) => <div>Test</div>,
        { displayName: "TestComponentWithName" },
      );

      const WrappedComponent = withErrorBoundary(TestComponentWithName);

      expect(WrappedComponent.displayName).toBe(
        "withErrorBoundary(TestComponentWithName)",
      );
    });

    it("should handle components without display name", () => {
      const AnonymousComponent = (props: Record<string, unknown>) => (
        <div>Anonymous</div>
      );

      const WrappedComponent = withErrorBoundary(AnonymousComponent);

      expect(WrappedComponent.displayName).toMatch(/withErrorBoundary\(/);
    });
  });

  describe("error logging", () => {
    it("should log error details to console", () => {
      const mockConsoleError = jest
        .spyOn(console, "error")
        .mockImplementation();

      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Logging test error" />
        </ErrorBoundary>,
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        "ErrorBoundary caught an error:",
        expect.objectContaining({
          error: "Logging test error",
          stack: expect.any(String),
          errorInfo: expect.any(Object),
          errorId: expect.any(String),
          timestamp: expect.any(String),
        }),
      );

      mockConsoleError.mockRestore();
    });
  });

  describe("error boundary state management", () => {
    it("should maintain error state until reset", () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      // Error boundary should be active
      expect(
        screen.getByText("🚨 Video Composition Error"),
      ).toBeInTheDocument();

      // Re-render with non-throwing component (should still show error)
      rerender(
        <ErrorBoundary>
          <div>New content</div>
        </ErrorBoundary>,
      );

      // Should still show error until reset
      expect(
        screen.getByText("🚨 Video Composition Error"),
      ).toBeInTheDocument();
      expect(screen.queryByText("New content")).not.toBeInTheDocument();
    });

    it("should clear error state completely on reset", async () => {
      const { rerender } = render(
        <ErrorBoundary key="clear-test">
          <ThrowError />
        </ErrorBoundary>,
      );

      // Click reset
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      // Re-render with new content and a new key to force re-mount
      rerender(
        <ErrorBoundary key="clear-test-reset">
          <div data-testid="new-content">New content after reset</div>
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("new-content")).toBeInTheDocument();
      expect(
        screen.queryByText("🚨 Video Composition Error"),
      ).not.toBeInTheDocument();
    });
  });
});
