import * as THREE from 'three';
import type { FluidConfig } from './types';

export const DEFAULT_FLUID_CONFIG: FluidConfig = {
  simResolution: 256,
  dyeResolution: 512,
  velocityDissipation: 0.985,
  densityDissipation: 0.978,
  pressureIterations: 20,
  pressureDissipation: 0.85,
  curlStrength: 0.0,
  splatRadius: 0.0032,
  splatForce: 4500.0,
  splatDensity: new THREE.Color(1.0, 1.0, 1.0),
  idleEnabled: true,
  idleSpeed: 0.35,
  idleStrength: 15.0,
};

export const FLUID_PARAM_BOUNDS = {
  simResolution: { min: 64, max: 512, step: 32 },
  dyeResolution: { min: 128, max: 1024, step: 64 },
  velocityDissipation: { min: 0.9, max: 0.999, step: 0.001 },
  densityDissipation: { min: 0.9, max: 0.999, step: 0.001 },
  pressureIterations: { min: 4, max: 40, step: 2 },
  splatRadius: { min: 0.0005, max: 0.015, step: 0.0005 },
  splatForce: { min: 500.0, max: 12000.0, step: 250.0 },
  idleStrength: { min: 0.0, max: 60.0, step: 2.0 },
};
