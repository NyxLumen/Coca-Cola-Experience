import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9585;
const USER_DATA = '/tmp/chrome_phase2d_task2';
const OUTPUT_DIR = 'public/models/phase2d_renders';
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

async function setCamera(ws, px, py, pz, tx = 0, ty = 0, tz = 0) {
  await evalInPage(ws, `
    (() => {
      const engine = window.__DUAL_REALITY_ENGINE__;
      if (!engine) return;
      engine.camera.position.set(${px}, ${py}, ${pz});
      engine.controls.target.set(${tx}, ${ty}, ${tz});
      engine.camera.lookAt(${tx}, ${ty}, ${tz});
      engine.controls.update();
    })()
  `);
  await sleep(400);
}

async function resetCamera(ws) {
  await evalInPage(ws, `
    (() => {
      const engine = window.__DUAL_REALITY_ENGINE__;
      if (!engine) return;
      engine.resetCamera();
    })()
  `);
  await sleep(400);
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
  console.log(' Coca-Cola Experience — Phase 2D Task 2: Rendering Quality Visual Deliverables');
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

    console.log('[2/5] Awaiting Dual-Reality Engine initialization with MSAA & Aniso...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const ready = await evalInPage(ws, `window.__DUAL_REALITY_ENGINE__?.isReady === true`);
      if (ready) break;
    }
    await sleep(1500);

    console.log('[3/5] Capturing Visual Deliverables (Items 1 through 9)...');

    // 1. Full Reality A render (Standard Camera)
    console.log('    (1/9) Full Reality A Render (Hardware 4x MSAA, 16x Aniso, Tight Shadows)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await resetCamera(ws);
    await captureShot(ws, 'phase2d_01_full_reality_a.png', '1. Full Reality A Render');

    // 2. Full Reality B render (Standard Camera)
    console.log('    (2/9) Full Reality B Render (Hardware 4x MSAA, 16x Aniso, Tight Shadows)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await resetCamera(ws);
    await captureShot(ws, 'phase2d_02_full_reality_b.png', '2. Full Reality B Render');

    // 3. Can Silhouette Close-Up (Evaluating 4x MSAA Edge Smoothness)
    console.log('    (3/9) Can Silhouette Close-Up (Sub-pixel Edge Antialiasing)...');
    // Zoom in closely onto the cylindrical silhouette edge
    await setCamera(ws, -0.45, 0.1, 1.4, -0.32, 0.1, 0.0);
    await captureShot(ws, 'phase2d_03_can_silhouette_closeup.png', '3. Can Silhouette Close-Up');

    // 4. Top Rim and Pull Tab Close-Up (Aluminum bevel & rim geometry)
    console.log('    (4/9) Top Rim & Pull Tab Close-Up (Sub-pixel Bevel & Anodized Rim)...');
    await setCamera(ws, 0.0, 1.15, 1.15, 0.0, 0.58, 0.0);
    await captureShot(ws, 'phase2d_04_top_rim_closeup.png', '4. Top Rim & Pull Tab Close-Up');

    // 5. Coca-Cola Typography Close-Up (16x Anisotropic Script Sharpness)
    console.log('    (5/9) Coca-Cola Typography Close-Up (16x Anisotropic Sharpness)...');
    await setCamera(ws, 0.0, 0.0, 1.35, 0.0, 0.0, 0.0);
    await captureShot(ws, 'phase2d_05_typography_closeup.png', '5. Coca-Cola Typography Close-Up');

    // 6. Curved Flank Texture Detail (Oblique grazing angle)
    console.log('    (6/9) Curved Flank Texture Detail (Steep Grazing Angle)...');
    await setCamera(ws, 1.1, 0.05, 1.0, 0.15, 0.0, 0.0);
    await captureShot(ws, 'phase2d_06_curved_flank_detail.png', '6. Curved Flank Texture Detail');

    // 7. Shadow Contact Region (Tightened shadow camera frustum)
    console.log('    (7/9) Shadow Contact Region (Tightened Frustum & Ground Anchor)...');
    await setCamera(ws, 0.35, -0.65, 1.5, 0.0, -0.65, 0.0);
    await captureShot(ws, 'phase2d_07_shadow_contact_region.png', '7. Shadow Contact Region');

    // 8. 50/50 Composite (Linear-Space Dual-Reality Blending)
    console.log('    (8/9) 50/50 Static Composite (Linear-Space Photometric Blend)...');
    await resetCamera(ws);
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'composite', mixRatio: 0.5, feather: 0.08 })`);
    await sleep(400);
    await captureShot(ws, 'phase2d_08_fifty_fifty_composite.png', '8. 50/50 Static Composite');

    // 9. Fluid-Driven Composite (Navier-Stokes Dynamic Reveal with MSAA Targets)
    console.log('    (9/9) Fluid-Driven Composite (Active Pointer Interaction with MSAA)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'fluid-composite', fluidConfig: { idleEnabled: false } })`);
    await sleep(400);
    // Inject clean fluid stroke across the can
    for (let step = 0; step < 16; step++) {
      const t = step / 15;
      const x = 0.25 + 0.55 * t;
      const y = 0.65 - 0.3 * t;
      await evalInPage(ws, `window.__INJECT_FLUID_SPLAT__(${x}, ${y}, 0.02, -0.015, undefined, 0.0035)`);
      await sleep(35);
    }
    await sleep(200);
    await captureShot(ws, 'phase2d_09_fluid_composite.png', '9. Fluid-Driven Composite');

    console.log('[4/5] Measuring Post-Implementation Telemetry & Draw-Call Reductions...');

    // Test draw calls in Reality A mode (Verifying Conditional Scene Rendering)
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await sleep(600);
    const callsRealityA = await evalInPage(ws, `window.__DUAL_REALITY_ENGINE__?.renderer.info.render.calls`);

    // Test draw calls in Reality B mode
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await sleep(600);
    const callsRealityB = await evalInPage(ws, `window.__DUAL_REALITY_ENGINE__?.renderer.info.render.calls`);

    // Test draw calls in Fluid Composite mode
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'fluid-composite' })`);
    await sleep(600);
    const teleData = await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        return {
          telemetry: engine?.latestTelemetry,
          targetSamples: engine?.compositor?.targetA?.samples,
          targetColorSpace: engine?.compositor?.targetA?.texture?.colorSpace,
          anisotropy: engine?.realityA?.material?.map?.anisotropy,
          shadowNormalBias: engine?.realityA?.keyLight?.shadow?.normalBias,
          shadowFrustum: {
            left: engine?.realityA?.keyLight?.shadow?.camera?.left,
            right: engine?.realityA?.keyLight?.shadow?.camera?.right,
            top: engine?.realityA?.keyLight?.shadow?.camera?.top,
            bottom: engine?.realityA?.keyLight?.shadow?.camera?.bottom,
          },
          infoRender: {
            calls: engine?.renderer.info.render.calls,
            triangles: engine?.renderer.info.render.triangles,
          }
        };
      })()
    `);

    const performanceSummary = {
      drawCalls_realityA_optimized: callsRealityA,
      drawCalls_realityB_optimized: callsRealityB,
      drawCalls_dualComposite: teleData.infoRender.calls,
      teleData,
    };

    console.log('    Performance Summary:');
    console.log(JSON.stringify(performanceSummary, null, 2));

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2d_post_implementation_telemetry.json'),
      JSON.stringify(performanceSummary, null, 2)
    );

    console.log('[5/5] Visual deliverables successfully captured!');
    ws.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
