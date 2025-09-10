import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ProductPromo,
  type ProductPromoProps,
} from "../../compositions/Promotional/ProductPromo";

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

describe("ProductPromo", () => {
  const defaultProps: ProductPromoProps = {
    productName: "Test Product",
    features: ["Feature 1", "Feature 2", "Feature 3"],
    tagline: "Test Tagline",
    brandColors: {
      primary: "#FF0000",
      secondary: "#00FF00",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering with default props", () => {
    it("should render without crashing", () => {
      render(<ProductPromo productName="Amazing Product" features={[]} />);
      expect(screen.getByTestId("absolute-fill")).toBeInTheDocument();
    });

    it("should display default product name", () => {
      render(<ProductPromo productName="Amazing Product" features={[]} />);
      expect(screen.getByText("Amazing Product")).toBeInTheDocument();
    });

    it("should display default tagline", () => {
      render(<ProductPromo productName="Amazing Product" features={[]} />);
      expect(screen.getByText("The future is here")).toBeInTheDocument();
    });

    it("should display default features", () => {
      render(<ProductPromo productName="Amazing Product" features={[]} />);

      const defaultFeatures = [
        "Fast",
        "Secure",
        "Simple",
        "Scalable",
        "Reliable",
      ];
      defaultFeatures.forEach((feature) => {
        expect(screen.getByText(`✨ ${feature}`)).toBeInTheDocument();
      });
    });
  });

  describe("rendering with custom props", () => {
    it("should display custom product name", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });

    it("should display custom tagline", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(screen.getByText("Test Tagline")).toBeInTheDocument();
    });

    it("should display custom features", () => {
      render(<ProductPromo {...defaultProps} />);

      defaultProps.features.forEach((feature) => {
        expect(screen.getByText(`✨ ${feature}`)).toBeInTheDocument();
      });
    });

    it("should display features showcase section", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(
        screen.getByText(`Why Choose ${defaultProps.productName}?`),
      ).toBeInTheDocument();
    });
  });

  describe("manim video integration", () => {
    it("should not render video section when no video provided", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(
        screen.queryByTestId("video-with-error-handling"),
      ).not.toBeInTheDocument();
    });

    it("should render video section when manim video is provided", () => {
      const propsWithVideo = {
        ...defaultProps,
        manimVideo: "/test/video.mp4",
      };

      render(<ProductPromo {...propsWithVideo} />);

      const videoComponent = screen.getByTestId("video-with-error-handling");
      expect(videoComponent).toBeInTheDocument();
      expect(videoComponent).toHaveAttribute("data-src", "/test/video.mp4");
    });

    it("should render video with correct props", () => {
      const propsWithVideo = {
        ...defaultProps,
        manimVideo: "/test/video.mp4",
      };

      render(<ProductPromo {...propsWithVideo} />);

      const videoComponent = screen.getByTestId("video-with-error-handling");
      expect(videoComponent).toHaveAttribute("startfrom", "0");
      expect(videoComponent).toHaveAttribute("endat", "300");
      expect(videoComponent).toHaveAttribute("maxretries", "3");
    });

    it("should display fallback content for video", () => {
      const propsWithVideo = {
        ...defaultProps,
        manimVideo: "/test/video.mp4",
      };

      render(<ProductPromo {...propsWithVideo} />);
      expect(screen.getByText("🎬 Demo Video Unavailable")).toBeInTheDocument();
      expect(
        screen.getByText(/The product demonstration video/),
      ).toBeInTheDocument();
    });

    it("should display video overlay text", () => {
      const propsWithVideo = {
        ...defaultProps,
        manimVideo: "/test/video.mp4",
      };

      render(<ProductPromo {...propsWithVideo} />);
      expect(screen.getByText("See the magic in action")).toBeInTheDocument();
    });
  });

  describe("call to action section", () => {
    it("should render CTA section", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(screen.getByText("Ready to Get Started?")).toBeInTheDocument();
    });

    it("should render CTA buttons", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(screen.getByText("Start Free Trial")).toBeInTheDocument();
      expect(screen.getByText("Learn More")).toBeInTheDocument();
    });

    it("should render CTA disclaimer text", () => {
      render(<ProductPromo {...defaultProps} />);
      expect(
        screen.getByText("No credit card required • Setup in minutes"),
      ).toBeInTheDocument();
    });
  });

  describe("brand colors theming", () => {
    it("should apply custom brand colors", () => {
      const customBrandColors = {
        primary: "#FF5722",
        secondary: "#3F51B5",
      };

      const propsWithColors = {
        ...defaultProps,
        brandColors: customBrandColors,
      };

      // This is a more complex test that would require inspecting computed styles
      // For now, we'll just test that the component renders without error
      expect(() => {
        render(<ProductPromo {...propsWithColors} />);
      }).not.toThrow();
    });

    it("should use default colors when none provided", () => {
      const propsWithoutColors = {
        ...defaultProps,
        brandColors: undefined,
      };

      expect(() => {
        render(<ProductPromo {...propsWithoutColors} />);
      }).not.toThrow();
    });
  });

  describe("Remotion sequences", () => {
    it("should render all sequences", () => {
      render(<ProductPromo {...defaultProps} />);

      // Should have multiple sequences for different sections
      const sequences = screen.getAllByTestId("sequence");
      expect(sequences.length).toBeGreaterThan(1);
    });

    it("should render title sequence with correct timing", () => {
      render(<ProductPromo {...defaultProps} />);

      const sequences = screen.getAllByTestId("sequence");
      const titleSequence = sequences.find(
        (seq) =>
          seq.getAttribute("data-from") === "0" &&
          seq.getAttribute("data-duration") === "150",
      );

      expect(titleSequence).toBeInTheDocument();
    });

    it("should render features sequence with correct timing", () => {
      render(<ProductPromo {...defaultProps} />);

      const sequences = screen.getAllByTestId("sequence");
      const featuresSequence = sequences.find(
        (seq) =>
          seq.getAttribute("data-from") === "150" &&
          seq.getAttribute("data-duration") === "300",
      );

      expect(featuresSequence).toBeInTheDocument();
    });

    it("should render CTA sequence with correct timing", () => {
      render(<ProductPromo {...defaultProps} />);

      const sequences = screen.getAllByTestId("sequence");
      const ctaSequence = sequences.find(
        (seq) =>
          seq.getAttribute("data-from") === "750" &&
          seq.getAttribute("data-duration") === "150",
      );

      expect(ctaSequence).toBeInTheDocument();
    });
  });

  describe("props validation and error handling", () => {
    it("should handle empty product name", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithEmptyName = {
        ...defaultProps,
        productName: "",
      };

      render(<ProductPromo {...propsWithEmptyName} />);

      // Error should be handled for empty product name
      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Product name is required and cannot be empty",
        }),
        "Props validation",
      );
    });

    it("should handle empty features array", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithEmptyFeatures = {
        ...defaultProps,
        features: [],
      };

      render(<ProductPromo {...propsWithEmptyFeatures} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "At least one feature is required",
        }),
        "Props validation",
      );
    });

    it("should handle invalid features", () => {
      const mockHandleError = jest.fn();
      const { useErrorHandler } = require("../../hooks/useErrorHandler");
      useErrorHandler.mockReturnValue({
        errorState: { hasError: false },
        handleError: mockHandleError,
        clearError: jest.fn(),
      });

      const propsWithInvalidFeatures = {
        ...defaultProps,
        features: ["Valid Feature", "", "Another Valid Feature"],
      };

      render(<ProductPromo {...propsWithInvalidFeatures} />);

      expect(mockHandleError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "All features must have valid text",
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

      render(<ProductPromo {...defaultProps} />);

      // Should not call handleError for valid props
      expect(mockHandleError).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("should have proper heading structure", () => {
      render(<ProductPromo {...defaultProps} />);

      // Main product title should be h1
      const mainTitle = screen.getByRole("heading", { level: 1 });
      expect(mainTitle).toHaveTextContent("Test Product");

      // Features section should have h2
      const featuresTitle = screen.getByRole("heading", { level: 2 });
      expect(featuresTitle).toHaveTextContent("Why Choose Test Product?");

      // CTA section should have h2
      const ctaTitle = screen.getByText("Ready to Get Started?");
      expect(ctaTitle).toBeInTheDocument();
    });

    it("should have proper button elements", () => {
      render(<ProductPromo {...defaultProps} />);

      const startTrialButton = screen.getByRole("button", {
        name: /start free trial/i,
      });
      const learnMoreButton = screen.getByRole("button", {
        name: /learn more/i,
      });

      expect(startTrialButton).toBeInTheDocument();
      expect(learnMoreButton).toBeInTheDocument();
    });
  });

  describe("responsive design", () => {
    it("should render with proper container structure", () => {
      render(<ProductPromo {...defaultProps} />);

      // Should have main absolute fill container
      const mainContainer = screen.getByTestId("absolute-fill");
      expect(mainContainer).toBeInTheDocument();
    });

    it("should handle optional tagline", () => {
      const propsWithoutTagline = {
        ...defaultProps,
        tagline: undefined,
      };

      render(<ProductPromo {...propsWithoutTagline} />);

      // Should still render product name
      expect(screen.getByText("Test Product")).toBeInTheDocument();
      // Tagline should not be present
      expect(screen.queryByText("Test Tagline")).not.toBeInTheDocument();
    });
  });

  describe("animation integration", () => {
    it("should work with Remotion animation hooks", () => {
      // The Remotion hooks are mocked, so we just test that component renders
      // without throwing errors when animation values are calculated
      expect(() => {
        render(<ProductPromo {...defaultProps} />);
      }).not.toThrow();
    });

    it("should apply animation transforms", () => {
      // This would be tested more thoroughly in integration tests
      // For unit tests, we verify the component structure is correct
      render(<ProductPromo {...defaultProps} />);

      // Verify that animated elements are present
      expect(screen.getByText("Test Product")).toBeInTheDocument();
      expect(screen.getByText("Ready to Get Started?")).toBeInTheDocument();
    });
  });
});
