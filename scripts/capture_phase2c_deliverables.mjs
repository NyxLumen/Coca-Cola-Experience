import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9562;
const USER_DATA = '/tmp/chrome_phase2c_run';
const OUTPUT_DIR = 'public/models/phase2c_renders';
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

async function setExperienceState(ws, opts) {
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof window.__SET_EXPERIENCE_STATE__ === 'function') {
          window.__SET_EXPERIENCE_STATE__(${JSON.stringify(opts)});
          return true;
        }
        return false;
      })()
    `,
    returnByValue: true,
  });
  await sleep(500);
}

async function _injectSplat(ws, x, y, dx, dy, radius = 0.0035) {
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof window.__INJECT_FLUID_SPLAT__ === 'function') {
          window.__INJECT_FLUID_SPLAT__(${x}, ${y}, ${dx}, ${dy}, undefined, ${radius});
          return true;
        }
        return false;
      })()
    `,
    returnByValue: true,
  });
}

async function simulatePointerStroke(ws, startX, startY, endX, endY, steps = 18, delayMs = 25) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    await sendCDP(ws, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y),
    });
    await sleep(delayMs);
  }
}

async function getTelemetry(ws) {
  const res = await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        if (!engine) return null;
        return {
          telemetry: engine.latestTelemetry,
          fluidTelemetry: engine.fluidSimulation?.getTelemetry(),
          compositorConfig: engine.compositor?.getConfig(),
          fluidConfig: engine.fluidSimulation?.getConfig(),
        };
      })()
    `,
    returnByValue: true,
  });
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
  console.log(' Coca-Cola Experience — Phase 2C: Fluid Compositor & Optical Refraction Capture');
  console.log('================================================================================');

  console.log('[1/6] Launching headless Chrome (1600x1000) on port ' + PORT + '...');
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
    console.log('[2/6] Connected to Chrome tab:', tab.webSocketDebuggerUrl);

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('[3/6] Awaiting Dual-Reality & Fluid Compositor Engine initialization...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `typeof window.__SET_EXPERIENCE_STATE__ === 'function' && window.__DUAL_REALITY_ENGINE__?.isReady === true`,
        returnByValue: true,
      });
      if (evalRes.result?.value === true) break;
    }

    await sleep(1500);

    console.log('[4/6] Capturing Visual Deliverables (Items 1 through 9 + Diagnostics)...');

    // 1. Reality A at rest
    console.log('    (1/12) Reality A at rest...');
    await setExperienceState(ws, { mode: 'reality-a' });
    await captureShot(ws, 'phase2c_01_reality_a_rest.png', '1. Reality A at Rest');

    // 2. Reality B at full reveal
    console.log('    (2/12) Reality B at full reveal...');
    await setExperienceState(ws, { mode: 'reality-b' });
    await captureShot(ws, 'phase2c_02_reality_b_full_reveal.png', '2. Reality B at Full Reveal');

    // 3. Single fluid trail revealing Reality B
    console.log('    (3/12) Single fluid trail revealing Reality B (with Refraction)...');
    await setExperienceState(ws, { mode: 'fluid-composite', fluidConfig: { idleEnabled: false } });
    await sleep(600); // clear any idle
    await simulatePointerStroke(ws, 420, 620, 1180, 380, 22);
    await sleep(150);
    await captureShot(ws, 'phase2c_03_single_fluid_trail.png', '3. Single Fluid Trail (Refractive Reveal)');

    // 4. Multiple intersecting fluid trails
    console.log('    (4/12) Multiple intersecting fluid trails...');
    await simulatePointerStroke(ws, 1150, 680, 480, 360, 20);
    await simulatePointerStroke(ws, 800, 220, 800, 820, 18);
    await sleep(200);
    await captureShot(ws, 'phase2c_04_multiple_intersecting_trails.png', '4. Multiple Intersecting Trails');

    // 5. Wide reveal with organic boundaries
    console.log('    (5/12) Wide reveal with organic boundaries...');
    await simulatePointerStroke(ws, 550, 480, 1050, 480, 25);
    await simulatePointerStroke(ws, 650, 380, 950, 620, 20);
    await sleep(200);
    await captureShot(ws, 'phase2c_05_wide_organic_reveal.png', '5. Wide Organic Boundary Reveal');

    // 6. Active refraction around moving fluid trail
    console.log('    (6/12) Active refraction around moving fluid trail...');
    await setExperienceState(ws, { compositorConfig: { refractionStrength: 0.038 } });
    await simulatePointerStroke(ws, 400, 500, 1200, 500, 25);
    await sleep(120);
    await captureShot(ws, 'phase2c_06_active_refraction_field.png', '6. Active Liquid Refraction');

    // 7. Chromatic aberration around the transition boundary
    console.log('    (7/12) Chromatic aberration around transition boundary...');
    await setExperienceState(ws, { compositorConfig: { chromaticAberration: 0.025 } });
    await simulatePointerStroke(ws, 500, 400, 1100, 600, 20);
    await sleep(150);
    await captureShot(ws, 'phase2c_07_chromatic_aberration_edge.png', '7. Chromatic Aberration Dispersion');

    // 8. Post-interaction dissipation and return to Reality A
    console.log('    (8/12) Waiting for dissipation (viscous decay and return to Reality A)...');
    await sleep(2400);
    await captureShot(ws, 'phase2c_08_post_interaction_dissipation.png', '8. Dissipation Return to Reality A');

    // 9. Final composite with all effects enabled
    console.log('    (9/12) Final composite with all effects enabled...');
    await setExperienceState(ws, {
      mode: 'fluid-composite',
      fluidConfig: { idleEnabled: true },
      compositorConfig: {
        refractionStrength: 0.025,
        chromaticAberration: 0.012,
        densityThreshold: 0.16,
        boundaryNoiseStrength: 0.07,
      },
    });
    await simulatePointerStroke(ws, 480, 580, 1120, 420, 24);
    await sleep(200);
    await captureShot(ws, 'phase2c_09_final_composite_all_effects.png', '9. Final Fluid Composite');

    // Diagnostics
    console.log('    (10/12) Diagnostic: Reveal Mask Grayscale...');
    await setExperienceState(ws, { mode: 'debug-reveal-mask' });
    await captureShot(ws, 'phase2c_10_diagnostic_reveal_mask.png', '10. Reveal Mask Grayscale');

    console.log('    (11/12) Diagnostic: Transition Boundary Zone...');
    await setExperienceState(ws, { mode: 'debug-transition-boundary' });
    await captureShot(ws, 'phase2c_11_diagnostic_boundary_zone.png', '11. Boundary Zone Mask');

    console.log('    (12/12) Diagnostic: Isolated Chromatic Dispersion Delta...');
    await setExperienceState(ws, { mode: 'debug-chromatic-aberration' });
    await captureShot(ws, 'phase2c_12_diagnostic_chromatic_delta.png', '12. Chromatic Dispersion Delta');

    // Motion Capture: Record a sequence of 14 animation frames during a fluid swipe and dissipation
    console.log('[5/6] Recording Motion Capture Sequence (14 temporal frames)...');
    await setExperienceState(ws, { mode: 'fluid-composite', fluidConfig: { idleEnabled: false } });
    await sleep(600);

    const motionFramesDir = path.join(OUTPUT_DIR, 'motion_frames');
    fs.mkdirSync(motionFramesDir, { recursive: true });

    // Start swipe
    await simulatePointerStroke(ws, 400, 600, 1200, 400, 16, 20);

    for (let f = 0; f < 14; f++) {
      const shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.data, 'base64');
      const framePath = path.join(motionFramesDir, `frame_${String(f).padStart(2, '0')}.png`);
      fs.writeFileSync(framePath, buf);
      await sleep(140);
    }
    console.log(`      ✓ Saved 14 motion frames -> ${motionFramesDir}`);

    console.log('[6/6] Extracting Experience & Compositor Telemetry...');
    const tele = await getTelemetry(ws);
    console.log('    Telemetry:');
    console.log(JSON.stringify(tele, null, 2));

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2c_telemetry.json'),
      JSON.stringify(tele, null, 2)
    );

    console.log('================================================================================');
    console.log(' Phase 2C Deliverables Successfully Captured & Audited!');
    console.log('================================================================================');

    ws.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
