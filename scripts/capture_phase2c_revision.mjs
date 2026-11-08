import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9568;
const USER_DATA = '/tmp/chrome_phase2c_rev_run';
const OUTPUT_DIR = 'public/models/phase2c_revision_renders';
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
  await sleep(400);
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
  console.log(' Coca-Cola Experience — Phase 2C Revision: Clean Fluid-Driven Composite Capture');
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

    console.log('[3/6] Awaiting Dual-Reality & Revised Compositor Engine initialization...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `typeof window.__SET_EXPERIENCE_STATE__ === 'function' && window.__DUAL_REALITY_ENGINE__?.isReady === true`,
        returnByValue: true,
      });
      if (evalRes.result?.value === true) break;
    }

    await sleep(1500);

    console.log('[4/6] Capturing Visual Deliverables (Items 1 through 7)...');

    // 1. Phase 2B baseline fluid interaction
    console.log('    (1/7) Item 1: Phase 2B Baseline Fluid Interaction (Density Field Diagnostic)...');
    await setExperienceState(ws, { mode: 'fluid-density', fluidConfig: { idleEnabled: false } });
    await sleep(500);
    await simulatePointerStroke(ws, 400, 600, 1200, 400, 22);
    await sleep(120);
    await captureShot(ws, 'phase2c_rev_01_phase2b_baseline.png', '1. Phase 2B Baseline Fluid Interaction');

    // 2. Revised Phase 2C single stroke (Zero Refraction, Clean Density Reveal)
    console.log('    (2/7) Item 2: Revised Phase 2C Single Stroke (Zero Refraction, Spatially Locked)...');
    await setExperienceState(ws, {
      mode: 'fluid-composite',
      fluidConfig: { idleEnabled: false },
      compositorConfig: {
        densityThreshold: 0.16,
        densityFeather: 0.22,
        chromaticAberration: 0.008,
        boundaryNoiseStrength: 0.02,
      }
    });
    await sleep(2500); // Wait for previous fluid to dissipate
    await simulatePointerStroke(ws, 420, 620, 1180, 380, 22);
    await sleep(150);
    await captureShot(ws, 'phase2c_rev_02_single_stroke.png', '2. Revised Phase 2C Single Stroke');

    // 3. Revised Phase 2C multiple intersecting strokes
    console.log('    (3/7) Item 3: Revised Phase 2C Multiple Intersecting Strokes...');
    await simulatePointerStroke(ws, 1150, 650, 450, 380, 20);
    await simulatePointerStroke(ws, 800, 250, 800, 780, 18);
    await sleep(180);
    await captureShot(ws, 'phase2c_rev_03_multiple_strokes.png', '3. Revised Phase 2C Multiple Strokes');

    // 4. Revised Phase 2C wide organic reveal
    console.log('    (4/7) Item 4: Revised Phase 2C Wide Organic Reveal...');
    await simulatePointerStroke(ws, 520, 480, 1080, 480, 24);
    await simulatePointerStroke(ws, 620, 360, 980, 640, 20);
    await sleep(180);
    await captureShot(ws, 'phase2c_rev_04_wide_reveal.png', '4. Revised Phase 2C Wide Reveal');

    // 5. Revised Phase 2C dissipation return
    console.log('    (5/7) Item 5: Revised Phase 2C Dissipation Return (Waiting 2.4s for Viscous Decay)...');
    await sleep(2400);
    await captureShot(ws, 'phase2c_rev_05_dissipation_return.png', '5. Revised Phase 2C Dissipation Return');

    // 6. Revised Phase 2C subtle chromatic aberration
    console.log('    (6/7) Item 6: Revised Phase 2C Subtle Chromatic Aberration (Meniscus Fringe)...');
    await setExperienceState(ws, {
      compositorConfig: {
        chromaticAberration: 0.015,
        boundaryNoiseStrength: 0.02,
      }
    });
    await simulatePointerStroke(ws, 500, 450, 1100, 550, 20);
    await sleep(100);
    await captureShot(ws, 'phase2c_rev_06_subtle_chromatic.png', '6. Revised Phase 2C Subtle Chromatic Aberration');

    // 7. Reality A and Reality B alignment
    console.log('    (7/7) Item 7: Reality A and Reality B 1:1 Geometric & Photometric Alignment Lock...');
    await setExperienceState(ws, { mode: 'split-screen', splitPosition: 0.5 });
    await sleep(600);
    await captureShot(ws, 'phase2c_rev_07_alignment_lock.png', '7. Reality A / B Split Alignment Lock');

    // Motion Capture: Record 14 frames during a swipe and dissipation
    console.log('[5/6] Recording Motion Demonstration (14 temporal frames)...');
    await setExperienceState(ws, {
      mode: 'fluid-composite',
      fluidConfig: { idleEnabled: false },
      compositorConfig: {
        chromaticAberration: 0.008,
        boundaryNoiseStrength: 0.02,
      }
    });
    await sleep(2400); // dissipate completely

    const motionFramesDir = path.join(OUTPUT_DIR, 'motion_frames');
    fs.mkdirSync(motionFramesDir, { recursive: true });

    // Begin swipe across can
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
      path.join(OUTPUT_DIR, 'phase2c_rev_telemetry.json'),
      JSON.stringify(tele, null, 2)
    );

    console.log('================================================================================');
    console.log(' Phase 2C Revision Visuals Successfully Captured!');
    console.log('================================================================================');

    ws.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
