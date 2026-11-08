import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9630;
const USER_DATA = '/tmp/chrome_phase2e_rev2_run_2';
const OUTPUT_DIR = 'dev_renders/phase2e_rev2_renders';
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
    awaitPromise: true,
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
      engine.renderer.shadowMap.needsUpdate = true;
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
      engine.renderer.shadowMap.needsUpdate = true;
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

async function profileMode(ws, modeName, setupExpr, simulateInteraction = false) {
  console.log(`   * Profiling mode: ${modeName}...`);
  await evalInPage(ws, setupExpr);
  await sleep(400);

  const metrics = await evalInPage(ws, `
    new Promise((resolve) => {
      const engine = window.__DUAL_REALITY_ENGINE__;
      const deltas = [];
      let count = 0;
      const targetFrames = 40;
      let prevTime = performance.now();

      function stepFrame(now) {
        const d = now - prevTime;
        prevTime = now;
        if (count > 0) deltas.push(d);
        count++;

        if (${simulateInteraction} && window.__INJECT_FLUID_SPLAT__) {
          const t = now * 0.003;
          const x = 0.35 + Math.sin(t) * 0.25;
          const y = 0.50 + Math.cos(t) * 0.20;
          window.__INJECT_FLUID_SPLAT__(x, y, 0.015, -0.01);
        }

        if (count < targetFrames) {
          requestAnimationFrame(stepFrame);
        } else {
          const avgD = deltas.reduce((a, b) => a + b, 0) / deltas.length;
          const sorted = [...deltas].sort((a, b) => a - b);
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const maxD = sorted[sorted.length - 1];
          const fps = 1000 / Math.max(avgD, 0.001);

          resolve({
            mode: "${modeName}",
            fps: Math.round(fps * 10) / 10,
            avgFrameTimeMs: Math.round(avgD * 100) / 100,
            p95FrameTimeMs: Math.round(p95 * 100) / 100,
            maxFrameTimeMs: Math.round(maxD * 100) / 100,
            drawCallsTotal: engine.latestTelemetry?.drawCallsTotal || 0,
            drawCallsA: engine.latestTelemetry?.drawCallsA || 0,
            drawCallsB: engine.latestTelemetry?.drawCallsB || 0,
            drawCallsCompositor: engine.latestTelemetry?.drawCallsCompositor || 0,
            trianglesTotal: engine.latestTelemetry?.trianglesTotal || 0,
            vramEstMb: engine.latestTelemetry?.estimatedVramMb || 0,
            resolution: engine.latestTelemetry?.renderTargetResolution || '1600x1000',
          });
        }
      }
      requestAnimationFrame(stepFrame);
    })
  `);
  return metrics;
}

async function run() {
  console.log('================================================================================');
  console.log(' Coca-Cola Experience — Phase 2E Revision 2: Environment Refinement & Profiling');
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
    console.log('[1/4] Connected to Chrome tab:', tab.webSocketDebuggerUrl);

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('[2/4] Awaiting Dual-Reality Engine initialization with Refined Environments...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const ready = await evalInPage(ws, `window.__DUAL_REALITY_ENGINE__?.isReady === true`);
      if (ready) break;
    }

    // Stabilize and run 20 initial frames
    await evalInPage(ws, `
      new Promise((resolve) => {
        let n = 0;
        function s() {
          n++;
          if (n >= 20) resolve(true);
          else requestAnimationFrame(s);
        }
        requestAnimationFrame(s);
      })
    `);

    console.log('[3/4] Capturing All 8 Required Visual Deliverables...');

    // -------------------------------------------------------------------------
    // Deliverable 1: Original Environment Without The Can
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 1: Original environment without the can');
    await resetCamera(ws);
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'reality-a', autoRotate: false });
        engine.realityA.canMesh.visible = false;
        engine.realityA.contactShadow.visible = false;
        engine.realityA.causticGlow.visible = false;
      })()
    `);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_01_original_environment_no_can.png', 'Original Environment No Can');

    // Restore can & floor elements
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.realityA.canMesh.visible = true;
        engine.realityA.contactShadow.visible = true;
        engine.realityA.causticGlow.visible = true;
        engine.renderer.shadowMap.needsUpdate = true;
      })()
    `);

    // -------------------------------------------------------------------------
    // Deliverable 2: Diet Coke Environment Without The Can
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 2: Diet Coke environment without the can');
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'reality-b', autoRotate: false });
        engine.realityB.canMesh.visible = false;
        engine.realityB.contactShadow.visible = false;
        engine.realityB.causticGlow.visible = false;
      })()
    `);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_02_diet_environment_no_can.png', 'Diet Coke Environment No Can');

    // Restore can & floor elements
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.realityB.canMesh.visible = true;
        engine.realityB.contactShadow.visible = true;
        engine.realityB.causticGlow.visible = true;
        engine.renderer.shadowMap.needsUpdate = true;
      })()
    `);

    // -------------------------------------------------------------------------
    // Deliverable 3: Original Can Close-Up (Showing Accurate Colour & Branding)
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 3: Original can close-up');
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'reality-a', autoRotate: false });
      })()
    `);
    await setCamera(ws, 0.12, 0.18, 1.35, 0.0, 0.08, 0.0);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_03_original_can_closeup.png', 'Original Can Close-Up');

    // -------------------------------------------------------------------------
    // Deliverable 4: Diet Coke Can Close-Up (Showing Metallic Finish)
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 4: Diet Coke can close-up');
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'reality-b', autoRotate: false });
      })()
    `);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_04_diet_can_closeup.png', 'Diet Coke Can Close-Up');

    // -------------------------------------------------------------------------
    // Deliverable 5: Original Full Scene
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 5: Original full scene');
    await resetCamera(ws);
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'reality-a', autoRotate: false });
        engine.renderer.shadowMap.needsUpdate = true;
      })()
    `);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_05_original_full_scene.png', 'Original Full Scene');

    // -------------------------------------------------------------------------
    // Deliverable 6: Diet Coke Full Scene
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 6: Diet Coke full scene');
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'reality-b', autoRotate: false });
        engine.renderer.shadowMap.needsUpdate = true;
      })()
    `);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_06_diet_full_scene.png', 'Diet Coke Full Scene');

    // -------------------------------------------------------------------------
    // Deliverable 7: 50/50 Dual Reality Composite
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 7: 50/50 composite');
    await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        engine.setConfig({ mode: 'composite-slider', mixRatio: 0.5, autoRotate: false });
        engine.renderer.shadowMap.needsUpdate = true;
      })()
    `);
    await sleep(400);
    await captureShot(ws, 'phase2e_rev2_07_fifty_fifty_composite.png', '50/50 Composite');

    // -------------------------------------------------------------------------
    // Deliverable 8: Active Fluid Reveal
    // -------------------------------------------------------------------------
    console.log('   -> Capturing Deliverable 8: Active fluid reveal');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'fluid-composite', fluidConfig: { idleEnabled: false } })`);
    await sleep(400);
    for (let step = 0; step < 22; step++) {
      const t = step / 21;
      const x = 0.22 + 0.58 * t;
      const y = 0.68 - 0.35 * t;
      await evalInPage(ws, `window.__INJECT_FLUID_SPLAT__(${x}, ${y}, 0.02, -0.015, undefined, 0.0035)`);
      await sleep(35);
    }
    await sleep(200);
    await captureShot(ws, 'phase2e_rev2_08_active_fluid_reveal.png', 'Active Fluid Reveal');

    // -------------------------------------------------------------------------
    // Step 4: Full Multi-Mode Profiling
    // -------------------------------------------------------------------------
    console.log('[4/4] Conducting Comprehensive Profiling across all 4 Modes...');

    const profRealityA = await profileMode(
      ws,
      'Reality A (100% Original Coke)',
      `window.__DUAL_REALITY_ENGINE__.setConfig({ mode: 'reality-a', autoRotate: false });`
    );

    const profRealityB = await profileMode(
      ws,
      'Reality B (100% Diet Coke)',
      `window.__DUAL_REALITY_ENGINE__.setConfig({ mode: 'reality-b', autoRotate: false });`
    );

    const profComposite = await profileMode(
      ws,
      '50/50 Dual Reality Composite',
      `window.__DUAL_REALITY_ENGINE__.setConfig({ mode: 'composite-slider', mixRatio: 0.5, autoRotate: false });`
    );

    const profFluid = await profileMode(
      ws,
      'Active Fluid Reveal',
      `window.__DUAL_REALITY_ENGINE__.setConfig({ mode: 'fluid-transition', autoRotate: false });`,
      true
    );

    const profileData = [profRealityA, profRealityB, profComposite, profFluid];
    console.log('\n--- PERFORMANCE TELEMETRY TABLE ---');
    console.table(profileData);

    const telePath = path.join(OUTPUT_DIR, 'phase2e_rev2_telemetry.json');
    fs.writeFileSync(telePath, JSON.stringify(profileData, null, 2));
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'phase2e_rev2_telemetry.json'), JSON.stringify(profileData, null, 2));
    }

    console.log('\nDeliverable capture and profiling completed successfully.');

    ws.close();
    chrome.kill();
  } catch (err) {
    console.error('Error during capture/profiling:', err);
    chrome.kill();
    process.exit(1);
  }
}

run();
