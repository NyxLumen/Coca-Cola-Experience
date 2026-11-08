import * as THREE from 'three';
import { DoubleRenderTarget } from './DoubleRenderTarget';
import { DEFAULT_FLUID_CONFIG } from './FluidConfig';
import {
  BASE_VERTEX_SHADER,
  ADVECTION_FRAGMENT_SHADER,
  SPLAT_FRAGMENT_SHADER,
  DIVERGENCE_FRAGMENT_SHADER,
  JACOBI_PRESSURE_FRAGMENT_SHADER,
  GRADIENT_SUBTRACT_FRAGMENT_SHADER,
  DECAY_FRAGMENT_SHADER,
  DEBUG_VISUALIZER_FRAGMENT_SHADER,
} from './FluidShaders';
import type { FluidConfig, FluidDebugMode, FluidTelemetry, PointerState } from './types';

interface SplatQueueItem {
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: THREE.Color;
  radius: number;
}

export class FluidSimulation {
  private renderer: THREE.WebGLRenderer;
  private config: FluidConfig;

  // Viewport and Resolution
  private viewWidth: number = 1920;
  private viewHeight: number = 1080;
  private aspect: number = 16 / 9;

  private simWidth: number = 256;
  private simHeight: number = 144;
  private dyeWidth: number = 512;
  private dyeHeight: number = 288;

  // FBO Buffers
  private velocity: DoubleRenderTarget;
  private density: DoubleRenderTarget;
  private pressure: DoubleRenderTarget;
  private divergence: THREE.WebGLRenderTarget;

  // Fullscreen Rendering Rig
  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private quadMesh: THREE.Mesh;

  // Shader Materials
  private advectionMat: THREE.ShaderMaterial;
  private splatMat: THREE.ShaderMaterial;
  private divergenceMat: THREE.ShaderMaterial;
  private jacobiMat: THREE.ShaderMaterial;
  private gradientSubtractMat: THREE.ShaderMaterial;
  private decayMat: THREE.ShaderMaterial;
  private debugMat: THREE.ShaderMaterial;

  // Input & Splat Queues
  private pointer: PointerState = {
    x: 0.5,
    y: 0.5,
    prevX: 0.5,
    prevY: 0.5,
    deltaX: 0,
    deltaY: 0,
    isDown: false,
    isMoving: false,
    speed: 0,
  };
  private splatQueue: SplatQueueItem[] = [];

  // Idle state
  private idleTime: number = 0;
  private isDestroyed: boolean = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    viewWidth: number,
    viewHeight: number,
    initialConfig?: Partial<FluidConfig>
  ) {
    this.renderer = renderer;
    this.config = { ...DEFAULT_FLUID_CONFIG, ...initialConfig };
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.aspect = viewWidth / Math.max(viewHeight, 1);

    this.computeGridResolutions();

    // 1. Initialize Ping-Pong FBOs
    this.velocity = new DoubleRenderTarget(this.simWidth, this.simHeight);
    this.pressure = new DoubleRenderTarget(this.simWidth, this.simHeight);
    this.divergence = new THREE.WebGLRenderTarget(this.simWidth, this.simHeight, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.density = new DoubleRenderTarget(this.dyeWidth, this.dyeHeight);

    // 2. Fullscreen Quad
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // 3. Materials
    this.advectionMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: ADVECTION_FRAGMENT_SHADER,
      uniforms: {
        tVelocity: { value: null },
        tSource: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / this.simWidth, 1 / this.simHeight) },
        uDt: { value: 0.016 },
        uDissipation: { value: this.config.velocityDissipation },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.splatMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: SPLAT_FRAGMENT_SHADER,
      uniforms: {
        tTarget: { value: null },
        uPoint: { value: new THREE.Vector2(0.5, 0.5) },
        uColor: { value: new THREE.Vector3(0, 0, 0) },
        uRadius: { value: this.config.splatRadius },
        uAspect: { value: this.aspect },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.divergenceMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DIVERGENCE_FRAGMENT_SHADER,
      uniforms: {
        tVelocity: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / this.simWidth, 1 / this.simHeight) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.jacobiMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: JACOBI_PRESSURE_FRAGMENT_SHADER,
      uniforms: {
        tPressure: { value: null },
        tDivergence: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / this.simWidth, 1 / this.simHeight) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.gradientSubtractMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: GRADIENT_SUBTRACT_FRAGMENT_SHADER,
      uniforms: {
        tPressure: { value: null },
        tVelocity: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / this.simWidth, 1 / this.simHeight) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.decayMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DECAY_FRAGMENT_SHADER,
      uniforms: {
        tSource: { value: null },
        uDecay: { value: this.config.pressureDissipation },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.debugMat = new THREE.ShaderMaterial({
      vertexShader: BASE_VERTEX_SHADER,
      fragmentShader: DEBUG_VISUALIZER_FRAGMENT_SHADER,
      uniforms: {
        tTexture: { value: null },
        uDebugType: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(quadGeo, this.advectionMat);
    this.quadScene.add(this.quadMesh);
  }

  private computeGridResolutions(): void {
    const maxSim = this.config.simResolution;
    const maxDye = this.config.dyeResolution;

    if (this.aspect >= 1.0) {
      this.simWidth = maxSim;
      this.simHeight = Math.max(32, Math.round(maxSim / this.aspect));
      this.dyeWidth = maxDye;
      this.dyeHeight = Math.max(64, Math.round(maxDye / this.aspect));
    } else {
      this.simWidth = Math.max(32, Math.round(maxSim * this.aspect));
      this.simHeight = maxSim;
      this.dyeWidth = Math.max(64, Math.round(maxDye * this.aspect));
      this.dyeHeight = maxDye;
    }
  }

  private renderPass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quadMesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  public step(dt: number = 0.016): void {
    if (this.isDestroyed) return;
    const boundedDt = Math.min(dt, 0.033);

    // 1. Idle Energy Injection
    if (this.config.idleEnabled) {
      this.idleTime += boundedDt * this.config.idleSpeed;
      // Dual counter-rotating harmonic vortices create subtle organic fluid wake
      const t = this.idleTime;
      const x1 = 0.5 + 0.28 * Math.cos(t * 1.1);
      const y1 = 0.5 + 0.22 * Math.sin(t * 1.4);
      const dx1 = -Math.sin(t * 1.1) * this.config.idleStrength;
      const dy1 = Math.cos(t * 1.4) * this.config.idleStrength;

      this.splatQueue.push({
        x: x1,
        y: y1,
        dx: dx1,
        dy: dy1,
        color: this.config.splatDensity,
        radius: this.config.splatRadius * 1.5,
      });

      const x2 = 0.5 + 0.25 * Math.sin(t * 0.9);
      const y2 = 0.5 + 0.20 * Math.cos(t * 1.3);
      const dx2 = Math.cos(t * 0.9) * (this.config.idleStrength * 0.75);
      const dy2 = -Math.sin(t * 1.3) * (this.config.idleStrength * 0.75);

      this.splatQueue.push({
        x: x2,
        y: y2,
        dx: dx2,
        dy: dy2,
        color: this.config.splatDensity,
        radius: this.config.splatRadius * 1.8,
      });
    }

    // 2. Process Pointer & Splat Queue
    while (this.splatQueue.length > 0) {
      const splat = this.splatQueue.shift()!;

      // Inject velocity
      this.splatMat.uniforms.tTarget.value = this.velocity.read.texture;
      this.splatMat.uniforms.uPoint.value.set(splat.x, splat.y);
      this.splatMat.uniforms.uColor.value.set(splat.dx, splat.dy, 0.0);
      this.splatMat.uniforms.uRadius.value = splat.radius;
      this.splatMat.uniforms.uAspect.value = this.aspect;
      this.renderPass(this.splatMat, this.velocity.write);
      this.velocity.swap();

      // Inject density
      this.splatMat.uniforms.tTarget.value = this.density.read.texture;
      this.splatMat.uniforms.uPoint.value.set(splat.x, splat.y);
      this.splatMat.uniforms.uColor.value.set(splat.color.r, splat.color.g, splat.color.b);
      this.splatMat.uniforms.uRadius.value = splat.radius * 1.1;
      this.splatMat.uniforms.uAspect.value = this.aspect;
      this.renderPass(this.splatMat, this.density.write);
      this.density.swap();
    }

    // 3. Velocity Advection
    this.advectionMat.uniforms.tVelocity.value = this.velocity.read.texture;
    this.advectionMat.uniforms.tSource.value = this.velocity.read.texture;
    this.advectionMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.advectionMat.uniforms.uDt.value = boundedDt;
    this.advectionMat.uniforms.uDissipation.value = this.config.velocityDissipation;
    this.renderPass(this.advectionMat, this.velocity.write);
    this.velocity.swap();

    // 4. Compute Velocity Divergence
    this.divergenceMat.uniforms.tVelocity.value = this.velocity.read.texture;
    this.divergenceMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.renderPass(this.divergenceMat, this.divergence);

    // 5. Warm Start / Dissipate Pressure
    this.decayMat.uniforms.tSource.value = this.pressure.read.texture;
    this.decayMat.uniforms.uDecay.value = this.config.pressureDissipation;
    this.renderPass(this.decayMat, this.pressure.write);
    this.pressure.swap();

    // 6. Jacobi Pressure Poisson Iterations
    this.jacobiMat.uniforms.tDivergence.value = this.divergence.texture;
    this.jacobiMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);

    const iters = this.config.pressureIterations;
    for (let i = 0; i < iters; i++) {
      this.jacobiMat.uniforms.tPressure.value = this.pressure.read.texture;
      this.renderPass(this.jacobiMat, this.pressure.write);
      this.pressure.swap();
    }

    // 7. Gradient Subtraction (Project Divergence-Free Field)
    this.gradientSubtractMat.uniforms.tPressure.value = this.pressure.read.texture;
    this.gradientSubtractMat.uniforms.tVelocity.value = this.velocity.read.texture;
    this.gradientSubtractMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.renderPass(this.gradientSubtractMat, this.velocity.write);
    this.velocity.swap();

    // 8. Density Advection
    this.advectionMat.uniforms.tVelocity.value = this.velocity.read.texture;
    this.advectionMat.uniforms.tSource.value = this.density.read.texture;
    this.advectionMat.uniforms.uTexelSize.value.set(1 / this.dyeWidth, 1 / this.dyeHeight);
    this.advectionMat.uniforms.uDt.value = boundedDt;
    this.advectionMat.uniforms.uDissipation.value = this.config.densityDissipation;
    this.renderPass(this.advectionMat, this.density.write);
    this.density.swap();
  }

  public addSplat(
    x: number,
    y: number,
    dx: number,
    dy: number,
    color?: THREE.Color,
    radius?: number
  ): void {
    this.splatQueue.push({
      x: Math.max(0.0, Math.min(1.0, x)),
      y: Math.max(0.0, Math.min(1.0, y)),
      dx,
      dy,
      color: color || this.config.splatDensity,
      radius: radius || this.config.splatRadius,
    });
  }

  public onPointerMove(normX: number, normY: number): void {
    const dx = normX - this.pointer.x;
    const dy = normY - this.pointer.y;
    const distSq = dx * dx + dy * dy;

    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;
    this.pointer.x = normX;
    this.pointer.y = normY;
    this.pointer.deltaX = dx;
    this.pointer.deltaY = dy;
    this.pointer.speed = Math.sqrt(distSq);

    // Noise threshold: ignore sub-pixel tremors
    if (distSq > 0.000004) {
      this.pointer.isMoving = true;
      const forceMultiplier = this.config.splatForce;
      this.addSplat(
        normX,
        normY,
        dx * forceMultiplier,
        dy * forceMultiplier,
        this.config.splatDensity,
        this.config.splatRadius
      );
    }
  }

  public onPointerDown(normX: number, normY: number): void {
    this.pointer.isDown = true;
    this.pointer.x = normX;
    this.pointer.y = normY;
    this.pointer.prevX = normX;
    this.pointer.prevY = normY;

    // Burst splat on click / tap
    this.addSplat(
      normX,
      normY,
      (Math.random() - 0.5) * 50.0,
      (Math.random() - 0.5) * 50.0,
      this.config.splatDensity,
      this.config.splatRadius * 1.5
    );
  }

  public onPointerUp(): void {
    this.pointer.isDown = false;
    this.pointer.isMoving = false;
  }

  public renderDebug(
    target: THREE.WebGLRenderTarget | null,
    mode: FluidDebugMode
  ): void {
    if (mode === 'none') return;

    let debugType = 1;
    let tex: THREE.Texture = this.velocity.read.texture;

    switch (mode) {
      case 'velocity':
        debugType = 1;
        tex = this.velocity.read.texture;
        break;
      case 'velocity-magnitude':
        debugType = 2;
        tex = this.velocity.read.texture;
        break;
      case 'density':
        debugType = 3;
        tex = this.density.read.texture;
        break;
      case 'divergence':
        debugType = 4;
        tex = this.divergence.texture;
        break;
      case 'pressure':
        debugType = 5;
        tex = this.pressure.read.texture;
        break;
    }

    this.debugMat.uniforms.tTexture.value = tex;
    this.debugMat.uniforms.uDebugType.value = debugType;
    this.renderPass(this.debugMat, target);
  }

  // Texture Exposure for Compositor
  public getVelocityTexture(): THREE.Texture {
    return this.velocity.read.texture;
  }

  public getDensityTexture(): THREE.Texture {
    return this.density.read.texture;
  }

  public getPressureTexture(): THREE.Texture {
    return this.pressure.read.texture;
  }

  public getDivergenceTexture(): THREE.Texture {
    return this.divergence.texture;
  }

  public setConfig(newConfig: Partial<FluidConfig>): void {
    const oldSimRes = this.config.simResolution;
    const oldDyeRes = this.config.dyeResolution;

    this.config = { ...this.config, ...newConfig };

    if (newConfig.simResolution !== undefined && newConfig.simResolution !== oldSimRes) {
      this.resize(this.viewWidth, this.viewHeight);
    } else if (newConfig.dyeResolution !== undefined && newConfig.dyeResolution !== oldDyeRes) {
      this.resize(this.viewWidth, this.viewHeight);
    }
  }

  public getConfig(): FluidConfig {
    return { ...this.config };
  }

  public getTelemetry(): FluidTelemetry {
    // 8 bytes per pixel (RGBA HalfFloat = 2 bytes * 4 channels = 8 bytes)
    // 2 velocity + 2 pressure + 1 divergence + 2 density
    const simPixels = this.simWidth * this.simHeight;
    const dyePixels = this.dyeWidth * this.dyeHeight;
    const totalBytes = (simPixels * 5 + dyePixels * 2) * 8;
    const gpuMemoryEstMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;

    return {
      simWidth: this.simWidth,
      simHeight: this.simHeight,
      dyeWidth: this.dyeWidth,
      dyeHeight: this.dyeHeight,
      passesPerFrame: 4 + this.config.pressureIterations,
      jacobiIterations: this.config.pressureIterations,
      gpuMemoryEstMb,
      activeSplatsCount: this.splatQueue.length,
    };
  }

  public resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.aspect = width / Math.max(height, 1);

    this.computeGridResolutions();

    this.velocity.setSize(this.simWidth, this.simHeight);
    this.pressure.setSize(this.simWidth, this.simHeight);
    this.divergence.setSize(this.simWidth, this.simHeight);
    this.density.setSize(this.dyeWidth, this.dyeHeight);

    this.advectionMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.divergenceMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.jacobiMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.gradientSubtractMat.uniforms.uTexelSize.value.set(1 / this.simWidth, 1 / this.simHeight);
    this.splatMat.uniforms.uAspect.value = this.aspect;
  }

  public dispose(): void {
    this.isDestroyed = true;
    this.velocity.dispose();
    this.density.dispose();
    this.pressure.dispose();
    this.divergence.dispose();

    this.advectionMat.dispose();
    this.splatMat.dispose();
    this.divergenceMat.dispose();
    this.jacobiMat.dispose();
    this.gradientSubtractMat.dispose();
    this.decayMat.dispose();
    this.debugMat.dispose();

    this.quadMesh.geometry.dispose();
  }
}
