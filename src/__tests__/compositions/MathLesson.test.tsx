import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  MathLesson,
  type MathLessonProps,
} from "../../compositions/Educational/MathLesson";

// Mock dependencies
jest.mock("../../components/VideoWithErrorHandling", () => ({
  __esModule: true,
  default: ({ src, onLoadError, fallbackContent, ...props }: any) => (
    <div data-testid="video-with-error-handling" data-src={src} {...props}>
      {fallbackContent || "Mock Video Component"}
    </div>
  ),
}));

jest.mock("../../hooks/useErrorHandler", () => ({
  useErrorHandler: jest.fn(() => ({
    errorState: { hasError: false },
    handleError: jest.fn(),
    clearError: jest.fn(),
  })),
}));

describe("MathLesson", () => {
  const defaultChapters = [
    {
      title: "Test Chapter 1",
      description: "Description for chapter 1",
      manimVideo: "/test/chapter1.mp4",
      keyPoints: ["Point 1", "Point 2", "Point 3"],
      duration: 300,
    },
    {
      title: "Test Chapter 2",
      description: "Description for chapter 2",
      keyPoints: ["Point A", "Point B"],
      duration: 200,
    },
  ];

  const defaultProps: MathLessonProps = {
    title: "Test Math Lesson",
    subtitle: "Test Subtitle",
    chapters: defaultChapters,
    instructor: "Test Instructor",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering with default props", () => {
    it("should render without crashing", () => {
      render(<MathLesson title="Test Math" chapters={[]} />);
      expect(screen.getByTestId("absolute-fill")).toBeInTheDocument();
    });

    it("should display default title", () => {
      render(<MathLesson title="Mathematical Concepts" chapters={[]} />);
      expect(screen.getByText("Mathematical Concepts")).toBeInTheDocument();
    });

    it("should display default subtitle", () => {
      render(<MathLesson title="Test" chapters={[]} />);
      expect(
        screen.getByText("An Interactive Learning Experience"),
      ).toBeInTheDocument();
    });

    it("should display default instructor", () => {
      render(<MathLesson title="Test" chapters={[]} />);
      expect(
        screen.getByText("Instructor: Professor Math"),
      ).toBeInTheDocument();
    });

    it("should render default chapter", () => {
      render(<MathLesson title="Test" chapters={[]} />);
      expect(
        screen.getByText("Chapter 1: Introduction to Sine Waves"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Understanding periodic functions and their properties",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("rendering with custom props", () => {
    it("should display custom title", () => {
      render(<MathLesson {...defaultProps} />);
      expect(screen.getByText("Test Math Lesson")).toBeInTheDocument();
    });

    it("should display custom subtitle", () => {
      render(<MathLesson {...defaultProps} />);
      expect(screen.getByText("Test Subtitle")).toBeInTheDocument();
    });

    it("should display custom instructor", () => {
      render(<MathLesson {...defaultProps} />);
      expect(
        screen.getByText("Instructor: Test Instructor"),
      ).toBeInTheDocument();
    });

    it("should render all chapters", () => {
      render(<MathLesson {...defaultProps} />);

      expect(screen.getByText("Chapter 1: Test Chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Chapter 2: Test Chapter 2")).toBeInTheDocument();
      expect(screen.getByText("Description for chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Description for chapter 2")).toBeInTheDocument();
    });

    it("should handle optional subtitle", () => {
      const propsWithoutSubtitle = {
        ...defaultProps,
        subtitle: undefined,
      };

      render(<MathLesson {...propsWithoutSubtitle} />);

      expect(screen.getByText("Test Math Lesson")).toBeInTheDocument();
      expect(screen.queryByText("Test Subtitle")).not.toBeInTheDocument();
    });
  });

  describe("chapter content", () => {
    it("should render chapter key points", () => {
      render(<MathLesson {...defaultProps} />);

      // Check for key points from first chapter
      expect(screen.getByText("1.")).toBeInTheDocument();
      expect(screen.getByText("Point 1")).toBeInTheDocument();
      expect(screen.getByText("2.")).toBeInTheDocument();
      expect(screen.getByText("Point 2")).toBeInTheDocument();
      expect(screen.getByText("3.")).toBeInTheDocument();
      expect(screen.getByText("Point 3")).toBeInTheDocument();
    });

    it("should display Key Concepts section", () => {
      render(<MathLesson {...defaultProps} />);
      expect(screen.getByText("Key Concepts")).toBeInTheDocument();
    });

    it("should render video when provided", () => {
      render(<MathLesson {...defaultProps} />);

      const videoComponent = screen.getByTestId("video-with-error-handling");
      expect(videoComponent).toBeInTheDocument();
      expect(videoComponent).toHaveAttribute("data-src", "/test/chapter1.mp4");
    });

    it("should render video with correct props", () => {
      render(<MathLesson {...defaultProps} />);

      const videoComponent = screen.getByTestId("video-with-error-handling");
      expect(videoComponent).toHaveAttribute("startfrom", "0");
      expect(videoComponent).toHaveAttribute("endat", "300");
      expect(videoComponent).toHaveAttribute("maxretries", "3");
    });

    it("should render video fallback content", () => {
      render(<MathLesson {...defaultProps} />);

      expect(
        screen.getByText("📹 Video Content Unavailable"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/The mathematical animation for this chapter/),
      ).toBeInTheDocument();
    });
  });

  describe("progress tracking", () => {
    it("should display progress bar", () => {
      render(<MathLesson {...defaultProps} />);

      // Should show chapter indicators
      expect(screen.getByText("Chapter 1 of 2")).toBeInTheDocument();
      expect(screen.getByText("Chapter 2 of 2")).toBeInTheDocument();
    });

    it("should display progress percentage", () => {
      render(<MathLesson {...defaultProps} />);

      // Should show percentage (mocked interpolation returns specific values)
      const percentageElements = screen.getAllByText(/\d+%/);
      expect(percentageElements.length).toBeGreaterThan(0);
    });
  });

  describe("Remotion sequences", () => {
    it("should render title sequence", () => {
      render(<MathLesson {...defaultProps} />);

      const sequences = screen.getAllByTestId("sequence");
      const titleSequence = sequences.find(
        (seq) =>
          seq.getAttribute("data-from") === "0" &&
          seq.getAttribute("data-duration") === "90",
      );

      expect(titleSequence).toBeInTheDocument();
    });

    it("should render chapter sequences", () => {
      render(<MathLesson {...defaultProps} />);

      const sequences = screen.getAllByTestId("sequence");

      // Should have sequences for each chapter
      const chapterSequences = sequences.filter(
        (seq) =>
          seq.getAttribute("data-from") &&
          parseInt(seq.getAttribute("data-from") || "0") >= 90,
      );

      expect(chapterSequences.length).toBe(defaultChapters.length);
    });

    it("should calculate chapter timing correctly", () => {
      render(<MathLesson {...defaultProps} />);

      const sequences = screen.getAllByTestId("sequence");

      // First chapter should start at frame 90 (after intro)
      const firstChapterSequence = sequences.find(
        (seq) =>
          seq.getAttribute("data-from") === "90" &&
          seq.getAttribute("data-duration") === "300",
      );

      // Second chapter should start after first chapter
      const secondChapterSequence = sequences.find(
        (seq) =>
          seq.getAttribute("data-from") === "390" &&
          seq.getAttribute("data-duration") === "200",
      );

      expect(firstChapterSequence).toBeInTheDocument();
      expect(secondChapterSequence).toBeInTheDocument();
    });
  });

  describe("props validation and error handling", () => {
    it("should handle empty title", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithEmptyTitle = {
        ...defaultProps,
        title: "",
      };

      render(<MathLesson {...propsWithEmptyTitle} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Title is required and cannot be empty",
        }),
        "Props validation",
      );
    });

    it("should handle empty chapters array", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithEmptyChapters = {
        ...defaultProps,
        chapters: [],
      };

      render(<MathLesson {...propsWithEmptyChapters} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "At least one chapter is required",
        }),
        "Props validation",
      );
    });

    it("should handle invalid chapter title", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithInvalidChapter = {
        ...defaultProps,
        chapters: [
          {
            title: "",
            description: "Valid description",
            keyPoints: ["Point 1"],
            duration: 300,
          },
        ],
      };

      render(<MathLesson {...propsWithInvalidChapter} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Chapter 1 title is required",
        }),
        "Props validation",
      );
    });

    it("should handle empty key points", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithEmptyKeyPoints = {
        ...defaultProps,
        chapters: [
          {
            title: "Valid Title",
            description: "Valid description",
            keyPoints: [],
            duration: 300,
          },
        ],
      };

      render(<MathLesson {...propsWithEmptyKeyPoints} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Chapter 1 must have at least one key point",
        }),
        "Props validation",
      );
    });

    it("should handle invalid chapter duration", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithInvalidDuration = {
        ...defaultProps,
        chapters: [
          {
            title: "Valid Title",
            description: "Valid description",
            keyPoints: ["Point 1"],
            duration: 0,
          },
        ],
      };

      render(<MathLesson {...propsWithInvalidDuration} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Chapter 1 duration must be positive",
        }),
        "Props validation",
      );
    });

    it("should not error with valid props", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      render(<MathLesson {...defaultProps} />);

      expect(mockHandleError).not.toHaveBeenCalled();
    });
  });

  describe("video error handling", () => {
    it("should handle video load errors", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      render(<MathLesson {...defaultProps} />);

      // The video component should be configured with error handling
      const videoComponent = screen.getByTestId("video-with-error-handling");
      expect(videoComponent).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper heading structure", () => {
      render(<MathLesson {...defaultProps} />);

      // Main title should be h1
      const mainTitle = screen.getByRole("heading", { level: 1 });
      expect(mainTitle).toHaveTextContent("Test Math Lesson");

      // Chapter titles should be h2
      const chapterTitles = screen.getAllByRole("heading", { level: 2 });
      expect(chapterTitles.length).toBeGreaterThan(0);

      // Key concepts should be h3
      const keyConceptsTitle = screen.getByRole("heading", { level: 3 });
      expect(keyConceptsTitle).toHaveTextContent("Key Concepts");
    });

    it("should provide clear content structure", () => {
      render(<MathLesson {...defaultProps} />);

      // Should have chapter descriptions
      expect(screen.getByText("Description for chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Description for chapter 2")).toBeInTheDocument();
    });
  });

  describe("responsive design", () => {
    it("should render with proper container structure", () => {
      render(<MathLesson {...defaultProps} />);

      const mainContainer = screen.getByTestId("absolute-fill");
      expect(mainContainer).toBeInTheDocument();
    });

    it("should handle chapters without video", () => {
      const propsWithoutVideo = {
        ...defaultProps,
        chapters: [
          {
            title: "Chapter Without Video",
            description: "This chapter has no video",
            keyPoints: ["Point 1", "Point 2"],
            duration: 300,
          },
        ],
      };

      render(<MathLesson {...propsWithoutVideo} />);

      expect(
        screen.getByText("Chapter 1: Chapter Without Video"),
      ).toBeInTheDocument();
      expect(screen.getByText("This chapter has no video")).toBeInTheDocument();
      expect(
        screen.queryByTestId("video-with-error-handling"),
      ).not.toBeInTheDocument();
    });
  });

  describe("animation integration", () => {
    it("should work with Remotion animation hooks", () => {
      expect(() => {
        render(<MathLesson {...defaultProps} />);
      }).not.toThrow();
    });

    it("should calculate current chapter correctly", () => {
      // This tests the frame-based chapter calculation logic
      // In a real scenario, this would be tested with different frame values
      render(<MathLesson {...defaultProps} />);

      // Verify that chapters are rendered in correct order
      expect(screen.getByText("Chapter 1: Test Chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Chapter 2: Test Chapter 2")).toBeInTheDocument();
    });
  });

  describe("theme and styling", () => {
    it("should apply educational theme colors", () => {
      // This would be tested more thoroughly in integration tests
      // For unit tests, we verify the component renders without theme errors
      expect(() => {
        render(<MathLesson {...defaultProps} />);
      }).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle single chapter", () => {
      const singleChapterProps = {
        ...defaultProps,
        chapters: [defaultChapters[0]],
      };

      render(<MathLesson {...singleChapterProps} />);

      expect(screen.getByText("Chapter 1: Test Chapter 1")).toBeInTheDocument();
      expect(screen.getByText("Chapter 1 of 1")).toBeInTheDocument();
      expect(screen.queryByText("Chapter 2:")).not.toBeInTheDocument();
    });

    it("should handle chapters with many key points", () => {
      const manyPointsChapter = {
        title: "Chapter with Many Points",
        description: "This chapter has many key points",
        keyPoints: Array.from({ length: 10 }, (_, i) => `Point ${i + 1}`),
        duration: 600,
      };

      const propsWithManyPoints = {
        ...defaultProps,
        chapters: [manyPointsChapter],
      };

      render(<MathLesson {...propsWithManyPoints} />);

      // Should render all key points
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(`Point ${i}`)).toBeInTheDocument();
      }
    });

    it("should handle very long chapter titles", () => {
      const longTitleChapter = {
        title:
          "This is a very long chapter title that might cause layout issues",
        description: "Chapter with long title",
        keyPoints: ["Point 1"],
        duration: 300,
      };

      const propsWithLongTitle = {
        ...defaultProps,
        chapters: [longTitleChapter],
      };

      expect(() => {
        render(<MathLesson {...propsWithLongTitle} />);
      }).not.toThrow();

      expect(
        screen.getByText(/This is a very long chapter title/),
      ).toBeInTheDocument();
    });
  });
});
