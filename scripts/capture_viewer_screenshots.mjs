import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const PORT = 9334;
const USER_DATA = '/tmp/chrome_pbr_session';
const OUTPUT_DIR = 'public/models/validation_renders';
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
        if (msg.error) {
          reject(msg.error);
        } else {
          resolve(msg.result);
        }
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function run() {
  console.log('[1/5] Launching headless Chrome with WebGL on port ' + PORT + '...');
  const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1600,1000',
    'http://localhost:4173/'
  ], {
    stdio: 'ignore'
  });

  try {
    // Wait for Chrome to bind to port
    let tab = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json`);
        const list = await res.json();
        tab = list.find((t) => t.url.includes('localhost:4173'));
        if (tab) break;
      } catch {
        // Retry connection
      }
    }

    if (!tab) {
      throw new Error('Failed to find Chrome tab on port ' + PORT);
    }

    console.log('[2/5] Connected to Chrome tab:', tab.webSocketDebuggerUrl);
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');

    console.log('[3/5] Waiting for coke-can.glb to finish loading into Three.js...');
    let loaded = false;

    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const evalRes = await sendCDP(ws, 'Runtime.evaluate', {
        expression: `
          (() => {
            const el = document.querySelector('.viewer-loading-overlay');
            const hud = document.querySelector('.viewer-telemetry-hud');
            const trianglesEl = hud ? hud.querySelectorAll('.hud-value')[2] : null;
            const triangles = trianglesEl ? trianglesEl.textContent.trim() : '0';
            return {
              isLoading: el !== null,
              triangles: triangles,
              bodyHtml: document.body.innerHTML.length
            };
          })()
        `,
        returnByValue: true,
      });

      const val = evalRes.result.value;
      if (val && !val.isLoading && val.triangles !== '0') {
        loaded = true;
        console.log(`      Model loaded successfully! Triangles in HUD: ${val.triangles}`);
        break;
      }
    }

    if (!loaded) {
      console.warn('      Warning: Model loading timeout or overlay still active.');
    }

    // Give an extra 600ms for texture upload & shaders to settle
    await sleep(600);

    const captures = [
      { name: '01_derived_dual_pbr', mode: 'derived-dual-pbr', label: 'Config C: Derived Dual-PBR (Recommended)' },
      { name: '02_default_gltf', mode: 'default-gltf', label: 'Config A: Default glTF Standard (Metallic 0.85)' },
      { name: '03_uniform_lacquer', mode: 'uniform-lacquer', label: 'Config B: Uniform Dielectric Clearcoat' },
      { name: '04_debug_normals', mode: 'debug-normals', label: 'Debug: Tangent Normals Map' },
      { name: '05_debug_roughness', mode: 'debug-roughness', label: 'Debug: Roughness Channel (G)' },
      { name: '06_debug_metalness', mode: 'debug-metalness', label: 'Debug: Derived Metalness Channel' },
    ];

    console.log('[4/5] Capturing validation screenshots across material configurations...');

    for (const cap of captures) {
      // Set select value
      await sendCDP(ws, 'Runtime.evaluate', {
        expression: `
          (() => {
            const select = document.getElementById('material-select');
            if (select) {
              select.value = '${cap.mode}';
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          })()
        `,
      });

      await sleep(400);

      const shot = await sendCDP(ws, 'Page.captureScreenshot', {
        format: 'png',
      });

      const buffer = Buffer.from(shot.data, 'base64');
      const filename = `${cap.name}.png`;
      const outPath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(outPath, buffer);

      if (fs.existsSync(ARTIFACT_DIR)) {
        fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer);
      }

      console.log(`      Saved [${cap.label}] -> ${outPath} (${Math.round(buffer.length / 1024)} KB)`);
    }

    // Capture wireframe overlay
    console.log('[5/5] Capturing wireframe and telemetry views...');
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        (() => {
          const select = document.getElementById('material-select');
          if (select) {
            select.value = 'derived-dual-pbr';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const checkboxes = document.querySelectorAll('.checkbox-row input');
          if (checkboxes.length > 0) {
            checkboxes[0].click();
          }
        })()
      `,
    });

    await sleep(400);

    const wireShot = await sendCDP(ws, 'Page.captureScreenshot', {
      format: 'png',
    });

    const wireBuffer = Buffer.from(wireShot.data, 'base64');
    const wirePath = path.join(OUTPUT_DIR, '07_wireframe_overlay.png');
    fs.writeFileSync(wirePath, wireBuffer);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.writeFileSync(path.join(ARTIFACT_DIR, '07_wireframe_overlay.png'), wireBuffer);
    }
    console.log(`      Saved [Wireframe Overlay] -> ${wirePath} (${Math.round(wireBuffer.length / 1024)} KB)`);

    ws.close();
    console.log('\n✨ All Three.js validation screenshots captured successfully!');
  } finally {
    chrome.kill();
  }
}

run().catch((err) => {
  console.error('Fatal error in capture script:', err);
  process.exit(1);
});
