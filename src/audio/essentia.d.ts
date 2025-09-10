/**
 * Type definitions for essentia.js
 */

declare module "essentia.js" {
  export interface EssentiaWASM {
    arrayToVector(array: Float32Array): any;
    BeatTrackerMultiFeature(
      audioVector: any,
      sampleRate?: number,
    ): {
      ticks: any;
      confidence: number;
      bpm: any;
    };
    BpmHistogram(bpm: any): {
      bpm: number;
      delete(): void;
    };
    OnsetDetection(audioVector: any, method: string, sampleRate: number): any;
    SuperFluxExtractor(audioVector: any, sampleRate: number): any;
  }

  export class Essentia {
    constructor();
  }

  export default Essentia;
}