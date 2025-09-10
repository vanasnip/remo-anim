import {
  generateCSSFilters,
  generateTransitionCSS,
  generateVideoFilterChain,
  applyColorGrading,
  colorGradingPresets,
  VideoProcessingQueue,
} from "../../utils/ffmpegIntegration";
import type {
  VideoProcessingOptions,
  TransitionEffect,
  FFmpegAnnotation,
  BatchProcessingJob,
} from "../../utils/ffmpegIntegration";

describe("ffmpegIntegration", () => {
  describe("generateCSSFilters", () => {
    it("generates correct CSS filter string for brightness", () => {
      const options: VideoProcessingOptions = { brightness: 0.5 };
      const result = generateCSSFilters(options);
      expect(result).toBe("brightness(1.5)");
    });

    it("generates correct CSS filter string for contrast", () => {
      const options: VideoProcessingOptions = { contrast: 1.2 };
      const result = generateCSSFilters(options);
      expect(result).toBe("contrast(1.2)");
    });

    it("generates correct CSS filter string for saturation", () => {
      const options: VideoProcessingOptions = { saturation: 0.8 };
      const result = generateCSSFilters(options);
      expect(result).toBe("saturate(0.8)");
    });

    it("generates correct CSS filter string for hue", () => {
      const options: VideoProcessingOptions = { hue: 45 };
      const result = generateCSSFilters(options);
      expect(result).toBe("hue-rotate(45deg)");
    });

    it("generates correct CSS filter string for blur", () => {
      const options: VideoProcessingOptions = { blur: 5 };
      const result = generateCSSFilters(options);
      expect(result).toBe("blur(5px)");
    });

    it("generates combined CSS filter string", () => {
      const options: VideoProcessingOptions = {
        brightness: 0.1,
        contrast: 1.2,
        blur: 2,
      };
      const result = generateCSSFilters(options);
      expect(result).toBe("brightness(1.1) contrast(1.2) blur(2px)");
    });

    it("ignores undefined values", () => {
      const options: VideoProcessingOptions = {
        brightness: undefined,
        contrast: 1.1,
        blur: undefined,
      };
      const result = generateCSSFilters(options);
      expect(result).toBe("contrast(1.1)");
    });

    it("ignores zero blur", () => {
      const options: VideoProcessingOptions = {
        blur: 0,
        contrast: 1.1,
      };
      const result = generateCSSFilters(options);
      expect(result).toBe("contrast(1.1)");
    });

    it("returns empty string for empty options", () => {
      const options: VideoProcessingOptions = {};
      const result = generateCSSFilters(options);
      expect(result).toBe("");
    });
  });

  describe("generateTransitionCSS", () => {
    it("generates fade transition CSS", () => {
      const effect: TransitionEffect = {
        type: "fade",
        duration: 30,
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.opacity).toBe(0.5);
    });

    it("generates slide transition CSS for left direction", () => {
      const effect: TransitionEffect = {
        type: "slide",
        duration: 30,
        direction: "left",
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.transform).toBe("translateX(-50%)");
    });

    it("generates slide transition CSS for right direction", () => {
      const effect: TransitionEffect = {
        type: "slide",
        duration: 30,
        direction: "right",
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.transform).toBe("translateX(50%)");
    });

    it("generates slide transition CSS for up direction", () => {
      const effect: TransitionEffect = {
        type: "slide",
        duration: 30,
        direction: "up",
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.transform).toBe("translateY(-50%)");
    });

    it("generates dissolve transition CSS", () => {
      const effect: TransitionEffect = {
        type: "dissolve",
        duration: 30,
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.opacity).toBe(0.5);
      expect(result.filter).toBe("blur(2.5px)");
    });

    it("generates wipe transition CSS", () => {
      const effect: TransitionEffect = {
        type: "wipe",
        duration: 30,
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.clipPath).toBe("inset(0 50% 0 0)");
    });

    it("generates pixelate transition CSS", () => {
      const effect: TransitionEffect = {
        type: "pixelate",
        duration: 30,
      };
      const result = generateTransitionCSS(15, 0, effect);
      expect(result.filter).toBe("blur(5px) contrast(1.5)");
    });

    it("handles frame before start", () => {
      const effect: TransitionEffect = {
        type: "fade",
        duration: 30,
      };
      const result = generateTransitionCSS(-5, 0, effect);
      expect(result.opacity).toBe(0);
    });

    it("handles frame after completion", () => {
      const effect: TransitionEffect = {
        type: "fade",
        duration: 30,
      };
      const result = generateTransitionCSS(35, 0, effect);
      expect(result.opacity).toBe(1);
    });
  });

  describe("generateVideoFilterChain", () => {
    it("combines filters from multiple annotations", () => {
      const annotations: FFmpegAnnotation[] = [
        {
          id: "1",
          type: "callout",
          text: "Test",
          startFrame: 0,
          endFrame: 60,
          position: { x: 50, y: 50 },
          videoFilters: {
            brightness: 0.1,
            contrast: 1.2,
          },
        },
        {
          id: "2",
          type: "info",
          text: "Test 2",
          startFrame: 30,
          endFrame: 90,
          position: { x: 70, y: 30 },
          videoFilters: {
            saturation: 1.5,
            blur: 2,
          },
        },
      ];

      const result = generateVideoFilterChain(annotations, 45);
      expect(result).toEqual({
        brightness: 0.1,
        contrast: 1.2,
        saturation: 1.5,
        blur: 2,
      });
    });

    it("applies color grading from annotations", () => {
      const annotations: FFmpegAnnotation[] = [
        {
          id: "1",
          type: "callout",
          text: "Test",
          startFrame: 0,
          endFrame: 60,
          position: { x: 50, y: 50 },
          colorGrading: "cinematic",
        },
      ];

      const result = generateVideoFilterChain(annotations, 30);
      expect(result).toEqual(colorGradingPresets.cinematic);
    });

    it("returns empty object when no active annotations", () => {
      const annotations: FFmpegAnnotation[] = [
        {
          id: "1",
          type: "callout",
          text: "Test",
          startFrame: 100,
          endFrame: 160,
          position: { x: 50, y: 50 },
          videoFilters: {
            brightness: 0.1,
          },
        },
      ];

      const result = generateVideoFilterChain(annotations, 50);
      expect(result).toEqual({});
    });

    it("handles annotations without filters", () => {
      const annotations: FFmpegAnnotation[] = [
        {
          id: "1",
          type: "callout",
          text: "Test",
          startFrame: 0,
          endFrame: 60,
          position: { x: 50, y: 50 },
        },
      ];

      const result = generateVideoFilterChain(annotations, 30);
      expect(result).toEqual({});
    });
  });

  describe("applyColorGrading", () => {
    it("returns cinematic preset", () => {
      const result = applyColorGrading("cinematic");
      expect(result).toEqual(colorGradingPresets.cinematic);
    });

    it("returns vibrant preset", () => {
      const result = applyColorGrading("vibrant");
      expect(result).toEqual(colorGradingPresets.vibrant);
    });

    it("returns vintage preset", () => {
      const result = applyColorGrading("vintage");
      expect(result).toEqual(colorGradingPresets.vintage);
    });
  });

  describe("VideoProcessingQueue", () => {
    let queue: VideoProcessingQueue;

    beforeEach(() => {
      queue = new VideoProcessingQueue();
    });

    it("adds jobs to queue", () => {
      const job: BatchProcessingJob = {
        id: "test-1",
        sourceVideo: "/test.mp4",
        outputPath: "/output.mp4",
        annotations: [],
        processingOptions: {},
        priority: "medium",
      };

      queue.addJob(job);
      const status = queue.getQueueStatus();
      expect(status.pending).toBe(1);
      expect(status.processing).toBe(false);
    });

    it("prioritizes high priority jobs", () => {
      const lowJob: BatchProcessingJob = {
        id: "low",
        sourceVideo: "/test.mp4",
        outputPath: "/output.mp4",
        annotations: [],
        processingOptions: {},
        priority: "low",
      };

      const highJob: BatchProcessingJob = {
        id: "high",
        sourceVideo: "/test.mp4",
        outputPath: "/output.mp4",
        annotations: [],
        processingOptions: {},
        priority: "high",
      };

      queue.addJob(lowJob);
      queue.addJob(highJob);

      // Mock processNext to check job order
      jest.spyOn(queue, "processNext").mockImplementation(async () => {
        const jobs = (queue as any).jobs;
        return jobs[0]; // Return the first job
      });

      return queue.processNext().then((processedJob) => {
        expect(processedJob?.id).toBe("high");
      });
    });

    it("processes jobs sequentially", async () => {
      const job: BatchProcessingJob = {
        id: "test-1",
        sourceVideo: "/test.mp4",
        outputPath: "/output.mp4",
        annotations: [],
        processingOptions: {},
        priority: "medium",
      };

      queue.addJob(job);

      const processedJob = await queue.processNext();
      expect(processedJob?.id).toBe("test-1");

      const status = queue.getQueueStatus();
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(false);
    });

    it("returns null when queue is empty", async () => {
      const processedJob = await queue.processNext();
      expect(processedJob).toBe(null);
    });

    it("prevents concurrent processing", async () => {
      const job1: BatchProcessingJob = {
        id: "test-1",
        sourceVideo: "/test.mp4",
        outputPath: "/output.mp4",
        annotations: [],
        processingOptions: {},
        priority: "medium",
      };

      const job2: BatchProcessingJob = {
        id: "test-2",
        sourceVideo: "/test2.mp4",
        outputPath: "/output2.mp4",
        annotations: [],
        processingOptions: {},
        priority: "medium",
      };

      queue.addJob(job1);
      queue.addJob(job2);

      // Start first processing
      const promise1 = queue.processNext();

      // Try to start second processing immediately
      const promise2 = queue.processNext();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1?.id).toBe("test-1");
      expect(result2).toBe(null); // Should return null due to concurrent processing prevention
    });
  });

  describe("colorGradingPresets", () => {
    it("contains expected presets", () => {
      expect(colorGradingPresets).toHaveProperty("cinematic");
      expect(colorGradingPresets).toHaveProperty("vibrant");
      expect(colorGradingPresets).toHaveProperty("vintage");
      expect(colorGradingPresets).toHaveProperty("cool");
      expect(colorGradingPresets).toHaveProperty("warm");
      expect(colorGradingPresets).toHaveProperty("dramatic");
    });

    it("cinematic preset has correct properties", () => {
      const preset = colorGradingPresets.cinematic;
      expect(preset.brightness).toBe(-0.1);
      expect(preset.contrast).toBe(1.2);
      expect(preset.saturation).toBe(0.9);
      expect(preset.gamma).toBe(0.9);
      expect(preset.highlights).toBe(-20);
      expect(preset.shadows).toBe(10);
    });
  });
});
