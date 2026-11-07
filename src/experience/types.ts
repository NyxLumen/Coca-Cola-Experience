export type CompositorMode =
  | 'composite'
  | 'reality-a'
  | 'reality-b'
  | 'side-by-side'
  | 'organic-mask'
  | 'debug-mask';

export type TextureTier = '4k' | '2k' | '1k';

export interface ExperienceConfig {
  mode: CompositorMode;
  mixRatio: number; // 0.0 to 1.0
  splitPosition: number; // 0.0 to 1.0 for side-by-side
  feather: number; // Edge feathering (0.0 to 0.3)
  organicScale: number; // Frequency of organic noise
  textureTier: TextureTier;
  autoRotate: boolean;
  exposure: number;
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
}
