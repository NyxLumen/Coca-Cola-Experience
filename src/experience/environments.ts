import * as THREE from 'three';

/**
 * Creates a seamless studio cyclorama (infinity cove) mesh that seamlessly connects
 * the glossy reflective floor to a curved back wall without any visible horizon seam.
 * Uses calibrated UV coordinates mapping:
 * - v: 0.0 to 0.45 -> Flat floor
 * - v: 0.45 to 0.60 -> Smooth curve
 * - v: 0.60 to 1.00 -> Vertical back wall
 * - u: 0.0 (left) to 0.5 (center behind can) to 1.0 (right)
 */
export function createStudioCycloramaMesh(reality: 'classic' | 'diet'): THREE.Mesh {
  const width = 18;
  const depth = 14;
  // Efficient 6 x 36 grid: 36 segments along Z curve smoothly, 6 segments along X
  const geo = new THREE.PlaneGeometry(width, depth, 6, 36);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;

  // Sweep: Floor is flat at y = -1.15 from z = 5.0 back to z = -0.5
  // For z < -0.5, curves smoothly upward into a tall studio back wall
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    if (z < -0.5) {
      const t = Math.min(1.0, (-0.5 - z) / 4.5);
      const curve = t * t * (3.0 - 2.0 * t); // smoothstep curve
      pos.setY(i, -1.15 + curve * 6.5);
      pos.setZ(i, -0.5 - (1.0 - curve) * 1.8 - t * 0.8);
    } else {
      pos.setY(i, -1.15);
    }

    // Calibrate UVs:
    // u: 0.0 (left, x = -9) to 1.0 (right, x = +9)
    const u = (x + width * 0.5) / width;
    // v: 0.0 at floor front (z = +7) up to 1.0 at back wall top (z = -7)
    const v = (-z + depth * 0.5) / depth;
    uvs.setXY(i, u, v);
  }

  geo.computeVertexNormals();
  uvs.needsUpdate = true;

  const texture = createCycloramaTexture(reality);
  const roughnessMap = createCycloramaRoughnessTexture(reality);

  let mat: THREE.MeshStandardMaterial;
  if (reality === 'classic') {
    // Reality A: Rich, multi-tonal, luminous Coca-Cola Red Cyclorama
    mat = new THREE.MeshStandardMaterial({
      name: 'Cyclorama_ClassicCoke_Material',
      map: texture,
      roughnessMap,
      roughness: 0.85, // Modulated by roughnessMap: 0.22 on floor, 0.42 on wall
      metalness: 0.04,
      envMapIntensity: 1.1,
    });
  } else {
    // Reality B: Sophisticated, Brushed Platinum Silver Cyclorama (NOT plain white!)
    mat = new THREE.MeshStandardMaterial({
      name: 'Cyclorama_DietCoke_Material',
      map: texture,
      roughnessMap,
      roughness: 0.85, // Modulated by roughnessMap: 0.20 on floor, 0.38 on wall
      metalness: 0.18, // Subtle metallic sheen
      envMapIntensity: 1.2,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `Cyclorama_${reality}`;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates a rich, textured, multi-layered environment canvas texture for the cyclorama.
 * Reality A: Multi-layered red tonal gradients, luminous center hotspot, organic studio sweeps,
 * deep burgundy vignettes, and subtle micro-grain.
 * Reality B: Brushed-metal platinum silver, horizontal striations, graphite vignettes,
 * and cool metallic highlights.
 */
export function createCycloramaTexture(reality: 'classic' | 'diet'): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size * 0.5;

    if (reality === 'classic') {
      // =======================================================================
      // REALITY A: RICH, LAYERED, LUMINOUS COCA-COLA RED ENVIRONMENT
      // =======================================================================

      // 1. Base vertical tonal ramp (deep rich burgundy at top to vibrant red at floor)
      const baseGrad = ctx.createLinearGradient(0, size, 0, 0);
      baseGrad.addColorStop(0.0, '#780008'); // Foreground floor tone
      baseGrad.addColorStop(0.40, '#a8000d'); // Floor/wall transition
      baseGrad.addColorStop(0.68, '#dc0012'); // Back wall core
      baseGrad.addColorStop(0.90, '#90000a'); // Upper wall
      baseGrad.addColorStop(1.0, '#4a0005'); // Deep burgundy ceiling
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // 2. Large luminous backdrop hotspot (radiant glow directly behind the can)
      // UV center is at u = 0.5, v = 0.68. In canvas: x = cx, y = size * (1 - 0.68) = size * 0.32
      const spotY = size * 0.33;
      const spotGrad = ctx.createRadialGradient(cx, spotY, 20, cx, spotY, size * 0.52);
      spotGrad.addColorStop(0.0, 'rgba(255, 45, 58, 0.95)'); // Radiant scarlet hotspot
      spotGrad.addColorStop(0.25, 'rgba(235, 10, 26, 0.85)'); // Vibrant Coca-Cola red
      spotGrad.addColorStop(0.55, 'rgba(195, 0, 15, 0.45)'); // Rich crimson midtone
      spotGrad.addColorStop(0.82, 'rgba(140, 0, 10, 0.15)'); // Soft edge roll
      spotGrad.addColorStop(1.0, 'rgba(100, 0, 6, 0.0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(cx, spotY, size * 0.52, 0, Math.PI * 2);
      ctx.fill();

      // 3. Asymmetric soft studio softbox reflection sweep (framing the right flank)
      const sweepGrad = ctx.createRadialGradient(cx + size * 0.18, spotY - size * 0.05, 10, cx + size * 0.18, spotY - size * 0.05, size * 0.38);
      sweepGrad.addColorStop(0.0, 'rgba(255, 75, 85, 0.40)');
      sweepGrad.addColorStop(0.4, 'rgba(240, 20, 35, 0.22)');
      sweepGrad.addColorStop(0.8, 'rgba(200, 0, 18, 0.06)');
      sweepGrad.addColorStop(1.0, 'rgba(160, 0, 10, 0.0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(cx + size * 0.18, spotY - size * 0.05, size * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // 4. Soft atmospheric floor illumination beneath the can
      // Floor center is at u = 0.5, v = 0.48. In canvas: y = size * (1 - 0.48) = size * 0.52
      const floorGlowY = size * 0.52;
      const floorGrad = ctx.createRadialGradient(cx, floorGlowY, 15, cx, floorGlowY, size * 0.30);
      floorGrad.addColorStop(0.0, 'rgba(255, 30, 42, 0.50)');
      floorGrad.addColorStop(0.4, 'rgba(220, 10, 22, 0.25)');
      floorGrad.addColorStop(0.8, 'rgba(170, 0, 15, 0.08)');
      floorGrad.addColorStop(1.0, 'rgba(120, 0, 10, 0.0)');
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.arc(cx, floorGlowY, size * 0.30, 0, Math.PI * 2);
      ctx.fill();

      // 5. Rich peripheral vignette (deep crimson-burgundy framing)
      const vignetteGrad = ctx.createRadialGradient(cx, spotY, size * 0.35, cx, spotY, size * 0.75);
      vignetteGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
      vignetteGrad.addColorStop(0.6, 'rgba(60, 0, 5, 0.25)');
      vignetteGrad.addColorStop(0.85, 'rgba(45, 0, 4, 0.55)');
      vignetteGrad.addColorStop(1.0, 'rgba(30, 0, 3, 0.78)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, size, size);

      // 6. Subtle tactile organic micro-noise to eliminate 8-bit banding and give print texture
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 6.0;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.3));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.3));
      }
      ctx.putImageData(imgData, 0, 0);

    } else {
      // =======================================================================
      // REALITY B: SOPHISTICATED BRUSHED PLATINUM SILVER (NOT PLAIN WHITE!)
      // =======================================================================

      // 1. Base vertical tonal ramp (platinum silver and graphite tones)
      const baseGrad = ctx.createLinearGradient(0, size, 0, 0);
      baseGrad.addColorStop(0.0, '#56606e'); // Floor foreground graphite
      baseGrad.addColorStop(0.38, '#7e8a98'); // Floor midtone
      baseGrad.addColorStop(0.55, '#9faab8'); // Floor/wall curve
      baseGrad.addColorStop(0.70, '#c4ced8'); // Back wall platinum core
      baseGrad.addColorStop(0.88, '#8c98a6'); // Upper wall graphite
      baseGrad.addColorStop(1.0, '#4a5462'); // Ceiling charcoal
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // 2. Large soft platinum silver hotspot (luminous highlight behind the can)
      const spotY = size * 0.33;
      const spotGrad = ctx.createRadialGradient(cx, spotY, 20, cx, spotY, size * 0.52);
      spotGrad.addColorStop(0.0, 'rgba(242, 246, 252, 0.90)'); // Luminous cool platinum
      spotGrad.addColorStop(0.28, 'rgba(215, 224, 234, 0.75)'); // Soft silver highlight
      spotGrad.addColorStop(0.60, 'rgba(165, 176, 190, 0.40)'); // Clean graphite midtone
      spotGrad.addColorStop(0.85, 'rgba(125, 136, 150, 0.15)'); // Soft edge falloff
      spotGrad.addColorStop(1.0, 'rgba(90, 100, 114, 0.0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(cx, spotY, size * 0.52, 0, Math.PI * 2);
      ctx.fill();

      // 3. Architectural brushed-metal horizontal striations
      ctx.save();
      const numLines = 280;
      for (let i = 0; i < numLines; i++) {
        const y = Math.random() * size;
        const alpha = 0.02 + Math.random() * 0.05;
        const isBright = Math.random() > 0.4;
        ctx.strokeStyle = isBright
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(40, 48, 60, ${alpha * 0.8})`;
        ctx.lineWidth = 1.0 + Math.random() * 2.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Subtle cool steel floor illumination
      const floorGlowY = size * 0.52;
      const floorGrad = ctx.createRadialGradient(cx, floorGlowY, 15, cx, floorGlowY, size * 0.30);
      floorGrad.addColorStop(0.0, 'rgba(220, 230, 242, 0.45)');
      floorGrad.addColorStop(0.4, 'rgba(180, 195, 210, 0.22)');
      floorGrad.addColorStop(0.8, 'rgba(140, 155, 170, 0.08)');
      floorGrad.addColorStop(1.0, 'rgba(100, 115, 130, 0.0)');
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.arc(cx, floorGlowY, size * 0.30, 0, Math.PI * 2);
      ctx.fill();

      // 5. Sophisticated graphite peripheral vignette
      const vignetteGrad = ctx.createRadialGradient(cx, spotY, size * 0.35, cx, spotY, size * 0.75);
      vignetteGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
      vignetteGrad.addColorStop(0.6, 'rgba(35, 42, 52, 0.25)');
      vignetteGrad.addColorStop(0.85, 'rgba(25, 30, 38, 0.50)');
      vignetteGrad.addColorStop(1.0, 'rgba(18, 22, 28, 0.75)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, size, size);

      // 6. Metallic high-frequency dither
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 5.0;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * Creates a calibrated roughness map for the cyclorama.
 * Floor (v < 0.48) is smooth and glossy (reflects can and caustic glow).
 * Wall (v > 0.55) is diffuse photographic paper (softly scatters light).
 */
export function createCycloramaRoughnessTexture(reality: 'classic' | 'diet'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Canvas y = 0 is top of back wall (v = 1.0), y = size is front of floor (v = 0.0)
    const floorRoughness = reality === 'classic' ? 56 : 50; // ~0.22 / ~0.20
    const wallRoughness = reality === 'classic' ? 110 : 98; // ~0.43 / ~0.38

    // Smooth gradient between floor and wall
    const grad = ctx.createLinearGradient(0, size, 0, 0);
    grad.addColorStop(0.0, `rgb(${floorRoughness}, ${floorRoughness}, ${floorRoughness})`);
    grad.addColorStop(0.46, `rgb(${floorRoughness}, ${floorRoughness}, ${floorRoughness})`);
    grad.addColorStop(0.56, `rgb(${wallRoughness}, ${wallRoughness}, ${wallRoughness})`);
    grad.addColorStop(1.0, `rgb(${wallRoughness}, ${wallRoughness}, ${wallRoughness})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Creates a luminous ground caustic and refractive liquid light pool directly underneath
 * the can, replicating high-end commercial beverage photography.
 */
export function createCausticGlowMesh(reality: 'classic' | 'diet'): THREE.Mesh {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;

    // 1. Broad soft ambient light pool
    const gradPool = ctx.createRadialGradient(cx, cy, 10, cx, cy, 230);
    if (reality === 'classic') {
      gradPool.addColorStop(0.0, 'rgba(255, 35, 48, 0.90)');
      gradPool.addColorStop(0.35, 'rgba(230, 10, 25, 0.60)');
      gradPool.addColorStop(0.65, 'rgba(180, 0, 15, 0.22)');
      gradPool.addColorStop(1.0, 'rgba(140, 0, 10, 0.0)');
    } else {
      gradPool.addColorStop(0.0, 'rgba(215, 235, 255, 0.85)');
      gradPool.addColorStop(0.35, 'rgba(175, 205, 235, 0.55)');
      gradPool.addColorStop(0.65, 'rgba(135, 170, 205, 0.18)');
      gradPool.addColorStop(1.0, 'rgba(95, 125, 155, 0.0)');
    }
    ctx.fillStyle = gradPool;
    ctx.fillRect(0, 0, size, size);

    // 2. Focused caustic focal ring (sub-can refraction halo)
    const gradRing = ctx.createRadialGradient(cx, cy, 55, cx, cy, 125);
    if (reality === 'classic') {
      gradRing.addColorStop(0.0, 'rgba(255, 80, 70, 0.0)');
      gradRing.addColorStop(0.5, 'rgba(255, 60, 50, 0.80)');
      gradRing.addColorStop(0.8, 'rgba(255, 20, 30, 0.35)');
      gradRing.addColorStop(1.0, 'rgba(200, 0, 20, 0.0)');
    } else {
      gradRing.addColorStop(0.0, 'rgba(240, 250, 255, 0.0)');
      gradRing.addColorStop(0.5, 'rgba(225, 240, 255, 0.80)');
      gradRing.addColorStop(0.8, 'rgba(185, 220, 255, 0.35)');
      gradRing.addColorStop(1.0, 'rgba(145, 185, 225, 0.0)');
    }
    ctx.fillStyle = gradRing;
    ctx.beginPath();
    ctx.arc(cx, cy, 125, 0, Math.PI * 2);
    ctx.fill();

    // 3. Subtle caustic rays emanating outward
    ctx.save();
    ctx.translate(cx, cy);
    const numRays = 18;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2;
      const rayLen = 135 + (i % 3) * 30;
      const alpha = 0.10 + (i % 2) * 0.08;
      ctx.strokeStyle = reality === 'classic'
        ? `rgba(255, 120, 100, ${alpha})`
        : `rgba(235, 245, 255, ${alpha})`;
      ctx.lineWidth = 3 + (i % 3) * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 70, Math.sin(angle) * 70);
      ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
      ctx.stroke();
    }
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(2.4, 2.4);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.82,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.146; // Positioned right above cyclorama floor
  mesh.name = `CausticGlow_${reality}`;
  return mesh;
}

/**
 * Generates an energetic, bright radial studio background texture with rich color saturation
 * and micro-dithering. Used as fallback/scene background.
 */
export function createStudioBackgroundTexture(reality: 'classic' | 'diet'): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.40;
    const rInner = 20;
    const rOuter = size * 0.65;

    const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);

    if (reality === 'classic') {
      grad.addColorStop(0.0, '#ff1a2b'); // Radiant luminous scarlet-red core
      grad.addColorStop(0.25, '#eb0014'); // Vibrant authentic Coca-Cola red
      grad.addColorStop(0.55, '#c0000f'); // Rich saturated crimson midtone
      grad.addColorStop(0.82, '#8e0009'); // Deep warm red periphery
      grad.addColorStop(1.0, '#550007'); // Warm burgundy framing
    } else {
      grad.addColorStop(0.0, '#edf1f7'); // Pure luminous platinum core
      grad.addColorStop(0.25, '#dbe2ec'); // Clean silver midtone
      grad.addColorStop(0.55, '#b0bac6'); // Metallic graphite
      grad.addColorStop(0.82, '#7c8896'); // Deep graphite
      grad.addColorStop(1.0, '#4f5966'); // Sophisticated charcoal framing
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const dither = (Math.random() - 0.5) * 3.5;
      data[i] = Math.max(0, Math.min(255, data[i] + dither));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + dither));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + dither));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Creates a dedicated commercial campaign PMREM studio environment map.
 * Reality A: Clean commercial white softboxes to preserve white script contrast on the can,
 * with saturated red floor bounce and warm atmospheric studio fill.
 * Reality B: Clean neutral cool-white softboxes, ice-silver rims, and razor aluminum streaks.
 */
export function createStudioEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  reality: 'classic' | 'diet'
): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();

  if (reality === 'classic') {
    // Reality A: Commercial Studio with Red Atmosphere & Crisp White Key Reflections
    // Neutral warm dark studio background (not pure red!) to prevent overall red tint
    envScene.background = new THREE.Color(0x281216);

    // Key Softbox: Large clean white rectangular softbox giving razor-sharp white highlights
    const keyBoxGeo = new THREE.PlaneGeometry(4.5, 6.0);
    const keyBoxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const keyBox = new THREE.Mesh(keyBoxGeo, keyBoxMat);
    keyBox.position.set(3.5, 3.2, 2.8);
    keyBox.lookAt(0, 0, 0);
    envScene.add(keyBox);

    // Fill Softbox: Soft warm neutral ivory reflector
    const fillBoxGeo = new THREE.PlaneGeometry(4.0, 6.0);
    const fillBoxMat = new THREE.MeshBasicMaterial({ color: 0xfff6ee });
    const fillBox = new THREE.Mesh(fillBoxGeo, fillBoxMat);
    fillBox.position.set(-3.8, 1.8, 2.0);
    fillBox.lookAt(0, 0, 0);
    envScene.add(fillBox);

    // Rim Softbox: Crisp neutral-white top-back reflector defining silver lid & tab
    const rimBoxGeo = new THREE.PlaneGeometry(6.0, 2.5);
    const rimBoxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const rimBox = new THREE.Mesh(rimBoxGeo, rimBoxMat);
    rimBox.position.set(0.0, 4.0, -3.2);
    rimBox.lookAt(0, 0, 0);
    envScene.add(rimBox);

    // Vertical Highlight Strip: Clean commercial white highlight down cylinder flank
    const stripGeo = new THREE.PlaneGeometry(0.6, 7.0);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(3.2, 0.0, 1.2);
    strip.lookAt(0, 0, 0);
    envScene.add(strip);

    // Floor Reflector: Saturated Coca-Cola red floor bounce
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xb5000e });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    envScene.add(floor);
  } else {
    // Reality B: Clean Platinum Silver Commercial Studio
    envScene.background = new THREE.Color(0x22262e);

    // Key Softbox: Large clean neutral white softbox
    const keyBoxGeo = new THREE.PlaneGeometry(4.5, 6.0);
    const keyBoxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const keyBox = new THREE.Mesh(keyBoxGeo, keyBoxMat);
    keyBox.position.set(3.5, 3.2, 2.8);
    keyBox.lookAt(0, 0, 0);
    envScene.add(keyBox);

    // Fill Softbox: Soft cool platinum reflector
    const fillBoxGeo = new THREE.PlaneGeometry(4.0, 6.0);
    const fillBoxMat = new THREE.MeshBasicMaterial({ color: 0xdde5f0 });
    const fillBox = new THREE.Mesh(fillBoxGeo, fillBoxMat);
    fillBox.position.set(-3.8, 1.8, 2.0);
    fillBox.lookAt(0, 0, 0);
    envScene.add(fillBox);

    // Rim Kicker: Pure razor-white top-back reflector
    const rimBoxGeo = new THREE.PlaneGeometry(6.0, 2.5);
    const rimBoxMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const rimBox = new THREE.Mesh(rimBoxGeo, rimBoxMat);
    rimBox.position.set(0.0, 4.0, -3.2);
    rimBox.lookAt(0, 0, 0);
    envScene.add(rimBox);

    // Vertical Highlight Strip: Razor aluminum specular streak
    const stripGeo = new THREE.PlaneGeometry(0.6, 7.0);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(3.2, 0.0, 1.2);
    strip.lookAt(0, 0, 0);
    envScene.add(strip);

    // Floor Reflector: Clean silver-graphite ground
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x6e7886 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    envScene.add(floor);
  }

  const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();

  // Dispose temporary meshes
  envScene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });

  return envTexture;
}

/**
 * Creates an authentic commercial tabletop contact shadow mesh with an intense
 * ambient occlusion core directly under the can base and a soft directional penumbra.
 */
export function createCampaignContactShadow(reality: 'classic' | 'diet'): THREE.Mesh {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size * 0.5;
    const cy = size * 0.5;

    // 1. Directional soft penumbra lobe (offset away from key light)
    const penumbraX = cx - 18;
    const penumbraY = cy - 12;
    const gradPenumbra = ctx.createRadialGradient(penumbraX, penumbraY, 20, penumbraX, penumbraY, 175);

    if (reality === 'classic') {
      gradPenumbra.addColorStop(0.0, 'rgba(50, 0, 4, 0.65)');
      gradPenumbra.addColorStop(0.40, 'rgba(65, 0, 6, 0.35)');
      gradPenumbra.addColorStop(0.70, 'rgba(80, 0, 8, 0.12)');
      gradPenumbra.addColorStop(1.0, 'rgba(90, 0, 10, 0.0)');
    } else {
      gradPenumbra.addColorStop(0.0, 'rgba(20, 24, 30, 0.65)');
      gradPenumbra.addColorStop(0.40, 'rgba(25, 30, 38, 0.35)');
      gradPenumbra.addColorStop(0.70, 'rgba(35, 42, 52, 0.12)');
      gradPenumbra.addColorStop(1.0, 'rgba(45, 54, 66, 0.0)');
    }

    ctx.fillStyle = gradPenumbra;
    ctx.fillRect(0, 0, size, size);

    // 2. Intense Ambient Occlusion Core directly beneath the base chine
    const gradCore = ctx.createRadialGradient(cx, cy, 25, cx, cy, 95);
    gradCore.addColorStop(0.0, 'rgba(0, 0, 0, 0.92)');
    gradCore.addColorStop(0.50, 'rgba(0, 0, 0, 0.82)');
    gradCore.addColorStop(0.80, 'rgba(0, 0, 0, 0.35)');
    gradCore.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradCore;
    ctx.beginPath();
    ctx.arc(cx, cy, 95, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.88,
  });

  const mesh = new THREE.Mesh(shadowGeo, shadowMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.148; // Sits right on the cyclorama floor
  mesh.name = `ContactShadow_${reality}`;
  return mesh;
}
