import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AssetManager } from './AssetManager';
import { RealityA } from './RealityA';
import { RealityB } from './RealityB';
import { Compositor } from './Compositor';
import type { ExperienceConfig, ExperienceTelemetry, TextureTier } from './types';

export class ExperienceEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private assetManager: AssetManager;
  private realityA: RealityA | null = null;
  private realityB: RealityB | null = null;
  private compositor: Compositor | null = null;
  private envTexture: THREE.Texture | null = null;

  private config: ExperienceConfig = {
    mode: 'composite',
    mixRatio: 0.5,
    splitPosition: 0.5,
    feather: 0.05,
    organicScale: 4.0,
    textureTier: '2k',
    autoRotate: false,
    exposure: 1.05,
  };

  private animationFrameId: number | null = null;
  private isDestroyed: boolean = false;
  private isReady: boolean = false;
  private canRotationY: number = 0;

  // Telemetry tracking
  public latestTelemetry: ExperienceTelemetry | null = null;
  private onTelemetryUpdate?: (telemetry: ExperienceTelemetry) => void;
  private lastTime: number = performance.now();
  private frameCount: number = 0;
  private fpsAccumulator: number = 0;
  private loadTimeMs: number = 0;
  private canTriangles: number = 0;

  constructor(
    container: HTMLElement,
    initialConfig?: Partial<ExperienceConfig>,
    onTelemetry?: (telemetry: ExperienceTelemetry) => void
  ) {
    this.container = container;
    this.onTelemetryUpdate = onTelemetry;
    if (initialConfig) {
      this.config = { ...this.config, ...initialConfig };
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.config.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.container.appendChild(this.renderer.domElement);

    // 2. Single Shared Camera (38 deg vertical FOV, 35mm equivalent)
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0, 0.15, 3.2);

    // 3. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 6.0;
    this.controls.target.set(0, 0, 0);

    // 4. Asset Manager
    this.assetManager = new AssetManager();

    // 5. Compositor Pass
    this.compositor = new Compositor(width, height, dpr);
    this.applyConfigToCompositor();

    // 6. Bind Event Listeners
    window.addEventListener('resize', this.handleResize);

    // 7. Initialize Async Assets
    this.initPipeline();
  }

  private async initPipeline(): Promise<void> {
    const startTime = performance.now();

    // Generate Shared PMREM Studio Environment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    pmremGenerator.dispose();
    roomEnv.dispose();

    try {
      const assets = await this.assetManager.loadAll(this.config.textureTier);
      if (this.isDestroyed) return;

      this.canTriangles = assets.canonicalGeometry.index
        ? assets.canonicalGeometry.index.count / 3
        : 0;

      // Instantiate Reality A (Original Coke)
      this.realityA = new RealityA(
        assets.canonicalGeometry,
        assets.texturesA,
        this.envTexture
      );

      // Instantiate Reality B (Diet Coke) - Reusing Identical Canonical Geometry
      this.realityB = new RealityB(
        assets.canonicalGeometry,
        assets.texturesB,
        this.envTexture
      );

      this.loadTimeMs = Math.round(performance.now() - startTime);
      this.isReady = true;

      // Start the Continuous Render Loop
      this.startLoop();
    } catch (err) {
      console.error('Failed to initialize Dual-Reality Engine:', err);
    }
  }

  private applyConfigToCompositor(): void {
    if (!this.compositor) return;
    this.compositor.setMode(this.config.mode);
    this.compositor.setMixRatio(this.config.mixRatio);
    this.compositor.setSplitPosition(this.config.splitPosition);
    this.compositor.setFeather(this.config.feather);
    this.compositor.setOrganicScale(this.config.organicScale);
  }

  public setConfig(newConfig: Partial<ExperienceConfig>): void {
    const oldTier = this.config.textureTier;
    this.config = { ...this.config, ...newConfig };

    if (newConfig.exposure !== undefined) {
      this.renderer.toneMappingExposure = newConfig.exposure;
    }

    if (newConfig.textureTier !== undefined && newConfig.textureTier !== oldTier) {
      this.changeTextureTier(newConfig.textureTier);
    }

    this.applyConfigToCompositor();
  }

  private changeTextureTier(tier: TextureTier): void {
    if (!this.realityA || !this.realityB) return;
    const texturesA = this.assetManager.loadProductTextures('classic', tier);
    const texturesB = this.assetManager.loadProductTextures('diet', tier);
    this.realityA.updateMaterialTextures(texturesA);
    this.realityB.updateMaterialTextures(texturesB);
  }

  public resetCamera(): void {
    this.camera.position.set(0, 0.15, 3.2);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private handleResize = (): void => {
    if (this.isDestroyed || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr);

    if (this.compositor) {
      this.compositor.setSize(width, height, dpr);
    }
  };

  private startLoop(): void {
    const animate = (currentTime: number) => {
      if (this.isDestroyed) return;
      this.animationFrameId = requestAnimationFrame(animate);

      const delta = currentTime - this.lastTime;
      this.lastTime = currentTime;
      this.frameCount++;
      this.fpsAccumulator += 1000 / (delta || 16.6);

      // Auto-Rotation updates both can meshes simultaneously to ensure perfect sync
      if (this.config.autoRotate && this.realityA && this.realityB) {
        this.canRotationY += 0.008;
        this.realityA.canMesh.rotation.y = this.canRotationY;
        this.realityB.canMesh.rotation.y = this.canRotationY;
      }

      this.controls.update();

      if (this.isReady && this.realityA && this.realityB && this.compositor) {
        // Reset renderer calls count
        this.renderer.info.reset();

        // 1. Pass A: Render Reality A to Target A
        this.renderer.setRenderTarget(this.compositor.targetA);
        this.renderer.render(this.realityA.scene, this.camera);
        const callsA = this.renderer.info.render.calls;

        // 2. Pass B: Render Reality B to Target B
        this.renderer.setRenderTarget(this.compositor.targetB);
        this.renderer.render(this.realityB.scene, this.camera);
        const callsB = this.renderer.info.render.calls - callsA;

        // 3. Pass C: Fullscreen Compositor Render
        this.compositor.updateTime(currentTime * 0.001);
        this.compositor.render(this.renderer);
        const totalCalls = this.renderer.info.render.calls;
        const callsCompositor = totalCalls - (callsA + callsB);

        // Telemetry calculation every 30 frames
        if (this.frameCount >= 30) {
          const avgFps = Math.round(this.fpsAccumulator / this.frameCount);
          const avgDelta = (1000 / avgFps).toFixed(1);
          this.frameCount = 0;
          this.fpsAccumulator = 0;

          const rtWidth = this.compositor.targetA.width;
          const rtHeight = this.compositor.targetA.height;

          this.latestTelemetry = {
            fps: avgFps,
            frameTimeMs: parseFloat(avgDelta),
            drawCallsTotal: totalCalls,
            drawCallsA: callsA,
            drawCallsB: callsB,
            drawCallsCompositor: callsCompositor,
            trianglesTotal: this.renderer.info.render.triangles,
            trianglesCan: this.canTriangles,
            geometriesCount: this.renderer.info.memory.geometries,
            texturesCount: this.renderer.info.memory.textures,
            estimatedVramMb: Math.round(
              ((rtWidth * rtHeight * 8 * 2) / (1024 * 1024)) + 48
            ),
            renderTargetResolution: `${rtWidth} × ${rtHeight}`,
            loadTimeMs: this.loadTimeMs,
          };

          if (this.onTelemetryUpdate) {
            this.onTelemetryUpdate(this.latestTelemetry);
          }
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  public dispose(): void {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.handleResize);

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.controls.dispose();

    if (this.realityA) {
      this.realityA.dispose();
      this.realityA = null;
    }

    if (this.realityB) {
      this.realityB.dispose();
      this.realityB = null;
    }

    if (this.compositor) {
      this.compositor.dispose();
      this.compositor = null;
    }

    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }

    if (this.assetManager) {
      this.assetManager.dispose();
    }

    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
