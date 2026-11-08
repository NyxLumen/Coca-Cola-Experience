import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ExperienceEngine } from './ExperienceEngine';
import type { CompositorMode, ExperienceConfig, ExperienceTelemetry, TextureTier } from './types';
import './DualRealityExperience.css';

interface DualRealityExperienceProps {
  onBackToViewer?: () => void;
  onBackToPhase0?: () => void;
}

export function DualRealityExperience({
  onBackToViewer,
  onBackToPhase0,
}: DualRealityExperienceProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ExperienceEngine | null>(null);

  // Experience Configuration States
  const [mode, setMode] = useState<CompositorMode>('composite');
  const [mixRatio, setMixRatio] = useState<number>(0.5);
  const [splitPosition, setSplitPosition] = useState<number>(0.5);
  const [feather, setFeather] = useState<number>(0.05);
  const [organicScale, setOrganicScale] = useState<number>(4.0);
  const [textureTier, setTextureTier] = useState<TextureTier>('2k');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [exposure, setExposure] = useState<number>(1.05);

  // Fluid Tunable States
  const [idleEnabled, setIdleEnabled] = useState<boolean>(true);
  const [velocityDissipation, setVelocityDissipation] = useState<number>(0.985);
  const [splatForce, setSplatForce] = useState<number>(4500.0);

  // Telemetry HUD state
  const [telemetry, setTelemetry] = useState<ExperienceTelemetry>({
    fps: 0,
    frameTimeMs: 0,
    drawCallsTotal: 0,
    drawCallsA: 0,
    drawCallsB: 0,
    drawCallsCompositor: 0,
    trianglesTotal: 0,
    trianglesCan: 0,
    geometriesCount: 0,
    texturesCount: 0,
    estimatedVramMb: 0,
    renderTargetResolution: 'Loading...',
    loadTimeMs: 0,
  });

  // Store initial values in ref to avoid recreating engine
  const initialConfigRef = useRef<Partial<ExperienceConfig>>({
    mode,
    mixRatio,
    splitPosition,
    feather,
    organicScale,
    textureTier,
    autoRotate,
    exposure,
    fluidConfig: {
      idleEnabled,
      velocityDissipation,
      splatForce,
    },
  });

  // Initialize Experience Engine outside React's render loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new ExperienceEngine(
      container,
      initialConfigRef.current,
      (telemetryData) => {
        setTelemetry(telemetryData);
      }
    );

    engineRef.current = engine;

    // Attach automation hook to window for test scripts & validation
    (window as unknown as { __DUAL_REALITY_ENGINE__: ExperienceEngine }).__DUAL_REALITY_ENGINE__ = engine;
    (window as unknown as {
      __SET_EXPERIENCE_STATE__: (state: Partial<ExperienceConfig>) => void;
      __INJECT_FLUID_SPLAT__: (x: number, y: number, dx: number, dy: number, color?: THREE.Color, radius?: number) => void;
    }).__SET_EXPERIENCE_STATE__ = (state: Partial<ExperienceConfig>) => {
      if (state.mode !== undefined) setMode(state.mode);
      if (state.mixRatio !== undefined) setMixRatio(state.mixRatio);
      if (state.splitPosition !== undefined) setSplitPosition(state.splitPosition);
      if (state.feather !== undefined) setFeather(state.feather);
      if (state.organicScale !== undefined) setOrganicScale(state.organicScale);
      if (state.textureTier !== undefined) setTextureTier(state.textureTier);
      if (state.autoRotate !== undefined) setAutoRotate(state.autoRotate);
      if (state.exposure !== undefined) setExposure(state.exposure);
      if (state.fluidConfig?.idleEnabled !== undefined) setIdleEnabled(state.fluidConfig.idleEnabled);
      if (state.fluidConfig?.velocityDissipation !== undefined) setVelocityDissipation(state.fluidConfig.velocityDissipation);
      if (state.fluidConfig?.splatForce !== undefined) setSplatForce(state.fluidConfig.splatForce);
      engine.setConfig(state);
    };

    (window as unknown as {
      __INJECT_FLUID_SPLAT__: (x: number, y: number, dx: number, dy: number, color?: THREE.Color, radius?: number) => void;
    }).__INJECT_FLUID_SPLAT__ = (x: number, y: number, dx: number, dy: number, color?: THREE.Color, radius?: number) => {
      if (engine.fluidSimulation) {
        engine.fluidSimulation.addSplat(x, y, dx, dy, color, radius);
      }
    };

    return () => {
      engine.dispose();
      engineRef.current = null;
      delete (window as unknown as { __DUAL_REALITY_ENGINE__?: unknown }).__DUAL_REALITY_ENGINE__;
      delete (window as unknown as { __SET_EXPERIENCE_STATE__?: unknown }).__SET_EXPERIENCE_STATE__;
      delete (window as unknown as { __INJECT_FLUID_SPLAT__?: unknown }).__INJECT_FLUID_SPLAT__;
    };
  }, []);

  // Sync state changes to engine
  const updateConfig = useCallback((patch: Partial<ExperienceConfig>) => {
    if (patch.mode !== undefined) setMode(patch.mode);
    if (patch.mixRatio !== undefined) setMixRatio(patch.mixRatio);
    if (patch.splitPosition !== undefined) setSplitPosition(patch.splitPosition);
    if (patch.feather !== undefined) setFeather(patch.feather);
    if (patch.organicScale !== undefined) setOrganicScale(patch.organicScale);
    if (patch.textureTier !== undefined) setTextureTier(patch.textureTier);
    if (patch.autoRotate !== undefined) setAutoRotate(patch.autoRotate);
    if (patch.exposure !== undefined) setExposure(patch.exposure);

    if (patch.fluidConfig) {
      if (patch.fluidConfig.idleEnabled !== undefined) setIdleEnabled(patch.fluidConfig.idleEnabled);
      if (patch.fluidConfig.velocityDissipation !== undefined) setVelocityDissipation(patch.fluidConfig.velocityDissipation);
      if (patch.fluidConfig.splatForce !== undefined) setSplatForce(patch.fluidConfig.splatForce);
    }

    if (engineRef.current) {
      engineRef.current.setConfig(patch);
    }
  }, []);

  const handleResetCamera = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.resetCamera();
    }
  }, []);

  const toggleIdle = useCallback(() => {
    const nextVal = !idleEnabled;
    setIdleEnabled(nextVal);
    updateConfig({ fluidConfig: { idleEnabled: nextVal } });
  }, [idleEnabled, updateConfig]);

  return (
    <div className="dual-reality-container">
      {/* WebGL Canvas Mount */}
      <div ref={mountRef} className="webgl-canvas-container" />

      {/* Header Bar */}
      <header className="experience-header">
        <div className="experience-title-group">
          <span className="brand-eyebrow">Coca-Cola Continuous Experience</span>
          <h1 className="experience-title">Dual-Reality & GPU Fluid Engine</h1>
        </div>

        <div className="header-actions">
          {onBackToViewer && (
            <button className="nav-button" onClick={onBackToViewer}>
              ← Phase 1.3 Asset Viewer
            </button>
          )}
          {onBackToPhase0 && (
            <button className="nav-button" onClick={onBackToPhase0}>
              Phase 0 Concept
            </button>
          )}
          <span className="phase-pill">Phase 2B: GPU Fluid Simulation</span>
        </div>
      </header>

      {/* Telemetry HUD Panel */}
      <aside className="experience-telemetry-hud">
        <div className="telemetry-row">
          <span>Target Res:</span>
          <span className="telemetry-val">{telemetry.renderTargetResolution}</span>
        </div>
        <div className="telemetry-row">
          <span>FPS / Delta:</span>
          <span
            className={`telemetry-val ${telemetry.fps >= 55 ? 'fps-good' : ''}`}
          >
            {telemetry.fps} fps ({telemetry.frameTimeMs} ms)
          </span>
        </div>
        <div className="telemetry-row">
          <span>Draw Calls (A/B/Q):</span>
          <span className="telemetry-val">
            {telemetry.drawCallsA} + {telemetry.drawCallsB} + {telemetry.drawCallsCompositor} = {telemetry.drawCallsTotal}
          </span>
        </div>
        <div className="telemetry-row">
          <span>Triangles (Can):</span>
          <span className="telemetry-val">{telemetry.trianglesCan.toLocaleString()}</span>
        </div>
        {telemetry.fluid && (
          <>
            <div className="telemetry-row">
              <span>Fluid Grid (Sim/Dye):</span>
              <span className="telemetry-val fluid-stat">
                {telemetry.fluid.simWidth}×{telemetry.fluid.simHeight} / {telemetry.fluid.dyeWidth}×{telemetry.fluid.dyeHeight}
              </span>
            </div>
            <div className="telemetry-row">
              <span>Fluid Passes:</span>
              <span className="telemetry-val fluid-stat">
                {telemetry.fluid.passesPerFrame} passes ({telemetry.fluid.jacobiIterations} iters)
              </span>
            </div>
            <div className="telemetry-row">
              <span>Fluid VRAM:</span>
              <span className="telemetry-val fluid-stat">~{telemetry.fluid.gpuMemoryEstMb} MB</span>
            </div>
          </>
        )}
        <div className="telemetry-row">
          <span>Total VRAM:</span>
          <span className="telemetry-val">~{telemetry.estimatedVramMb} MB</span>
        </div>
      </aside>

      {/* Floating Control Panel */}
      <nav className="experience-control-panel">
        <div className="mode-selector-group">
          <div className="mode-section-label">Presentation & Baseline Modes (Phase 2A)</div>
          <div className="mode-selector">
            <button
              className={`mode-btn ${mode === 'composite' ? 'active' : ''}`}
              onClick={() => updateConfig({ mode: 'composite' })}
            >
              Composite Slider
            </button>
            <button
              className={`mode-btn ${mode === 'reality-a' ? 'active' : ''}`}
              onClick={() => updateConfig({ mode: 'reality-a' })}
            >
              100% Reality A
            </button>
            <button
              className={`mode-btn ${mode === 'reality-b' ? 'diet-active' : ''}`}
              onClick={() => updateConfig({ mode: 'reality-b' })}
            >
              100% Reality B
            </button>
            <button
              className={`mode-btn ${mode === 'side-by-side' ? 'active' : ''}`}
              onClick={() => updateConfig({ mode: 'side-by-side' })}
            >
              Side-by-Side Split
            </button>
            <button
              className={`mode-btn ${mode === 'organic-mask' ? 'active' : ''}`}
              onClick={() => updateConfig({ mode: 'organic-mask' })}
            >
              Organic Noise
            </button>
            <button
              className={`mode-btn ${mode === 'fluid-reveal-preview' ? 'fluid-active' : ''}`}
              onClick={() => updateConfig({ mode: 'fluid-reveal-preview' })}
            >
              Fluid Reveal Preview
            </button>
          </div>
        </div>

        <div className="mode-selector-group">
          <div className="mode-section-label">GPU Fluid Simulation Diagnostics (Phase 2B)</div>
          <div className="mode-selector">
            <button
              className={`mode-btn ${mode === 'fluid-velocity-magnitude' ? 'fluid-active' : ''}`}
              onClick={() => updateConfig({ mode: 'fluid-velocity-magnitude' })}
            >
              Velocity Speed
            </button>
            <button
              className={`mode-btn ${mode === 'fluid-velocity' ? 'fluid-active' : ''}`}
              onClick={() => updateConfig({ mode: 'fluid-velocity' })}
            >
              Velocity Vectors
            </button>
            <button
              className={`mode-btn ${mode === 'fluid-density' ? 'fluid-active' : ''}`}
              onClick={() => updateConfig({ mode: 'fluid-density' })}
            >
              Density Field
            </button>
            <button
              className={`mode-btn ${mode === 'fluid-divergence' ? 'fluid-active' : ''}`}
              onClick={() => updateConfig({ mode: 'fluid-divergence' })}
            >
              Divergence
            </button>
            <button
              className={`mode-btn ${mode === 'fluid-pressure' ? 'fluid-active' : ''}`}
              onClick={() => updateConfig({ mode: 'fluid-pressure' })}
            >
              Pressure
            </button>
            <button
              className={`mode-btn ${mode === 'debug-mask' ? 'active' : ''}`}
              onClick={() => updateConfig({ mode: 'debug-mask' })}
            >
              Mask Grayscale
            </button>
          </div>
        </div>

        {/* Secondary Row: Quick Actions & Toggles */}
        <div className="control-row">
          <div className="secondary-actions">
            <button
              className={`action-btn ${idleEnabled ? 'active-blue' : ''}`}
              onClick={toggleIdle}
            >
              {idleEnabled ? 'Idle Wake: ON' : 'Idle Wake: OFF'}
            </button>
            <button
              className={`action-btn ${autoRotate ? 'active' : ''}`}
              onClick={() => updateConfig({ autoRotate: !autoRotate })}
            >
              {autoRotate ? 'Pause Rotation' : 'Auto-Rotate'}
            </button>
            <button className="action-btn" onClick={handleResetCamera}>
              Reset Camera
            </button>
            <select
              className="action-btn"
              value={textureTier}
              onChange={(e) => updateConfig({ textureTier: e.target.value as TextureTier })}
              style={{ background: '#1e293b' }}
            >
              <option value="4k">4K Master</option>
              <option value="2k">2K Production</option>
              <option value="1k">1K Mobile</option>
            </select>
          </div>

          {/* Contextual Sliders */}
          {mode === 'side-by-side' ? (
            <div className="slider-group">
              <label className="slider-label">Split Position</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={splitPosition}
                onChange={(e) => updateConfig({ splitPosition: parseFloat(e.target.value) })}
                className="slider-input"
              />
              <span className="slider-val">{(splitPosition * 100).toFixed(0)}%</span>
            </div>
          ) : mode.startsWith('fluid-') ? (
            <div className="slider-group">
              <label className="slider-label">Velocity Inertia</label>
              <input
                type="range"
                min="0.9"
                max="0.998"
                step="0.001"
                value={velocityDissipation}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVelocityDissipation(val);
                  updateConfig({ fluidConfig: { velocityDissipation: val } });
                }}
                className="slider-input"
              />
              <span className="slider-val">{velocityDissipation.toFixed(3)}</span>
            </div>
          ) : (
            <div className="slider-group">
              <label className="slider-label">Mix Ratio</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={mixRatio}
                onChange={(e) => updateConfig({ mixRatio: parseFloat(e.target.value) })}
                className="slider-input"
              />
              <span className="slider-val">{(mixRatio * 100).toFixed(0)}%</span>
            </div>
          )}

          {mode.startsWith('fluid-') ? (
            <div className="slider-group">
              <label className="slider-label">Force</label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={splatForce}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSplatForce(val);
                  updateConfig({ fluidConfig: { splatForce: val } });
                }}
                className="slider-input"
              />
              <span className="slider-val">{splatForce.toFixed(0)}</span>
            </div>
          ) : (
            <div className="slider-group">
              <label className="slider-label">Feather</label>
              <input
                type="range"
                min="0.001"
                max="0.25"
                step="0.005"
                value={feather}
                onChange={(e) => updateConfig({ feather: parseFloat(e.target.value) })}
                className="slider-input"
              />
              <span className="slider-val">{(feather * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
