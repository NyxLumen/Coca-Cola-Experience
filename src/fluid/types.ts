import * as THREE from 'three';

export type FluidDebugMode =
  | 'none'
  | 'velocity'
  | 'velocity-magnitude'
  | 'density'
  | 'divergence'
  | 'pressure';

export interface FluidConfig {
  simResolution: number; // Max dimension of simulation grid (e.g. 256)
  dyeResolution: number; // Max dimension of density grid (e.g. 512)
  velocityDissipation: number; // Velocity decay rate (e.g. 0.98)
  densityDissipation: number; // Density decay rate (e.g. 0.97)
  pressureIterations: number; // Jacobi iterations count (e.g. 20)
  pressureDissipation: number; // Pressure decay factor (e.g. 0.9)
  curlStrength: number; // Vorticity confinement strength (e.g. 0.0)
  splatRadius: number; // Relative radius of pointer influence (e.g. 0.0035)
  splatForce: number; // Velocity multiplier on pointer movement (e.g. 6000.0)
  splatDensity: THREE.Color; // Density tint injected by pointer
  idleEnabled: boolean; // Subtle organic movement when untouched
  idleSpeed: number; // Frequency of idle vortex evolution
  idleStrength: number; // Amplitude of idle velocity injection
}

export interface PointerState {
  x: number; // Normalized [0, 1]
  y: number; // Normalized [0, 1]
  prevX: number;
  prevY: number;
  deltaX: number;
  deltaY: number;
  isDown: boolean;
  isMoving: boolean;
  speed: number;
}

export interface FluidTelemetry {
  simWidth: number;
  simHeight: number;
  dyeWidth: number;
  dyeHeight: number;
  passesPerFrame: number;
  jacobiIterations: number;
  gpuMemoryEstMb: number;
  activeSplatsCount: number;
}
