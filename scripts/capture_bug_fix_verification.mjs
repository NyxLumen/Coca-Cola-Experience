import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9338;
const USER_DATA = '/tmp/chrome_pbr_fix_test';
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

async function setViewerState(ws, { product, strategy, lighting, tier, cameraView, disableNormal, disableRoughness }) {
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

        // Toggles
        const checkboxes = Array.from(document.querySelectorAll('.checkbox-row input[type="checkbox"]'));
        // 0: wireframe, 1: auto-rotate, 2: disable normal, 3: disable roughness
        if (checkboxes[2]) {
          const shouldNorm = ${disableNormal === true};
          if (checkboxes[2].checked !== shouldNorm) checkboxes[2].click();
        }
        if (checkboxes[3]) {
          const shouldRough = ${disableRoughness === true};
          if (checkboxes[3].checked !== shouldRough) checkboxes[3].click();
        }
      })()
    `,
  });
  // Allow textures to load over network and Three.js materials to re-render
  await sleep(750);
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
  console.log(' Coca-Cola Experience — Phase 1.3: Blocker Bug Fix & Verification Suite');
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

    console.log('[5/5] Executing systematic diagnostics and verification captures...');

    // 1. Numbered UV Checkerboard Diagnostic Render
    console.log('\n--- 1. UV Checkerboard Diagnostics ---');
    await setViewerState(ws, { product: 'original', strategy: 'uv-checker', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'uv_diagnostic_checkerboard.png', 'Numbered UV Checkerboard');

    // 2. Section 4: Controlled Isolation Tests on Diet Coke & Zero Sugar
    console.log('\n--- 2. Section 4 Isolation Tests ---');
    // Test A: Unlit Base-Color only
    await setViewerState(ws, { product: 'diet', strategy: 'unlit-base-color', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'test_A_unlit_base_color_diet.png', 'Test A: Unlit Base Color (Diet)');

    await setViewerState(ws, { product: 'zero', strategy: 'unlit-base-color', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'test_A_unlit_base_color_zero.png', 'Test A: Unlit Base Color (Zero)');

    // Test B: Original 4K diffuse texture
    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '4k', cameraView: 'front' });
    await captureShot(ws, 'test_B_4k_diffuse_diet.png', 'Test B: 4K Diffuse (Diet)');

    await setViewerState(ws, { product: 'zero', strategy: 'config-a-baseline', lighting: 'studio', tier: '4k', cameraView: 'front' });
    await captureShot(ws, 'test_B_4k_diffuse_zero.png', 'Test B: 4K Diffuse (Zero)');

    // Test C: Optimized 2K diffuse texture
    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k', cameraView: 'front' });
    await captureShot(ws, 'test_C_2k_diffuse_diet.png', 'Test C: 2K Diffuse (Diet)');

    // Test D: Optimized 1K diffuse texture
    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '1k', cameraView: 'front' });
    await captureShot(ws, 'test_D_1k_diffuse_diet.png', 'Test D: 1K Diffuse (Diet)');

    // Test E: Normal map disabled
    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k', cameraView: 'front', disableNormal: true });
    await captureShot(ws, 'test_E_normal_disabled_diet.png', 'Test E: Normal Map Disabled (Diet)');

    // Test F: Roughness/metallic map disabled
    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k', cameraView: 'front', disableNormal: false, disableRoughness: true });
    await captureShot(ws, 'test_F_roughness_disabled_diet.png', 'Test F: Roughness/Metal Map Disabled (Diet)');

    // Test G: Single-material configuration (geometry groups disabled)
    await setViewerState(ws, { product: 'diet', strategy: 'config-a-baseline', lighting: 'studio', tier: '2k', cameraView: 'front', disableNormal: false, disableRoughness: false });
    await captureShot(ws, 'test_G_single_material_diet.png', 'Test G: Single Material Config A (Diet)');

    // 3. Section 7: Final Comprehensive 5-Angle Verification Matrix across all 3 products
    console.log('\n--- 3. Section 7 Final 5-Angle Verification Matrix ---');
    const products = ['original', 'diet', 'zero'];
    const views = ['front', 'side', 'three-quarter', 'top', 'bottom'];

    for (const prod of products) {
      const prodLabel = prod === 'original' ? 'Classic Coke' : prod === 'diet' ? 'Diet Coke' : 'Zero Sugar';
      for (const view of views) {
        // Dual-Material configuration: authentic body finish + pristine aluminum lid/chime
        await setViewerState(ws, {
          product: prod,
          strategy: 'dual-material-groups',
          lighting: 'studio',
          tier: '2k',
          cameraView: view,
          disableNormal: false,
          disableRoughness: false,
        });
        const shotName = `verified_${prod === 'original' ? 'classic' : prod}_${view.replace('-', '_')}.png`;
        await captureShot(ws, shotName, `${prodLabel} (${view})`);
      }
    }

    ws.close();
    console.log('\n✨ All blocker tests, diagnostics, and 5-angle verification renders captured successfully!');
  } finally {
    chrome.kill();
    server.kill();
  }
}

run().catch((err) => {
  console.error('Fatal error during verification capture:', err);
  process.exit(1);
});
