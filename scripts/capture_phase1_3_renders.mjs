import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9335;
const USER_DATA = '/tmp/chrome_pbr_1_3';
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

async function setViewerState(ws, { product, strategy, lighting, tier }) {
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        function clickBtn(text) {
          const btns = Array.from(document.querySelectorAll('button.button-group-btn'));
          const target = btns.find(b => b.textContent.trim().toLowerCase().includes(text.toLowerCase()));
          if (target) {
            target.click();
            return true;
          }
          return false;
        }

        if ('${product}' === 'original') clickBtn('Classic Coke');
        if ('${product}' === 'diet') clickBtn('Diet Coke');
        if ('${product}' === 'zero') clickBtn('Zero Sugar');

        if ('${strategy}') {
          const select = document.getElementById('material-select');
          if (select) {
            select.value = '${strategy}';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        if ('${lighting}' === 'studio') clickBtn('Studio Rig');
        if ('${lighting}' === 'neutral') clickBtn('Neutral Soft');
        if ('${lighting}' === 'directional') clickBtn('High Contrast');

        if ('${tier}' === '4k') clickBtn('4K Source');
        if ('${tier}' === '2k') clickBtn('2K Desktop');
        if ('${tier}' === '1k') clickBtn('1K Mobile');
      })()
    `,
  });
  // Allow textures to load over network and Three.js materials to re-render
  await sleep(1200);
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
  console.log(' Coca-Cola Experience — Phase 1.3: Real-Time Multi-Product Capture Pipeline');
  console.log('================================================================================');

  // Start Vite preview server for capture
  console.log('[1/5] Starting Vite preview server on port 4174...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4174'], { stdio: 'ignore' });
  await sleep(1500);

  // Launch headless Chrome
  console.log('[2/5] Launching headless Chrome with WebGL on port ' + PORT + '...');
  const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1600,1000',
    'http://localhost:4174/'
  ], { stdio: 'ignore' });

  try {
    let tab = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        const list = await res.json();
        tab = list.find((t) => t.url.includes('localhost:4174'));
        if (tab) break;
      } catch {}
    }

    if (!tab) throw new Error('Chrome tab not found on port ' + PORT);

    console.log('[3/5] Connected to Chrome tab:', tab.webSocketDebuggerUrl);
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    // Wait for initial model loading
    console.log('[4/5] Awaiting initial GLB load...');
    for (let i = 0; i < 30; i++) {
      await sleep(400);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `document.querySelector('.viewer-loading-overlay') === null`,
        returnByValue: true,
      });
      if (evalRes.result.value === true) break;
    }
    await sleep(600);

    console.log('[5/5] Capturing systematic multi-product, multi-lighting validation series...');

    // 1. Studio Lighting Series (Config A Baseline across 3 products)
    await setViewerState(ws, { product: 'original', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k' });
    await captureShot(ws, 'p1_3_classic_studio.png', 'Classic Coke (Studio Lighting)');

    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k' });
    await captureShot(ws, 'p1_3_diet_studio.png', 'Diet Coke (Studio Lighting)');

    await setViewerState(ws, { product: 'zero', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k' });
    await captureShot(ws, 'p1_3_zero_studio.png', 'Zero Sugar (Studio Lighting)');

    // 2. Neutral Soft Lighting Series
    await setViewerState(ws, { product: 'original', strategy: 'config-a-baseline', lighting: 'neutral', tier: '2k' });
    await captureShot(ws, 'p1_3_classic_neutral.png', 'Classic Coke (Neutral Lighting)');

    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'neutral', tier: '2k' });
    await captureShot(ws, 'p1_3_diet_neutral.png', 'Diet Coke (Neutral Lighting)');

    await setViewerState(ws, { product: 'zero', strategy: 'config-a-baseline', lighting: 'neutral', tier: '2k' });
    await captureShot(ws, 'p1_3_zero_neutral.png', 'Zero Sugar (Neutral Lighting)');

    // 3. High-Contrast Directional Lighting Series
    await setViewerState(ws, { product: 'original', strategy: 'config-a-baseline', lighting: 'directional', tier: '2k' });
    await captureShot(ws, 'p1_3_classic_directional.png', 'Classic Coke (High-Contrast Lighting)');

    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'directional', tier: '2k' });
    await captureShot(ws, 'p1_3_diet_directional.png', 'Diet Coke (High-Contrast Lighting)');

    await setViewerState(ws, { product: 'zero', strategy: 'config-a-baseline', lighting: 'directional', tier: '2k' });
    await captureShot(ws, 'p1_3_zero_directional.png', 'Zero Sugar (High-Contrast Lighting)');

    // 4. Material Strategy Comparison on Classic Coke
    await setViewerState(ws, { product: 'original', strategy: 'config-a-enhanced', lighting: 'studio', tier: '2k' });
    await captureShot(ws, 'p1_3_strategy_enhanced_pbr.png', 'Classic Coke (Config A Enhanced PBR)');

    await setViewerState(ws, { product: 'original', strategy: 'dual-material-groups', lighting: 'studio', tier: '2k' });
    await captureShot(ws, 'p1_3_strategy_dual_material.png', 'Classic Coke (Dual-Material Segmentation)');

    await setViewerState(ws, { product: 'original', strategy: 'mask-driven-pbr', lighting: 'studio', tier: '2k' });
    await captureShot(ws, 'p1_3_strategy_mask_driven.png', 'Classic Coke (Mask-Driven PBR)');

    // 5. Texture Tier Comparison (1K Mobile)
    await setViewerState(ws, { product: 'original', strategy: 'config-a-baseline', lighting: 'studio', tier: '1k' });
    await captureShot(ws, 'p1_3_tier_1k_mobile.png', 'Classic Coke (1K Mobile Textures)');

    ws.close();
    console.log('\n✨ Multi-product validation capture complete!');
  } finally {
    chrome.kill();
    server.kill();
  }
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
