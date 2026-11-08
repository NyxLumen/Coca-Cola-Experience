import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9595;
const USER_DATA = '/tmp/chrome_phase2e_run';
const OUTPUT_DIR = 'dev_renders/phase2e_renders';
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
  console.log(' Coca-Cola Experience — Phase 2E: Art Direction Visual Deliverables Capture');
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

    console.log('[2/5] Awaiting Dual-Reality Engine initialization with Phase 2E Art Direction...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const ready = await evalInPage(ws, `window.__DUAL_REALITY_ENGINE__?.isReady === true`);
      if (ready) break;
    }
    await sleep(1500);

    console.log('[3/5] Capturing Visual Deliverables (Items 1 through 10 Desktop + Mobile)...');

    // 1. Coca-Cola Original Full Scene
    console.log('    (1/12) Coca-Cola Original Full Scene (Cinematic Crimson Vignette & Warm Rig)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await resetCamera(ws);
    await captureShot(ws, 'phase2e_01_original_full_scene.png', '1. Original Full Scene');

    // 2. Diet Coke Full Scene
    console.log('    (2/12) Diet Coke Full Scene (Minimal Sophisticated Graphite Studio & Cool Rig)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await resetCamera(ws);
    await captureShot(ws, 'phase2e_02_diet_coke_full_scene.png', '2. Diet Coke Full Scene');

    // 3. Original Can Close-Up
    console.log('    (3/12) Original Can Close-Up (Preserved Config A PBR & Spencerian Script)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await setCamera(ws, 0.0, 0.0, 1.4, 0.0, 0.0, 0.0);
    await captureShot(ws, 'phase2e_03_original_can_closeup.png', '3. Original Can Close-Up');

    // 4. Diet Coke Can Close-Up
    console.log('    (4/12) Diet Coke Can Close-Up (Brushed Aluminum & Pure Red/Black Typography)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await setCamera(ws, 0.0, 0.0, 1.4, 0.0, 0.0, 0.0);
    await captureShot(ws, 'phase2e_04_diet_can_closeup.png', '4. Diet Coke Can Close-Up');

    // 5. Original Metallic Reflection Detail
    console.log('    (5/12) Original Metallic Reflection Detail (Warm Ivory Softbox Streak & Red Rim)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await setCamera(ws, 0.9, 0.2, 1.2, 0.1, 0.1, 0.0);
    await captureShot(ws, 'phase2e_05_original_reflection_detail.png', '5. Original Reflection Detail');

    // 6. Diet Coke Metallic Reflection Detail
    console.log('    (6/12) Diet Coke Metallic Reflection Detail (Razor-Sharp Aluminum Vertical Highlight)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await setCamera(ws, 0.9, 0.2, 1.2, 0.1, 0.1, 0.0);
    await captureShot(ws, 'phase2e_06_diet_reflection_detail.png', '6. Diet Reflection Detail');

    // 7. Original Shadow/Contact Region
    console.log('    (7/12) Original Shadow Contact Region (Multi-Lobe Crimson AO & Tight Penumbra)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await setCamera(ws, 0.35, -0.65, 1.5, 0.0, -0.65, 0.0);
    await captureShot(ws, 'phase2e_07_original_contact_region.png', '7. Original Contact Region');

    // 8. Diet Coke Shadow/Contact Region
    console.log('    (8/12) Diet Coke Shadow Contact Region (Multi-Lobe Graphite AO & Matching Grounding)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await setCamera(ws, 0.35, -0.65, 1.5, 0.0, -0.65, 0.0);
    await captureShot(ws, 'phase2e_08_diet_contact_region.png', '8. Diet Contact Region');

    // 9. 50/50 Composite
    console.log('    (9/12) 50/50 Dual-Reality Composite (Seamless Background & Product Alignment)...');
    await resetCamera(ws);
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'composite', mixRatio: 0.5, feather: 0.05 })`);
    await sleep(400);
    await captureShot(ws, 'phase2e_09_fifty_fifty_composite.png', '9. 50/50 Composite');

    // 10. Fluid Reveal Transition
    console.log('    (10/12) Fluid Reveal Transition (Active Organic Navier-Stokes Reveal)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'fluid-composite', fluidConfig: { idleEnabled: false } })`);
    await sleep(400);
    for (let step = 0; step < 18; step++) {
      const t = step / 17;
      const x = 0.22 + 0.58 * t;
      const y = 0.68 - 0.35 * t;
      await evalInPage(ws, `window.__INJECT_FLUID_SPLAT__(${x}, ${y}, 0.02, -0.015, undefined, 0.0035)`);
      await sleep(35);
    }
    await sleep(200);
    await captureShot(ws, 'phase2e_10_fluid_reveal_transition.png', '10. Fluid Reveal Transition');

    // 11. Mobile Viewport Validation (Portrait 800 x 1200)
    console.log('    (11/12) Mobile Aspect Ratio: Reality A (800x1200)...');
    await sendCDP(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await sleep(600);
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-a' })`);
    await resetCamera(ws);
    await captureShot(ws, 'phase2e_11_mobile_reality_a.png', '11. Mobile Reality A (800x1200)');

    console.log('    (12/12) Mobile Aspect Ratio: Reality B (800x1200)...');
    await evalInPage(ws, `window.__SET_EXPERIENCE_STATE__({ mode: 'reality-b' })`);
    await resetCamera(ws);
    await captureShot(ws, 'phase2e_12_mobile_reality_b.png', '12. Mobile Reality B (800x1200)');

    // Reset emulation
    await sendCDP(ws, 'Emulation.clearDeviceMetricsOverride');
    await sleep(400);

    console.log('[4/5] Extracting Phase 2E Performance Telemetry...');
    const tele = await evalInPage(ws, `
      (() => {
        const engine = window.__DUAL_REALITY_ENGINE__;
        return {
          telemetry: engine?.latestTelemetry,
          targetSamples: engine?.compositor?.targetA?.samples,
          targetColorSpace: engine?.compositor?.targetA?.texture?.colorSpace,
          anisotropy: engine?.realityA?.material?.map?.anisotropy,
          drawCalls: engine?.renderer?.info?.render?.calls,
          triangles: engine?.renderer?.info?.render?.triangles,
        };
      })()
    `);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2e_telemetry.json'),
      JSON.stringify(tele, null, 2)
    );
    console.log('    Telemetry:');
    console.log(JSON.stringify(tele, null, 2));

    console.log('[5/5] Visual deliverables successfully captured!');
    ws.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
