import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9340;
const USER_DATA = '/tmp/chrome_regression_test';
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

async function setViewerState(ws, { product, strategy, lighting, tier, cameraView }) {
  await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (() => {
        function clickBtn(text) {
          const btns = Array.from(document.querySelectorAll('button.button-group-btn'));
          const target = btns.find(b => b.textContent.trim().toLowerCase() === text.toLowerCase());
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

        if ('${cameraView}') {
          if ('${cameraView}' === 'front') clickBtn('Front');
          if ('${cameraView}' === 'side') clickBtn('Side');
          if ('${cameraView}' === 'three-quarter') clickBtn('3/4');
          if ('${cameraView}' === 'top') clickBtn('Top Lid');
          if ('${cameraView}' === 'bottom') clickBtn('Bottom');
        }
      })()
    `,
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
  console.log(' Coca-Cola Experience — Phase 1.3: Material Pipeline Regressions Verification');
  console.log('================================================================================');

  // Start Vite preview server
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

    console.log('[5/5] Executing systematic isolation and regression captures...');

    // 1. Issue 2 Controlled Isolation Stages A through E for Classic Coke
    console.log('\n--- 1. Issue 2 Isolation Stages (Classic Coke) ---');
    // Stage A: Raw GLB embedded diffuse / materials
    await setViewerState(ws, { product: 'original', strategy: 'config-a-baseline', lighting: 'studio', tier: '4k', cameraView: 'front' });
    await captureShot(ws, 'stage_A_raw_glb_classic.png', 'Stage A: Raw GLB 4K Master (Classic)');

    // Stage B: Geometry groups with basic materials
    await setViewerState(ws, { product: 'original', strategy: 'dual-material-groups', lighting: 'studio', tier: '4k', cameraView: 'front' });
    await captureShot(ws, 'stage_B_geom_groups_classic.png', 'Stage B: Geometry Groups 4K (Classic)');

    // Stage C: Geometry groups with Dual-Material assignments at 2K
    await setViewerState(ws, { product: 'original', strategy: 'dual-material-groups', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'stage_C_dual_material_2k_classic.png', 'Stage C: Dual-Material 2K Corrected (Classic)');

    // Stage D: Single material Config A with 2K optimized textures
    await setViewerState(ws, { product: 'original', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'stage_D_config_a_2k_classic.png', 'Stage D: Config A 2K Corrected (Classic)');

    // Stage E: Unlit diffuse check
    await setViewerState(ws, { product: 'original', strategy: 'unlit-base-color', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'stage_E_unlit_diffuse_2k_classic.png', 'Stage E: Unlit Base Color 2K (Classic)');

    // 2. Roughness Channel Audit Render
    console.log('\n--- 2. Roughness Channel Renders ---');
    await setViewerState(ws, { product: 'original', strategy: 'debug-roughness', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'roughness_debug_channel_classic.png', 'Corrected Roughness Channel (Classic)');

    await setViewerState(ws, { product: 'diet', strategy: 'debug-roughness', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'roughness_debug_channel_diet.png', 'Corrected Roughness Channel (Diet)');

    // 3. Regression Testing Across All 3 Products & Texture Tiers & Angles
    console.log('\n--- 3. Regression Matrix (4K, 2K, 1K across Products) ---');
    const prods = [
      { id: 'original', label: 'Classic' },
      { id: 'diet', label: 'Diet' },
      { id: 'zero', label: 'Zero' },
    ];
    const tiers = ['4k', '2k', '1k'];

    // Test tier consistency (front view)
    for (const p of prods) {
      for (const t of tiers) {
        await setViewerState(ws, { product: p.id, strategy: 'dual-material-groups', lighting: 'studio', tier: t, cameraView: 'front' });
        await captureShot(ws, `reg_${p.label.toLowerCase()}_tier_${t}.png`, `${p.label} Coke (${t} Tier)`);
      }
    }

    // 4. Test 4 Core Views (Front, Side, Three-Quarter, Top) on Final 2K Production Setup
    console.log('\n--- 4. Final 4-Angle Production Verification (2K Desktop) ---');
    const views = ['front', 'side', 'three-quarter', 'top'];
    for (const p of prods) {
      for (const v of views) {
        await setViewerState(ws, { product: p.id, strategy: 'dual-material-groups', lighting: 'studio', tier: '2k', cameraView: v });
        await captureShot(ws, `final_${p.label.toLowerCase()}_${v.replace('-', '_')}.png`, `${p.label} Coke (${v} View)`);
      }
    }

    // 5. Lighting Resilience Matrix on Classic Coke
    console.log('\n--- 5. Lighting Resilience Matrix (Classic Coke) ---');
    for (const l of ['studio', 'neutral', 'directional']) {
      await setViewerState(ws, { product: 'original', strategy: 'dual-material-groups', lighting: l, tier: '2k', cameraView: 'front' });
      await captureShot(ws, `final_classic_light_${l}.png`, `Classic Coke (${l} Light)`);
    }

    ws.close();
    console.log('\n✨ All regression tests, isolation stages, and final multi-product captures completed!');
  } finally {
    chrome.kill();
    server.kill();
  }
}

run().catch((err) => {
  console.error('Fatal error during regression capture:', err);
  process.exit(1);
});
