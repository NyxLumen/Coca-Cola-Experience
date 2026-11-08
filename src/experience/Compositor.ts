import * as THREE from 'three';
import type { CompositorMode } from './types';

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

  varying vec2 vUv;

  // 2D Simplex Noise for Phase 2A Baseline Organic Fluid Boundary
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
    // Debug Modes for Real-Time GPU Fluid Inspection
    if (uMode == 7) {
      // Fluid Density
      vec4 dens = texture2D(tFluidDensity, vUv);
      gl_FragColor = vec4(dens.rgb, 1.0);
      return;
    } else if (uMode == 8) {
      // Velocity Vector Field (normalized direction mapped to RGB)
      vec2 vel = texture2D(tFluidVelocity, vUv).xy * 0.02;
      vec3 col = vec3(0.5 + vel.x, 0.5 + vel.y, 0.5 - 0.5 * (vel.x + vel.y));
      gl_FragColor = vec4(col, 1.0);
      return;
    } else if (uMode == 9) {
      // Velocity Magnitude Heatmap
      vec2 vel = texture2D(tFluidVelocity, vUv).xy;
      float speed = length(vel) * 0.025;
      gl_FragColor = vec4(turbo(speed), 1.0);
      return;
    } else if (uMode == 10) {
      // Divergence Heatmap (Red: expansion, Blue: compression)
      float div = texture2D(tFluidDivergence, vUv).x * 20.0;
      vec3 col = vec3(max(div, 0.0), 0.0, max(-div, 0.0));
      gl_FragColor = vec4(col, 1.0);
      return;
    } else if (uMode == 11) {
      // Pressure Field (Cyan: positive, Magenta: negative)
      float p = texture2D(tFluidPressure, vUv).x * 10.0;
      vec3 col = (p >= 0.0)
        ? mix(vec3(0.0), vec3(0.1, 0.8, 0.9), clamp(p, 0.0, 1.0))
        : mix(vec3(0.0), vec3(0.9, 0.2, 0.7), clamp(-p, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
      return;
    }

    vec4 colA = texture2D(tRealityA, vUv);
    vec4 colB = texture2D(tRealityB, vUv);

    float mask = 0.0;
    float divider = 0.0;

    if (uMode == 1) {
      // 100% Reality A (Original)
      mask = 0.0;
    } else if (uMode == 2) {
      // 100% Reality B (Diet)
      mask = 1.0;
    } else if (uMode == 3) {
      // Side-by-Side diagnostic split with 1px indicator line
      float pixelWidth = 1.0 / max(uResolution.x, 1.0);
      float distToSplit = abs(vUv.x - uSplitPosition);
      divider = 1.0 - smoothstep(0.0, pixelWidth * 1.5, distToSplit);
      mask = step(uSplitPosition, vUv.x);
    } else if (uMode == 4) {
      // Organic test mask simulating fluid droplet / boundary reveal
      vec2 aspectUv = vUv;
      aspectUv.x *= (uResolution.x / max(uResolution.y, 1.0));

      float noise = fbm(aspectUv * uOrganicScale + vec2(uTime * 0.12, uTime * 0.08));
      float dist = distance(vUv, vec2(0.5, 0.45)) + noise * 0.22;
      float threshold = uMixRatio * 1.25;
      float featherVal = max(uFeather, 0.01);
      mask = smoothstep(threshold - featherVal, threshold + featherVal, dist);
      mask = 1.0 - mask;
    } else if (uMode == 5) {
      // Debug Mask Visualizer
      float featherVal = max(uFeather, 0.001);
      mask = smoothstep(uMixRatio - featherVal, uMixRatio + featherVal, vUv.x);
      gl_FragColor = vec4(vec3(mask), 1.0);
      return;
    } else if (uMode == 6) {
      // Fluid-Driven Dynamic Reveal Preview
      // Samples genuine density from the GPU fluid simulation
      vec4 fluidD = texture2D(tFluidDensity, vUv);
      float dens = length(fluidD.rgb);
      mask = clamp(dens, 0.0, 1.0);
    } else {
      // Mode 0: Smooth linear / directional composite blend
      float featherVal = max(uFeather, 0.001);
      float threshold = uMixRatio;
      mask = smoothstep(threshold - featherVal, threshold + featherVal, vUv.x);
    }

    vec4 finalColor = mix(colA, colB, clamp(mask, 0.0, 1.0));

    // Overlay divider line if in side-by-side mode
    if (uMode == 3 && divider > 0.0) {
      vec4 lineCol = vec4(1.0, 1.0, 1.0, 0.85);
      finalColor = mix(finalColor, lineCol, divider);
    }

    gl_FragColor = finalColor;
  }
`;

export class Compositor {
  public targetA: THREE.WebGLRenderTarget;
  public targetB: THREE.WebGLRenderTarget;
  public quadScene: THREE.Scene;
  public quadCamera: THREE.OrthographicCamera;
  public material: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;

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
        uMode: { value: 0 },
        uMixRatio: { value: 0.5 },
        uSplitPosition: { value: 0.5 },
        uFeather: { value: 0.05 },
        uOrganicScale: { value: 4.0 },
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(effectiveWidth, effectiveHeight) },
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
      case 'composite':
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
      case 'debug-mask':
        modeInt = 5;
        break;
      case 'fluid-reveal-preview':
        modeInt = 6;
        break;
      case 'fluid-density':
        modeInt = 7;
        break;
      case 'fluid-velocity':
        modeInt = 8;
        break;
      case 'fluid-velocity-magnitude':
        modeInt = 9;
        break;
      case 'fluid-divergence':
        modeInt = 10;
        break;
      case 'fluid-pressure':
        modeInt = 11;
        break;
    }
    this.material.uniforms.uMode.value = modeInt;
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
