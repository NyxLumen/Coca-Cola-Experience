import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9572;
const USER_DATA = '/tmp/chrome_phase2d_audit';
const OUTPUT_DIR = 'public/models/phase2d_audit';
const ARTIFACT_DIR = '/home/lumen/.gemini/antigravity/brain/82964857-e449-46e0-81ce-123418d11be5';

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendCDP(ws, method, params = {}) {
  const id = Math.floor(Math.random() * 1000000);
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalInPage(ws, expression) {
  const res = await sendCDP(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error('Evaluation error: ' + JSON.stringify(res.exceptionDetails));
  }
  return res.result?.value;
}

async function captureShot(ws, filename, label) {
  const shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(shot.data, 'base64');
  const outPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outPath, buffer);
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
  }
  console.log(`      ✓ Saved [${label}] -> ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
  return buffer;
}

async function run() {
  console.log('================================================================================');
  console.log(' Coca-Cola Experience — Phase 2D: Rendering Pipeline Comprehensive Technical Audit');
  console.log('================================================================================');

  const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1600,1000',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    'http://localhost:5173/?view=experience'
  ], { stdio: 'ignore' });

  try {
    let tab = null;
    for (let i = 0; i < 25; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        const list = await res.json();
        tab = list.find((t) => t.url.includes('localhost:5173'));
        if (tab) break;
      } catch {}
    }

    if (!tab) throw new Error('Chrome tab not found on port ' + PORT);
    console.log('[1/5] Connected to Chrome tab:', tab.webSocketDebuggerUrl);

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('[2/5] Awaiting Dual-Reality Engine initialization...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const ready = await evalInPage(ws, `window.__DUAL_REALITY_ENGINE__?.isReady === true`);
      if (ready) break;
    }
    await sleep(1500);

    console.log('[3/5] Extracting In-Depth Rendering Engine Diagnostics...');

    const auditData = await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        if (!engine) return { error: 'No engine' };

        const renderer = engine.renderer;
        const gl = renderer.getContext();
        const caps = renderer.capabilities;
        const comp = engine.compositor;
        const realA = engine.realityA;
        const realB = engine.realityB;
        const fluid = engine.fluidSimulation;

        const getTextureInfo = (tex) => {
          if (!tex) return null;
          return {
            name: tex.name,
            colorSpace: tex.colorSpace,
            format: tex.format,
            type: tex.type,
            minFilter: tex.minFilter,
            magFilter: tex.magFilter,
            generateMipmaps: tex.generateMipmaps,
            anisotropy: tex.anisotropy,
            flipY: tex.flipY,
            wrapS: tex.wrapS,
            wrapT: tex.wrapT,
          };
        };

        const getRenderTargetInfo = (rt, name) => {
          if (!rt) return null;
          return {
            name,
            width: rt.width,
            height: rt.height,
            samples: rt.samples,
            depthBuffer: rt.depthBuffer,
            stencilBuffer: rt.stencilBuffer,
            texture: getTextureInfo(rt.texture),
          };
        };

        const keyLightA = realA.keyLight;
        const shadowCamA = keyLightA?.shadow?.camera;

        const matA = realA.material;
        const matB = realB.material;

        return {
          renderer: {
            isWebGL2: caps.isWebGL2,
            contextAttributes: gl.getContextAttributes(),
            pixelRatio: renderer.getPixelRatio(),
            outputColorSpace: renderer.outputColorSpace,
            toneMapping: renderer.toneMapping,
            toneMappingExposure: renderer.toneMappingExposure,
            shadowMap: {
              enabled: renderer.shadowMap.enabled,
              type: renderer.shadowMap.type,
              autoUpdate: renderer.shadowMap.autoUpdate,
            },
            capabilities: {
              maxTextures: caps.maxTextures,
              maxVertexTextures: caps.maxVertexTextures,
              maxTextureSize: caps.maxTextureSize,
              maxCubemapSize: caps.maxCubemapSize,
              maxAttributes: caps.maxAttributes,
              maxVertexUniforms: caps.maxVertexUniforms,
              maxVaryings: caps.maxVaryings,
              maxFragmentUniforms: caps.maxFragmentUniforms,
              vertexTextures: caps.vertexTextures,
              floatFragmentTextures: caps.floatFragmentTextures,
              floatVertexTextures: caps.floatVertexTextures,
              maxSamples: caps.maxSamples,
              maxAnisotropy: caps.getMaxAnisotropy(),
              precision: caps.precision,
            },
            glParams: {
              vendor: gl.getParameter(gl.VENDOR),
              renderer: gl.getParameter(gl.RENDERER),
              version: gl.getParameter(gl.VERSION),
              shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
              maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
              maxViewportDims: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
              supportedExtensions: gl.getSupportedExtensions(),
            }
          },
          renderTargets: {
            targetA: getRenderTargetInfo(comp?.targetA, 'Reality A Target'),
            targetB: getRenderTargetInfo(comp?.targetB, 'Reality B Target'),
            fluidVelocity: {
              read: getRenderTargetInfo(fluid?.velocity?.read, 'Fluid Velocity Read'),
              write: getRenderTargetInfo(fluid?.velocity?.write, 'Fluid Velocity Write'),
            },
            fluidPressure: {
              read: getRenderTargetInfo(fluid?.pressure?.read, 'Fluid Pressure Read'),
              write: getRenderTargetInfo(fluid?.pressure?.write, 'Fluid Pressure Write'),
            },
            fluidDensity: {
              read: getRenderTargetInfo(fluid?.density?.read, 'Fluid Density Read'),
              write: getRenderTargetInfo(fluid?.density?.write, 'Fluid Density Write'),
            },
            fluidDivergence: getRenderTargetInfo(fluid?.divergence, 'Fluid Divergence'),
          },
          shadowConfiguration: {
            keyLightA: {
              castShadow: keyLightA?.castShadow,
              intensity: keyLightA?.intensity,
              color: '#' + keyLightA?.color.getHexString(),
              position: keyLightA?.position.toArray(),
              shadowMapSize: [keyLightA?.shadow?.mapSize.width, keyLightA?.shadow?.mapSize.height],
              bias: keyLightA?.shadow?.bias,
              normalBias: keyLightA?.shadow?.normalBias,
              cameraFrustum: shadowCamA ? {
                left: shadowCamA.left,
                right: shadowCamA.right,
                top: shadowCamA.top,
                bottom: shadowCamA.bottom,
                near: shadowCamA.near,
                far: shadowCamA.far,
              } : null,
            },
            contactShadow: {
              present: !!realA.contactShadow,
              position: realA.contactShadow?.position.toArray(),
              scale: realA.contactShadow?.scale.toArray(),
              opacity: realA.contactShadow?.material?.opacity,
            }
          },
          materials: {
            realityA: {
              name: matA?.name,
              type: matA?.type,
              metalness: matA?.metalness,
              roughness: matA?.roughness,
              clearcoat: matA?.clearcoat,
              clearcoatRoughness: matA?.clearcoatRoughness,
              diffuseMap: getTextureInfo(matA?.map),
              normalMap: getTextureInfo(matA?.normalMap),
              roughnessMap: getTextureInfo(matA?.roughnessMap),
              metalnessMap: getTextureInfo(matA?.metalnessMap),
            },
            realityB: {
              name: matB?.name,
              type: matB?.type,
              metalness: matB?.metalness,
              roughness: matB?.roughness,
              clearcoat: matB?.clearcoat,
              clearcoatRoughness: matB?.clearcoatRoughness,
              diffuseMap: getTextureInfo(matB?.map),
              normalMap: getTextureInfo(matB?.normalMap),
              roughnessMap: getTextureInfo(matB?.roughnessMap),
              metalnessMap: getTextureInfo(matB?.metalnessMap),
            }
          },
          compositor: {
            materialName: comp?.material?.name,
            toneMapped: comp?.material?.toneMapped,
            depthTest: comp?.material?.depthTest,
            depthWrite: comp?.material?.depthWrite,
            config: comp?.getConfig(),
          }
        };
      })()
    `);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2d_technical_audit_data.json'),
      JSON.stringify(auditData, null, 2)
    );
    console.log('    ✓ Extracted and saved comprehensive technical audit data.');

    // [4/5] Performance baseline benchmarks across 4 states
    console.log('[4/5] Measuring Performance Baselines across 4 Rendering Configurations...');

    const measureState = async (modeName, stateConfig, waitMs = 1200) => {
      await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__(${JSON.stringify(stateConfig)})`);
      await sleep(waitMs);
      return await evalInPage(ws, `
        (() => {
          const engine = window.__DUAL_REALITY_ENGINE__;
          const tele = engine?.latestTelemetry;
          const renderer = engine?.renderer;
          return {
            mode: '${modeName}',
            telemetry: tele,
            infoRender: {
              frame: renderer.info.render.frame,
              calls: renderer.info.render.calls,
              triangles: renderer.info.render.triangles,
              points: renderer.info.render.points,
              lines: renderer.info.render.lines,
            },
            infoMemory: {
              geometries: renderer.info.memory.geometries,
              textures: renderer.info.memory.textures,
            }
          };
        })()
      `);
    };

    // State 1: Reality A Active Only
    console.log('    1. Reality A active (mode: reality-a)...');
    const perfState1 = await measureState('Reality A Active', { mode: 'reality-a' });
    await captureShot(ws, 'baseline_01_reality_a.png', 'Baseline: Reality A');

    // State 2: Reality B Active Only
    console.log('    2. Reality B active (mode: reality-b)...');
    const perfState2 = await measureState('Reality B Active', { mode: 'reality-b' });
    await captureShot(ws, 'baseline_02_reality_b.png', 'Baseline: Reality B');

    // State 3: Both Realities + Compositor (Side-by-side or static composite)
    console.log('    3. Both Realities + Compositor Active (mode: composite)...');
    const perfState3 = await measureState('Both Realities & Compositor', { mode: 'composite', mixRatio: 0.5 });
    await captureShot(ws, 'baseline_03_dual_reality_composite.png', 'Baseline: Dual-Reality Composite');

    // State 4: Fluid Simulation & Compositor Active
    console.log('    4. Fluid Simulation & Compositor Active (mode: fluid-composite)...');
    await evalInPage(ws, `
      window.__SET_EXPERIENCE_STATE__({ mode: 'fluid-composite', fluidConfig: { idleEnabled: true } })
    `);
    // Inject some fluid interaction
    for (let step = 0; step < 8; step++) {
      await evalInPage(ws, `
        window.__INJECT_FLUID_SPLAT__(
          ${0.3 + step * 0.05},
          ${0.4 + (step % 3) * 0.1},
          0.02,
          -0.02,
          undefined,
          0.004
        )
      `);
      await sleep(50);
    }
    await sleep(1000);
    const perfState4 = await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        return {
          mode: 'Fluid Simulation & Compositor Active',
          telemetry: engine?.latestTelemetry,
          infoRender: {
            calls: engine.renderer.info.render.calls,
            triangles: engine.renderer.info.render.triangles,
          },
          infoMemory: {
            geometries: engine.renderer.info.memory.geometries,
            textures: engine.renderer.info.memory.textures,
          }
        };
      })()
    `);
    await captureShot(ws, 'baseline_04_fluid_active_composite.png', 'Baseline: Fluid Active Composite');

    // Additional diagnostic captures for quality audit
    console.log('    Capturing Contact Shadow and Split Alignment baseline shots...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'side-by-side', splitPosition: 0.5 })`);
    await sleep(400);
    await captureShot(ws, 'baseline_05_side_by_side_split.png', 'Baseline: Split Alignment');

    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'debug-reveal-mask' })`);
    await sleep(400);
    await captureShot(ws, 'baseline_06_reveal_mask_diagnostic.png', 'Baseline: Reveal Mask Diagnostic');

    const performanceReport = {
      state1_realityA: perfState1,
      state2_realityB: perfState2,
      state3_bothAndCompositor: perfState3,
      state4_fluidAndCompositor: perfState4,
    };

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2d_performance_baseline.json'),
      JSON.stringify(performanceReport, null, 2)
    );
    console.log('    ✓ Performance benchmarks recorded and saved.');

    console.log('[5/5] Audit execution complete!');
    ws.close();
  } catch (err) {
    console.error('Fatal audit error:', err);
  } finally {
    chrome.kill();
  }
}

run();
