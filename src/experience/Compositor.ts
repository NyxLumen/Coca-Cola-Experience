import * as THREE from 'three';
import type { CompositorConfig, CompositorMode } from './types';

export const DEFAULT_COMPOSITOR_CONFIG: CompositorConfig = {
  densityThreshold: 0.16,
  densityFeather: 0.22,
  chromaticAberration: 0.008,
  boundaryNoiseStrength: 0.02,
  boundaryNoiseScale: 6.0,
};

const COMPOSITOR_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const COMPOSITOR_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tRealityA;
  uniform sampler2D tRealityB;
  uniform sampler2D tFluidDensity;
  uniform sampler2D tFluidVelocity;
  uniform sampler2D tFluidPressure;
  uniform sampler2D tFluidDivergence;

  uniform int uMode;
  uniform float uMixRatio;
  uniform float uSplitPosition;
  uniform float uFeather;
  uniform float uOrganicScale;
  uniform float uTime;
  uniform vec2 uResolution;

  // Phase 2C Revised Tunable Compositor Parameters (Refraction Removed)
  uniform float uDensityThreshold;
  uniform float uDensityFeather;
  uniform float uChromaticAberration;
  uniform float uBoundaryNoiseStrength;
  uniform float uBoundaryNoiseScale;

  varying vec2 vUv;

  // 2D Simplex Noise for Subtle Micro-Boundary Perturbation
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float total = 0.0;
    total += 0.500 * snoise(p); p *= 2.02;
    total += 0.250 * snoise(p); p *= 2.03;
    total += 0.125 * snoise(p);
    return total;
  }

  vec3 turbo(float t) {
    t = clamp(t, 0.0, 1.0);
    return clamp(vec3(
      1.5 * t,
      1.5 * (1.0 - abs(2.0 * t - 1.0)),
      1.5 * (1.0 - t)
    ), 0.0, 1.0);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // =========================================================================
    // 1. CLEAN FLUID DENSITY-DRIVEN REVEAL MASK (Preserving Phase 2B Dynamics)
    // =========================================================================
    vec4 fluidD = texture2D(tFluidDensity, vUv);
    float rawDensity = length(fluidD.rgb);

    // Smoothstep threshold curve
    float halfFeather = max(uDensityFeather * 0.5, 0.005);
    float baseMask = smoothstep(uDensityThreshold - halfFeather, uDensityThreshold + halfFeather, rawDensity);

    // Transition boundary factor (peaks at mask = 0.5, zero at 0.0 and 1.0)
    float boundary = 4.0 * baseMask * (1.0 - baseMask);

    // Subtle micro-organic boundary perturbation (if enabled)
    float mask = baseMask;
    if (uBoundaryNoiseStrength > 0.001) {
      vec2 noiseUv = vUv;
      noiseUv.x *= aspect;
      float noise = fbm(noiseUv * uBoundaryNoiseScale);
      mask = clamp(baseMask + boundary * (noise - 0.5) * uBoundaryNoiseStrength, 0.0, 1.0);
    }

    // Active boundary for localized optical fringe
    float activeBoundary = 4.0 * mask * (1.0 - mask);

    // =========================================================================
    // 2. RESTRAINED, SUBTLE CHROMATIC ABERRATION (Zero Refraction / Zero Warp)
    // =========================================================================
    // The can geometry NEVER warps or bends. Both realities sample at identical vUv.
    // Subtle spectral fringe appears strictly on the fluid meniscus while moving.
    vec2 fluidVel = texture2D(tFluidVelocity, vUv).xy;
    float speed = length(fluidVel);

    vec4 colA;
    vec4 colB;

    float chromaWeight = activeBoundary * smoothstep(0.0, 30.0, speed) * uChromaticAberration;
    vec2 disp = vec2(chromaWeight * 0.0015 / aspect, 0.0);

    if (chromaWeight > 0.00005) {
      // Subtle localized micro-dispersion along active meniscus
      float rA = texture2D(tRealityA, clamp(vUv - disp, vec2(0.001), vec2(0.999))).r;
      float gA = texture2D(tRealityA, vUv).g;
      float bA = texture2D(tRealityA, clamp(vUv + disp, vec2(0.001), vec2(0.999))).b;
      colA = vec4(rA, gA, bA, 1.0);

      float rB = texture2D(tRealityB, clamp(vUv - disp, vec2(0.001), vec2(0.999))).r;
      float gB = texture2D(tRealityB, vUv).g;
      float bB = texture2D(tRealityB, clamp(vUv + disp, vec2(0.001), vec2(0.999))).b;
      colB = vec4(rB, gB, bB, 1.0);
    } else {
      // Completely undistorted sampling: exact 1:1 spatial lock
      colA = texture2D(tRealityA, vUv);
      colB = texture2D(tRealityB, vUv);
    }

    // =========================================================================
    // 3. DIAGNOSTIC DEBUG MODES
    // =========================================================================
    if (uMode == 6) {
      // Reveal Mask Grayscale Diagnostic
      gl_FragColor = vec4(vec3(mask), 1.0);
      return;
    } else if (uMode == 7) {
      // Transition Boundary Zone Diagnostic
      gl_FragColor = vec4(vec3(activeBoundary), 1.0);
      return;
    } else if (uMode == 8) {
      // Isolated Chromatic Aberration Dispersion Delta
      vec4 colAUndisp = texture2D(tRealityA, vUv);
      vec3 chromaDelta = abs(colA.rgb - colAUndisp.rgb) * 20.0;
      gl_FragColor = vec4(chromaDelta, 1.0);
      return;
    } else if (uMode == 9) {
      // Density Threshold Diagnostic
      float overThresh = step(uDensityThreshold, rawDensity);
      vec3 threshCol = (overThresh > 0.5)
        ? vec3(0.1, 0.9, 0.3) * rawDensity * 2.0
        : vec3(0.9, 0.2, 0.2) * rawDensity * 2.0;
      gl_FragColor = vec4(threshCol, 1.0);
      return;
    } else if (uMode == 11) {
      // Velocity Speed Heatmap (Phase 2B Fluid Diagnostic)
      gl_FragColor = vec4(turbo(speed * 0.025), 1.0);
      return;
    } else if (uMode == 12) {
      // Velocity Vector Field (Phase 2B Fluid Diagnostic)
      vec2 velNorm = fluidVel * 0.02;
      vec3 col = vec3(0.5 + velNorm.x, 0.5 + velNorm.y, 0.5 - 0.5 * (velNorm.x + velNorm.y));
      gl_FragColor = vec4(col, 1.0);
      return;
    } else if (uMode == 13) {
      // Fluid Density Field (Phase 2B Fluid Diagnostic)
      gl_FragColor = vec4(fluidD.rgb, 1.0);
      return;
    } else if (uMode == 14) {
      // Divergence Heatmap (Phase 2B Fluid Diagnostic)
      float div = texture2D(tFluidDivergence, vUv).x * 20.0;
      gl_FragColor = vec4(max(div, 0.0), 0.0, max(-div, 0.0), 1.0);
      return;
    } else if (uMode == 15) {
      // Pressure Field (Phase 2B Fluid Diagnostic)
      float p = texture2D(tFluidPressure, vUv).x * 10.0;
      vec3 pCol = (p >= 0.0)
        ? mix(vec3(0.0), vec3(0.1, 0.8, 0.9), clamp(p, 0.0, 1.0))
        : mix(vec3(0.0), vec3(0.9, 0.2, 0.7), clamp(-p, 0.0, 1.0));
      gl_FragColor = vec4(pCol, 1.0);
      return;
    }

    // =========================================================================
    // 4. PRESENTATION MODES (Baseline & Clean Density Composite)
    // =========================================================================
    if (uMode == 1) {
      // 100% Reality A (Original Coke)
      gl_FragColor = texture2D(tRealityA, vUv);
      return;
    } else if (uMode == 2) {
      // 100% Reality B (Diet Coke)
      gl_FragColor = texture2D(tRealityB, vUv);
      return;
    } else if (uMode == 3) {
      // Side-by-Side Diagnostic Split Screen
      float pixelWidth = 1.0 / max(uResolution.x, 1.0);
      float distToSplit = abs(vUv.x - uSplitPosition);
      float divider = 1.0 - smoothstep(0.0, pixelWidth * 1.5, distToSplit);
      float splitMask = step(uSplitPosition, vUv.x);
      vec4 splitCol = mix(texture2D(tRealityA, vUv), texture2D(tRealityB, vUv), splitMask);
      if (divider > 0.0) {
        splitCol = mix(splitCol, vec4(1.0, 1.0, 1.0, 0.85), divider);
      }
      gl_FragColor = splitCol;
      return;
    } else if (uMode == 4) {
      // Phase 2A Procedural Organic Simplex Mask (Baseline)
      vec2 noiseUv = vUv;
      noiseUv.x *= aspect;
      float noise = fbm(noiseUv * uOrganicScale + vec2(uTime * 0.12, uTime * 0.08));
      float dist = distance(vUv, vec2(0.5, 0.45)) + noise * 0.22;
      float threshold = uMixRatio * 1.25;
      float featherVal = max(uFeather, 0.01);
      float simMask = 1.0 - smoothstep(threshold - featherVal, threshold + featherVal, dist);
      gl_FragColor = mix(texture2D(tRealityA, vUv), texture2D(tRealityB, vUv), clamp(simMask, 0.0, 1.0));
      return;
    } else if (uMode == 5) {
      // Phase 2A Static Composite Slider
      float featherVal = max(uFeather, 0.001);
      float staticMask = smoothstep(uMixRatio - featherVal, uMixRatio + featherVal, vUv.x);
      gl_FragColor = mix(texture2D(tRealityA, vUv), texture2D(tRealityB, vUv), clamp(staticMask, 0.0, 1.0));
      return;
    }

    // Mode 0: Primary Clean Fluid-Driven Transition Composite
    // C = mix(RealityA, RealityB, RevealMask) - Seamless, No Warping, Natural Fluid Shape
    gl_FragColor = mix(colA, colB, clamp(mask, 0.0, 1.0));
  }
`;

export class Compositor {
  public targetA: THREE.WebGLRenderTarget;
  public targetB: THREE.WebGLRenderTarget;
  public quadScene: THREE.Scene;
  public quadCamera: THREE.OrthographicCamera;
  public material: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;
  private config: CompositorConfig = { ...DEFAULT_COMPOSITOR_CONFIG };

  constructor(width: number, height: number, dpr: number) {
    const effectiveWidth = Math.max(1, Math.floor(width * dpr));
    const effectiveHeight = Math.max(1, Math.floor(height * dpr));

    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      colorSpace: THREE.SRGBColorSpace,
      depthBuffer: true,
      stencilBuffer: false,
    };

    this.targetA = new THREE.WebGLRenderTarget(effectiveWidth, effectiveHeight, rtOptions);
    this.targetA.texture.name = 'RenderTarget_RealityA';

    this.targetB = new THREE.WebGLRenderTarget(effectiveWidth, effectiveHeight, rtOptions);
    this.targetB.texture.name = 'RenderTarget_RealityB';

    // Orthographic Fullscreen Quad Scene
    this.quadScene = new THREE.Scene();
    this.quadScene.name = 'Compositor_QuadScene';
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      name: 'DualReality_CompositorMaterial',
      vertexShader: COMPOSITOR_VERTEX_SHADER,
      fragmentShader: COMPOSITOR_FRAGMENT_SHADER,
      uniforms: {
        tRealityA: { value: this.targetA.texture },
        tRealityB: { value: this.targetB.texture },
        tFluidDensity: { value: null },
        tFluidVelocity: { value: null },
        tFluidPressure: { value: null },
        tFluidDivergence: { value: null },
        uMode: { value: 0 }, // 0: fluid-composite (Clean Primary)
        uMixRatio: { value: 0.5 },
        uSplitPosition: { value: 0.5 },
        uFeather: { value: 0.05 },
        uOrganicScale: { value: 4.0 },
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(effectiveWidth, effectiveHeight) },

        // Phase 2C Revised Tunables (No Refraction)
        uDensityThreshold: { value: this.config.densityThreshold },
        uDensityFeather: { value: this.config.densityFeather },
        uChromaticAberration: { value: this.config.chromaticAberration },
        uBoundaryNoiseStrength: { value: this.config.boundaryNoiseStrength },
        uBoundaryNoiseScale: { value: this.config.boundaryNoiseScale },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quadMesh = new THREE.Mesh(quadGeo, this.material);
    this.quadScene.add(this.quadMesh);
  }

  public setFluidTextures(
    density: THREE.Texture,
    velocity: THREE.Texture,
    pressure?: THREE.Texture,
    divergence?: THREE.Texture
  ): void {
    this.material.uniforms.tFluidDensity.value = density;
    this.material.uniforms.tFluidVelocity.value = velocity;
    if (pressure) this.material.uniforms.tFluidPressure.value = pressure;
    if (divergence) this.material.uniforms.tFluidDivergence.value = divergence;
  }

  public setMode(mode: CompositorMode): void {
    let modeInt = 0;
    switch (mode) {
      case 'fluid-composite':
        modeInt = 0;
        break;
      case 'reality-a':
        modeInt = 1;
        break;
      case 'reality-b':
        modeInt = 2;
        break;
      case 'side-by-side':
        modeInt = 3;
        break;
      case 'organic-mask':
        modeInt = 4;
        break;
      case 'composite':
        modeInt = 5;
        break;
      case 'debug-reveal-mask':
        modeInt = 6;
        break;
      case 'debug-transition-boundary':
        modeInt = 7;
        break;
      case 'debug-chromatic-aberration':
        modeInt = 8;
        break;
      case 'debug-density-threshold':
        modeInt = 9;
        break;
      case 'fluid-velocity-magnitude':
        modeInt = 11;
        break;
      case 'fluid-velocity':
        modeInt = 12;
        break;
      case 'fluid-density':
        modeInt = 13;
        break;
      case 'fluid-divergence':
        modeInt = 14;
        break;
      case 'fluid-pressure':
        modeInt = 15;
        break;
    }
    this.material.uniforms.uMode.value = modeInt;
  }

  public setConfig(newConfig: Partial<CompositorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.densityThreshold !== undefined) {
      this.material.uniforms.uDensityThreshold.value = newConfig.densityThreshold;
    }
    if (newConfig.densityFeather !== undefined) {
      this.material.uniforms.uDensityFeather.value = newConfig.densityFeather;
    }
    if (newConfig.chromaticAberration !== undefined) {
      this.material.uniforms.uChromaticAberration.value = newConfig.chromaticAberration;
    }
    if (newConfig.boundaryNoiseStrength !== undefined) {
      this.material.uniforms.uBoundaryNoiseStrength.value = newConfig.boundaryNoiseStrength;
    }
    if (newConfig.boundaryNoiseScale !== undefined) {
      this.material.uniforms.uBoundaryNoiseScale.value = newConfig.boundaryNoiseScale;
    }
  }

  public getConfig(): CompositorConfig {
    return { ...this.config };
  }

  public setMixRatio(ratio: number): void {
    this.material.uniforms.uMixRatio.value = Math.max(0.0, Math.min(1.0, ratio));
  }

  public setSplitPosition(pos: number): void {
    this.material.uniforms.uSplitPosition.value = Math.max(0.0, Math.min(1.0, pos));
  }

  public setFeather(feather: number): void {
    this.material.uniforms.uFeather.value = Math.max(0.0, Math.min(0.5, feather));
  }

  public setOrganicScale(scale: number): void {
    this.material.uniforms.uOrganicScale.value = scale;
  }

  public updateTime(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  public setSize(width: number, height: number, dpr: number): void {
    const effectiveWidth = Math.max(1, Math.floor(width * dpr));
    const effectiveHeight = Math.max(1, Math.floor(height * dpr));

    this.targetA.setSize(effectiveWidth, effectiveHeight);
    this.targetB.setSize(effectiveWidth, effectiveHeight);
    this.material.uniforms.uResolution.value.set(effectiveWidth, effectiveHeight);
  }

  public render(renderer: THREE.WebGLRenderer): void {
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  public dispose(): void {
    this.targetA.dispose();
    this.targetB.dispose();
    this.material.dispose();
    this.quadMesh.geometry.dispose();
  }
}
