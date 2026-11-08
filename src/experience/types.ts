import type { FluidConfig, FluidDebugMode, FluidTelemetry } from '../fluid/types';

export type CompositorMode =
  | 'fluid-composite'
  | 'composite'
  | 'reality-a'
  | 'reality-b'
  | 'side-by-side'
  | 'organic-mask'
  | 'debug-reveal-mask'
  | 'debug-transition-boundary'
  | 'debug-chromatic-aberration'
  | 'debug-density-threshold'
  | 'fluid-density'
  | 'fluid-velocity'
  | 'fluid-velocity-magnitude'
  | 'fluid-divergence'
  | 'fluid-pressure';

export type TextureTier = '4k' | '2k' | '1k';

export interface CompositorConfig {
  densityThreshold: number; // Density threshold to trigger reveal (0.01 to 0.6)
  densityFeather: number; // Transition smoothness (0.02 to 0.5)
  chromaticAberration: number; // Subtle boundary spectral fringe (0.0 to 0.025)
  boundaryNoiseStrength: number; // Micro-organic boundary perturbation (0.0 to 0.08)
  boundaryNoiseScale: number; // Frequency of edge ripples (1.0 to 12.0)
}

export interface ExperienceConfig {
  mode: CompositorMode;
  mixRatio: number; // 0.0 to 1.0 (for manual slider / diagnostic modes)
  splitPosition: number; // 0.0 to 1.0 for side-by-side
  feather: number; // Edge feathering (0.0 to 0.3)
  organicScale: number; // Frequency of organic noise
  textureTier: TextureTier;
  autoRotate: boolean;
  exposure: number;
  fluidConfig?: Partial<FluidConfig>;
  compositorConfig?: Partial<CompositorConfig>;
}

export interface ExperienceTelemetry {
  fps: number;
  frameTimeMs: number;
  drawCallsTotal: number;
  drawCallsA: number;
  drawCallsB: number;
  drawCallsCompositor: number;
  trianglesTotal: number;
  trianglesCan: number;
  geometriesCount: number;
  texturesCount: number;
  estimatedVramMb: number;
  renderTargetResolution: string;
  loadTimeMs: number;
  fluid?: FluidTelemetry;
}

export type { FluidConfig, FluidDebugMode, FluidTelemetry };
