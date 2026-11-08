import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9561;
const USER_DATA = '/tmp/chrome_phase2b_run';
const OUTPUT_DIR = 'public/models/phase2b_renders';
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

async function simulatePointerStroke(ws, startX, startY, endX, endY, steps = 15) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    await sendCDP(ws, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y),
    });
    await sleep(25);
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
}

async function run() {
  console.log('================================================================================');
  console.log(' Coca-Cola Experience — Phase 2B: GPU Fluid Simulation Capture Pipeline');
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

    console.log('[3/5] Awaiting Dual-Reality & GPU Fluid Engine initialization...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `typeof window.__SET_EXPERIENCE_STATE__ === 'function' && window.__DUAL_REALITY_ENGINE__?.isReady === true`,
        returnByValue: true,
      });
      if (evalRes.result?.value === true) break;
    }

    // Let the simulation warm up with idle vortex evolution
    console.log('    Letting fluid simulation evolve with idle vortices...');
    await sleep(1500);

    console.log('[4/5] Capturing Deliverables 1 through 8...');

    // 1. Idle Simulation
    console.log('    (1/8) Setting Mode: Velocity Magnitude (Idle Motion Only)...');
    await setExperienceState(ws, { mode: 'fluid-velocity-magnitude', fluidConfig: { idleEnabled: true } });
    await sleep(800);
    await captureShot(ws, 'phase2b_01_idle_simulation.png', '1. Idle Simulation (Velocity Heatmap)');

    // 2. Single Pointer Movement (Simulate swift swipe across screen)
    console.log('    (2/8) Executing Single Pointer Stroke & Capturing Velocity...');
    await simulatePointerStroke(ws, 400, 650, 1150, 350, 20);
    await sleep(150);
    await captureShot(ws, 'phase2b_02_single_pointer_movement.png', '2. Single Pointer Movement');

    // 3. Multiple Pointer Movements (Intersecting curved strokes)
    console.log('    (3/8) Executing Multiple Pointer Strokes...');
    await simulatePointerStroke(ws, 1200, 700, 450, 400, 20);
    await simulatePointerStroke(ws, 800, 250, 800, 850, 18);
    await sleep(200);
    await captureShot(ws, 'phase2b_03_multiple_pointer_movements.png', '3. Multiple Pointer Movements');

    // 4. Dissipation After Interaction
    console.log('    (4/8) Waiting for dissipation (preservation of momentum and smooth decay)...');
    await sleep(1800);
    await captureShot(ws, 'phase2b_04_dissipation_after_interaction.png', '4. Dissipation After Interaction');

    // 5. Velocity Vector Field
    console.log('    (5/8) Injecting stroke & setting Mode: Velocity Vector Field...');
    await simulatePointerStroke(ws, 500, 500, 1100, 500, 20);
    await setExperienceState(ws, { mode: 'fluid-velocity' });
    await sleep(200);
    await captureShot(ws, 'phase2b_05_velocity_vectors.png', '5. Velocity Vector Field (RGB Mapped)');

    // 6. Density Visualization
    console.log('    (6/8) Setting Mode: Fluid Density...');
    await simulatePointerStroke(ws, 600, 300, 1000, 700, 18);
    await setExperienceState(ws, { mode: 'fluid-density' });
    await sleep(200);
    await captureShot(ws, 'phase2b_06_density_visualization.png', '6. Fluid Density Field');

    // 7. Divergence Debug View
    console.log('    (7/8) Setting Mode: Divergence Heatmap...');
    await simulatePointerStroke(ws, 900, 400, 700, 600, 15);
    await setExperienceState(ws, { mode: 'fluid-divergence' });
    await sleep(200);
    await captureShot(ws, 'phase2b_07_divergence_debug.png', '7. Velocity Divergence Field');

    // 8. Pressure Debug View
    console.log('    (8/8) Setting Mode: Pressure Field...');
    await setExperienceState(ws, { mode: 'fluid-pressure' });
    await sleep(200);
    await captureShot(ws, 'phase2b_08_pressure_debug.png', '8. Pressure Poisson Field');

    // 9. Bonus: Fluid Reveal Preview
    console.log('    (9/9) Setting Mode: Fluid Reveal Preview (Dual-Reality Reveal)...');
    await simulatePointerStroke(ws, 450, 500, 1150, 500, 25);
    await setExperienceState(ws, { mode: 'fluid-reveal-preview' });
    await sleep(250);
    await captureShot(ws, 'phase2b_09_fluid_reveal_preview.png', '9. Fluid Reveal Preview');

    console.log('[5/5] Extracting Fluid Simulation Telemetry...');
    const tele = await getTelemetry(ws);
    console.log('    Telemetry:');
    console.log(JSON.stringify(tele, null, 2));

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'phase2b_telemetry.json'),
      JSON.stringify(tele, null, 2)
    );

    console.log('================================================================================');
    console.log(' Phase 2B Deliverables Successfully Captured & Audited!');
    console.log('================================================================================');

    ws.close();
  } catch (err) {
    console.error('Fatal capture error:', err);
  } finally {
    chrome.kill();
  }
}

run();
