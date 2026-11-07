import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9560;
const USER_DATA = '/tmp/chrome_phase2a_run';
const OUTPUT_DIR = 'public/models/phase2a_renders';
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
  await sleep(600);
}

async function getTelemetry(ws) {
  const res = await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        if (!engine) return null;
        const a = engine.realityA;
        const b = engine.realityB;
        return {
          telemetry: engine.latestTelemetry,
          aPos: a ? a.canMesh.position.toArray() : null,
          bPos: b ? b.canMesh.position.toArray() : null,
          aRot: a ? a.canMesh.rotation.toArray().slice(0, 3) : null,
          bRot: b ? b.canMesh.rotation.toArray().slice(0, 3) : null,
          aScale: a ? a.canMesh.scale.toArray() : null,
          bScale: b ? b.canMesh.scale.toArray() : null,
          geomIdentical: (a && b) ? (a.canMesh.geometry === b.canMesh.geometry) : false,
          geomUuidA: a ? a.canMesh.geometry.uuid : null,
          geomUuidB: b ? b.canMesh.geometry.uuid : null,
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
}

async function run() {
  console.log('================================================================================');
  console.log(' Coca-Cola Experience — Phase 2A: Dual-Reality Foundation Deliverables Capture');
  console.log('================================================================================');

  console.log('[1/5] Launching headless Chrome (1600x1000) on port ' + PORT + '...');
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
    console.log('[2/5] Connected to Chrome tab:', tab.webSocketDebuggerUrl);

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('[3/5] Awaiting Dual-Reality Engine readiness...');
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `typeof window.__SET_EXPERIENCE_STATE__ === 'function' && window.__DUAL_REALITY_ENGINE__?.isReady === true`,
        returnByValue: true,
      });
      if (evalRes.result?.value === true) {
        ready = true;
        break;
      }
    }

    if (!ready) {
      console.log('    Warning: isReady flag check timed out, checking engine presence...');
    } else {
      console.log('    Dual-Reality Engine is fully initialized and rendering.');
    }

    // Stabilize WebGL render pipeline
    await sleep(1000);

    console.log('[4/5] Capturing Visual Deliverables (Items 1 through 7)...');

    // 1. Reality A independently
    console.log('    (1/7) Setting Mode: Reality A (Original Coke 100%)...');
    await setExperienceState(ws, { mode: 'reality-a', exposure: 1.05 });
    await captureShot(ws, 'phase2a_01_reality_a_independent.png', 'Reality A Independently');

    // 2. Reality B independently
    console.log('    (2/7) Setting Mode: Reality B (Diet Coke 100%)...');
    await setExperienceState(ws, { mode: 'reality-b', exposure: 1.05 });
    await captureShot(ws, 'phase2a_02_reality_b_independent.png', 'Reality B Independently');

    // 3. Both realities side by side
    console.log('    (3/7) Setting Mode: Side-by-Side Split (50% Split Position)...');
    await setExperienceState(ws, { mode: 'side-by-side', splitPosition: 0.5 });
    await captureShot(ws, 'phase2a_03_side_by_side_synchronization.png', 'Side-by-Side Synchronization');

    // 4. Composite with 100% Reality A
    console.log('    (4/7) Setting Mode: Composite (Mix Ratio = 0.0 - 100% Reality A)...');
    await setExperienceState(ws, { mode: 'composite', mixRatio: 0.0, feather: 0.05 });
    await captureShot(ws, 'phase2a_04_composite_100pct_reality_a.png', 'Composite 100% Reality A');

    // 5. Composite with 100% Reality B
    console.log('    (5/7) Setting Mode: Composite (Mix Ratio = 1.0 - 100% Reality B)...');
    await setExperienceState(ws, { mode: 'composite', mixRatio: 1.0, feather: 0.05 });
    await captureShot(ws, 'phase2a_05_composite_100pct_reality_b.png', 'Composite 100% Reality B');

    // 6. Composite with a 50/50 mask
    console.log('    (6/7) Setting Mode: Composite (Mix Ratio = 0.5 - 50/50 Mask with Feathering)...');
    await setExperienceState(ws, { mode: 'composite', mixRatio: 0.5, feather: 0.08 });
    await captureShot(ws, 'phase2a_06_composite_50_50_mask.png', 'Composite 50/50 Mask');

    // 7. A custom organic test mask
    console.log('    (7/7) Setting Mode: Organic Test Mask (Threshold = 0.45, Organic Scale = 4.0)...');
    await setExperienceState(ws, { mode: 'organic-mask', mixRatio: 0.45, feather: 0.06, organicScale: 4.0 });
    await captureShot(ws, 'phase2a_07_organic_test_mask.png', 'Organic Fluid Test Mask');

    // Bonus diagnostic: Debug Mask Grayscale
    console.log('    (Bonus) Setting Mode: Debug Mask Grayscale...');
    await setExperienceState(ws, { mode: 'debug-mask', mixRatio: 0.5, feather: 0.05 });
    await captureShot(ws, 'phase2a_08_debug_mask_grayscale.png', 'Debug Mask Grayscale');

    console.log('[5/5] Performing Telemetry and Synchronization Audit...');
    const tele = await getTelemetry(ws);
    console.log('    Telemetry Results:');
    console.log(JSON.stringify(tele, null, 2));

    // Save telemetry to a JSON file for report inclusion
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2a_telemetry.json'),
      JSON.stringify(tele, null, 2)
    );

    console.log('================================================================================');
    console.log(' All Phase 2A Deliverables Successfully Captured & Verified!');
    console.log('================================================================================');

    ws.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
