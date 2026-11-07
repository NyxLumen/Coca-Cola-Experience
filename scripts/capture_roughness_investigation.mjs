import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9559;
const USER_DATA = '/tmp/chrome_roughness_run';
const OUTPUT_DIR = 'public/models/phase1_3_renders';
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

async function setViewerState(ws, opts) {
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        if (typeof window.__SET_VIEWER_STATE__ === 'function') {
          window.__SET_VIEWER_STATE__(${JSON.stringify(opts)});
          return true;
        }
        return false;
      })()
    `,
    returnByValue: true,
  });
  await sleep(700);
}

async function captureShot(ws, filename, label) {
  const shot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(shot.data, 'base64');
  const outPath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(outPath, buffer);
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
  }
  console.log(`      Saved [${label}] -> ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
}

async function run() {
  console.log('================================================================================');
  console.log(' Coca-Cola Experience — Phase 1.3: Roughness Debug & Beauty Capture Pipeline');
  console.log('================================================================================');

  console.log('[1/4] Launching headless Chrome (1600x1000) on port ' + PORT + '...');
  const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1600,1000',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    'http://localhost:5173/'
  ], { stdio: 'ignore' });

  try {
    let tab = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        const list = await res.json();
        tab = list.find((t) => t.url.includes('localhost:5173'));
        if (tab) break;
      } catch {}
    }

    if (!tab) throw new Error('Chrome tab not found on port ' + PORT);
    console.log('[2/4] Connected to Chrome tab:', tab.webSocketDebuggerUrl);

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('[3/4] Awaiting initial GLB load...');
    for (let i = 0; i < 40; i++) {
      await sleep(400);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `typeof window.__SET_VIEWER_STATE__ === 'function' && document.querySelector('.viewer-loading-overlay') === null`,
        returnByValue: true,
      });
      if (evalRes && evalRes.result && evalRes.result.value === true) {
        console.log(`      Viewer ready (iteration ${i})`);
        break;
      }
    }

    console.log('\n[4/4] Executing Captures Across Products, Views, and Material States...');

    // 1. Roughness Debug Channel Captures (toneMapped=false, linear)
    console.log('\n--- 1. Roughness Debug Channel (toneMapped=false) ---');
    const products = [
      { id: 'diet', label: 'Diet Coke' },
      { id: 'original', label: 'Classic Coke' },
      { id: 'zero', label: 'Zero Sugar' },
    ];

    for (const prod of products) {
      // Front View
      await setViewerState(ws, { product: prod.id, strategy: 'debug-roughness', lighting: 'studio', tier: '2k', cameraView: 'front' });
      await captureShot(ws, `debug_roughness_${prod.id}_front.png`, `Debug Roughness: ${prod.label} (Front)`);

      // Top Lid View
      await setViewerState(ws, { product: prod.id, strategy: 'debug-roughness', lighting: 'studio', tier: '2k', cameraView: 'top' });
      await captureShot(ws, `debug_roughness_${prod.id}_top.png`, `Debug Roughness: ${prod.label} (Top Lid)`);
    }

    // 2. Final Beauty Renders under Studio & Neutral Lighting (Config A Dual-Material)
    console.log('\n--- 2. Final Beauty Renders (Studio & Neutral Lighting) ---');
    for (const prod of products) {
      // Studio Lighting
      await setViewerState(ws, { product: prod.id, strategy: 'dual-material-groups', lighting: 'studio', tier: '2k', cameraView: 'front' });
      await captureShot(ws, `final_beauty_${prod.id}_studio.png`, `Final Beauty: ${prod.label} (Studio)`);

      // Neutral Lighting
      await setViewerState(ws, { product: prod.id, strategy: 'dual-material-groups', lighting: 'neutral', tier: '2k', cameraView: 'front' });
      await captureShot(ws, `final_beauty_${prod.id}_neutral.png`, `Final Beauty: ${prod.label} (Neutral)`);
    }

    ws.close();
    console.log('\n✨ All roughness debug and beauty captures completed successfully!');
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
