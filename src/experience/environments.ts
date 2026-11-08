import * as THREE from 'three';

/**
 * Creates a seamless studio cyclorama (infinity cove) mesh that seamlessly connects
 * the reflective floor to a curved back wall with continuous C^2 curvature.
 * Eliminates all visible shelf/tabletop horizontal edges, kinking, or horizon seams.
 */
export function createStudioCycloramaMesh(reality: 'classic' | 'diet'): THREE.Mesh {
  const width = 18;
  const depth = 14;
  // 6 segments along X, 48 segments along Z for an ultra-smooth continuous curve
  const geo = new THREE.PlaneGeometry(width, depth, 6, 48);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;

  // Continuous Asymptotic Sweep:
  // Instead of an abrupt bend right behind the can (which looks like a desk edge),
  // the cove curves continuously and asymptotically from z = +1.6 all the way back to z = -7.0.
  // Formula: y(z) = -1.15 + 6.8 * t^2.4 where t = clamp((1.6 - z) / 6.4, 0, 1)
  // At z = 1.6, t = 0, dy/dz = 0, d^2y/dz^2 = 0.
  // This produces zero crease, zero horizon line, and zero tabletop appearance.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const t = Math.min(1.0, Math.max(0.0, (1.6 - z) / 6.6));
    // Smooth power curve with zero first and second derivatives at t = 0
    const curve = Math.pow(t, 2.4);
    pos.setY(i, -1.15 + curve * 6.6);
    pos.setZ(i, z - curve * 1.4);

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

  let mat: THREE.MeshBasicMaterial;
  if (reality === 'classic') {
    // Reality A: Rich, multi-tonal, luminous Coca-Cola Red Cyclorama (Commercial Studio Quality)
    mat = new THREE.MeshBasicMaterial({
      name: 'Cyclorama_ClassicCoke_Material',
      map: texture,
    });
  } else {
    // Reality B: Sophisticated, Platinum Silver Cyclorama (Commercial Studio Quality, NOT white!)
    mat = new THREE.MeshBasicMaterial({
      name: 'Cyclorama_DietCoke_Material',
      map: texture,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = `Cyclorama_${reality}`;
  mesh.layers.set(1);

  // Soft directional shadow receiver on Layer 0 for subtle ground shadow integration
  const shadowMat = new THREE.ShadowMaterial({
    opacity: reality === 'classic' ? 0.30 : 0.24,
    depthWrite: false,
  });
  const shadowOverlay = new THREE.Mesh(geo.clone(), shadowMat);
  shadowOverlay.name = `CycloramaShadowOverlay_${reality}`;
  shadowOverlay.receiveShadow = true;
  shadowOverlay.layers.set(0);
  mesh.add(shadowOverlay);

  return mesh;
}

/**
 * Creates a rich, textured, multi-layered environment canvas texture for the cyclorama.
 * Both Reality A and Reality B share the exact same underlying visual language:
 * - Layered procedural gradients
 * - Organic tonal variation
 * - Soft luminous center hotspots
 * - Asymmetric studio reflector sweeps
 * - Subtle high-frequency micro-noise
 * - Seamless wall-to-floor blending (NO separate desk/platform color blocks)
 */
export function createCycloramaTexture(reality: 'classic' | 'diet'): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size * 0.5;
    const spotY = size * 0.36; // Luminous hotspot height behind can

    if (reality === 'classic') {
      // =======================================================================
      // REALITY A: RICH, LAYERED, LUMINOUS COCA-COLA RED ENVIRONMENT
      // Calibrated to match commercial campaign visual reference:
      // Rich saturated red tones (#C80E18 to #360004), zero wash-out, zero pink.
      // =======================================================================

      // 1. Continuous vertical tonal ramp (seamless floor-to-wall transition)
      const baseGrad = ctx.createLinearGradient(0, size, 0, 0);
      baseGrad.addColorStop(0.0, '#5a0007'); // Foreground ground tone
      baseGrad.addColorStop(0.35, '#78000a'); // Smooth ground-to-cove blend
      baseGrad.addColorStop(0.65, '#b00412'); // Core rich red back wall
      baseGrad.addColorStop(0.88, '#70000a'); // Upper wall
      baseGrad.addColorStop(1.0, '#360004'); // Deep burgundy ceiling vignette
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // 2. Broad, soft, luminous backdrop glow (seamlessly distributed)
      const spotGrad = ctx.createRadialGradient(cx, spotY, 0, cx, spotY, size * 0.75);
      spotGrad.addColorStop(0.0, 'rgba(235, 18, 30, 0.45)'); // Radiant Coca-Cola red glow
      spotGrad.addColorStop(0.30, 'rgba(205, 8, 20, 0.30)'); // Rich vibrant red
      spotGrad.addColorStop(0.60, 'rgba(150, 0, 14, 0.15)'); // Warm crimson midtone
      spotGrad.addColorStop(0.85, 'rgba(85, 0, 8, 0.04)'); // Gentle edge roll
      spotGrad.addColorStop(1.0, 'rgba(35, 0, 4, 0.0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(cx, spotY, size * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // 3. Asymmetric soft studio softbox reflection sweep (broad, subtle falloff)
      const sweepGrad = ctx.createRadialGradient(cx + size * 0.20, spotY - size * 0.05, 10, cx + size * 0.20, spotY - size * 0.05, size * 0.50);
      sweepGrad.addColorStop(0.0, 'rgba(225, 24, 36, 0.14)');
      sweepGrad.addColorStop(0.45, 'rgba(175, 8, 20, 0.06)');
      sweepGrad.addColorStop(1.0, 'rgba(100, 0, 10, 0.0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(cx + size * 0.20, spotY - size * 0.05, size * 0.50, 0, Math.PI * 2);
      ctx.fill();

      // 4. Subtle downward light dispersion (softly lighting floor without harsh edges)
      const downGrad = ctx.createRadialGradient(cx, spotY, size * 0.10, cx, size * 0.60, size * 0.55);
      downGrad.addColorStop(0.0, 'rgba(210, 15, 25, 0.12)');
      downGrad.addColorStop(0.6, 'rgba(150, 4, 15, 0.05)');
      downGrad.addColorStop(1.0, 'rgba(70, 0, 7, 0.0)');
      ctx.fillStyle = downGrad;
      ctx.fillRect(0, size * 0.35, size, size * 0.65);

      // 5. Rich peripheral vignette (deep crimson-burgundy framing)
      const vignetteGrad = ctx.createRadialGradient(cx, spotY, size * 0.35, cx, spotY, size * 0.85);
      vignetteGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
      vignetteGrad.addColorStop(0.55, 'rgba(38, 0, 4, 0.18)');
      vignetteGrad.addColorStop(0.82, 'rgba(24, 0, 3, 0.48)');
      vignetteGrad.addColorStop(1.0, 'rgba(12, 0, 2, 0.75)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, size, size);

      // 6. Subtle tactile organic micro-noise (eliminates 8-bit banding, gives velvet print texture)
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 4.5;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise * 0.2));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise * 0.2));
      }
      ctx.putImageData(imgData, 0, 0);

    } else {
      // =======================================================================
      // REALITY B: SOPHISTICATED PLATINUM SILVER (MATCHING ARCHITECTURE TO CLASSIC)
      // Calibrated to match commercial campaign visual reference:
      // True brushed platinum silver tones (#929DAE to #363C46), zero whiteout, zero lines.
      // =======================================================================

      // 1. Continuous vertical tonal ramp in platinum silver and graphite
      const baseGrad = ctx.createLinearGradient(0, size, 0, 0);
      baseGrad.addColorStop(0.0, '#505864'); // Foreground ground graphite
      baseGrad.addColorStop(0.35, '#6c7684'); // Smooth ground-to-cove blend
      baseGrad.addColorStop(0.65, '#929dae'); // Core brushed platinum silver back wall
      baseGrad.addColorStop(0.88, '#707b8c'); // Upper wall graphite
      baseGrad.addColorStop(1.0, '#363c46'); // Deep charcoal ceiling vignette
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);

      // 2. Broad, soft, luminous platinum silver aura (reads 100% SILVER, zero white hotspot!)
      const spotGrad = ctx.createRadialGradient(cx, spotY, 0, cx, spotY, size * 0.75);
      spotGrad.addColorStop(0.0, 'rgba(195, 205, 218, 0.35)'); // Luminous platinum silver midtone
      spotGrad.addColorStop(0.30, 'rgba(165, 175, 188, 0.22)'); // Clean silver gradation
      spotGrad.addColorStop(0.60, 'rgba(125, 135, 146, 0.10)'); // Slate silver midtone
      spotGrad.addColorStop(0.85, 'rgba(85, 94, 104, 0.03)'); // Smooth edge roll
      spotGrad.addColorStop(1.0, 'rgba(42, 48, 56, 0.0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(cx, spotY, size * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // 3. Asymmetric soft studio softbox reflection sweep (cool platinum sheen)
      const sweepGrad = ctx.createRadialGradient(cx + size * 0.20, spotY - size * 0.05, 10, cx + size * 0.20, spotY - size * 0.05, size * 0.50);
      sweepGrad.addColorStop(0.0, 'rgba(188, 198, 212, 0.14)');
      sweepGrad.addColorStop(0.45, 'rgba(148, 158, 170, 0.06)');
      sweepGrad.addColorStop(1.0, 'rgba(90, 100, 112, 0.0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(cx + size * 0.20, spotY - size * 0.05, size * 0.50, 0, Math.PI * 2);
      ctx.fill();

      // 4. Subtle downward light dispersion (softly lighting the floor seamlessly)
      const downGrad = ctx.createRadialGradient(cx, spotY, size * 0.10, cx, size * 0.60, size * 0.55);
      downGrad.addColorStop(0.0, 'rgba(172, 182, 195, 0.10)');
      downGrad.addColorStop(0.6, 'rgba(130, 140, 152, 0.04)');
      downGrad.addColorStop(1.0, 'rgba(78, 86, 96, 0.0)');
      ctx.fillStyle = downGrad;
      ctx.fillRect(0, size * 0.35, size, size * 0.65);

      // 5. Sophisticated graphite peripheral vignette (matching contrast curve)
      const vignetteGrad = ctx.createRadialGradient(cx, spotY, size * 0.35, cx, spotY, size * 0.85);
      vignetteGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
      vignetteGrad.addColorStop(0.55, 'rgba(24, 28, 35, 0.18)');
      vignetteGrad.addColorStop(0.82, 'rgba(16, 20, 26, 0.48)');
      vignetteGrad.addColorStop(1.0, 'rgba(8, 10, 15, 0.75)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, size, size);

      // 6. Subtle tactile organic micro-noise (identical noise scale and amplitude as Classic)
      const imgData = ctx.getImageData(0, 0, size, size);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 4.5;
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
 * Features an imperceptible, continuous roughness gradient (~0.35 on floor to ~0.40 on wall)
 * that eliminates any sharp specular horizon or tabletop appearance while retaining
 * soft, authentic photographic grounding.
 */
export function createCycloramaRoughnessTexture(reality: 'classic' | 'diet'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Subtle, restrained roughness variation (NO harsh specular boundary)
    const floorRoughness = reality === 'classic' ? 90 : 86; // ~0.35 / ~0.34
    const wallRoughness = reality === 'classic' ? 104 : 98; // ~0.41 / ~0.38

    // Broad, continuous smooth gradient across the entire cove
    const grad = ctx.createLinearGradient(0, size, 0, 0);
    grad.addColorStop(0.0, `rgb(${floorRoughness}, ${floorRoughness}, ${floorRoughness})`);
    grad.addColorStop(0.30, `rgb(${floorRoughness}, ${floorRoughness}, ${floorRoughness})`);
    grad.addColorStop(0.70, `rgb(${wallRoughness}, ${wallRoughness}, ${wallRoughness})`);
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
 * Creates a luminous ground caustic and liquid light bloom directly underneath the can.
 * Refined to be soft and diffused, avoiding any hard circular coaster/pad appearance.
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

    // Soft, diffused liquid light bloom
    const gradPool = ctx.createRadialGradient(cx, cy, 10, cx, cy, 210);
    if (reality === 'classic') {
      gradPool.addColorStop(0.0, 'rgba(255, 45, 55, 0.65)');
      gradPool.addColorStop(0.35, 'rgba(220, 10, 25, 0.35)');
      gradPool.addColorStop(0.70, 'rgba(160, 0, 15, 0.10)');
      gradPool.addColorStop(1.0, 'rgba(120, 0, 10, 0.0)');
    } else {
      gradPool.addColorStop(0.0, 'rgba(215, 235, 255, 0.60)');
      gradPool.addColorStop(0.35, 'rgba(175, 205, 235, 0.30)');
      gradPool.addColorStop(0.70, 'rgba(135, 170, 205, 0.08)');
      gradPool.addColorStop(1.0, 'rgba(95, 125, 155, 0.0)');
    }
    ctx.fillStyle = gradPool;
    ctx.fillRect(0, 0, size, size);

    // Subtle sub-can core refraction halo
    const gradCore = ctx.createRadialGradient(cx, cy, 40, cx, cy, 110);
    if (reality === 'classic') {
      gradCore.addColorStop(0.0, 'rgba(255, 70, 60, 0.0)');
      gradCore.addColorStop(0.5, 'rgba(255, 50, 45, 0.40)');
      gradCore.addColorStop(1.0, 'rgba(200, 0, 20, 0.0)');
    } else {
      gradCore.addColorStop(0.0, 'rgba(235, 245, 255, 0.0)');
      gradCore.addColorStop(0.5, 'rgba(215, 235, 255, 0.40)');
      gradCore.addColorStop(1.0, 'rgba(145, 185, 225, 0.0)');
    }
    ctx.fillStyle = gradCore;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const geo = new THREE.PlaneGeometry(2.4, 2.4);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.146;
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
      grad.addColorStop(0.0, '#b80012');
      grad.addColorStop(0.25, '#8c000d');
      grad.addColorStop(0.55, '#5c0008');
      grad.addColorStop(0.82, '#380005');
      grad.addColorStop(1.0, '#1c0002');
    } else {
      grad.addColorStop(0.0, '#b8c5d4');
      grad.addColorStop(0.25, '#8c98a6');
      grad.addColorStop(0.55, '#5e6875');
      grad.addColorStop(0.82, '#3a424e');
      grad.addColorStop(1.0, '#1e232a');
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
    envScene.background = new THREE.Color(0x281216);

    // Key Softbox: Broad commercial white softbox reflector
    const keyBoxGeo = new THREE.PlaneGeometry(5.0, 6.5);
    const keyBoxMat = new THREE.MeshBasicMaterial({ color: 0xf4f6fa });
    const keyBox = new THREE.Mesh(keyBoxGeo, keyBoxMat);
    keyBox.position.set(3.5, 3.2, 2.8);
    keyBox.lookAt(0, 0, 0);
    envScene.add(keyBox);

    // Fill Softbox: Warm ivory soft reflector
    const fillBoxGeo = new THREE.PlaneGeometry(4.5, 6.5);
    const fillBoxMat = new THREE.MeshBasicMaterial({ color: 0xf6eee6 });
    const fillBox = new THREE.Mesh(fillBoxGeo, fillBoxMat);
    fillBox.position.set(-3.8, 1.8, 2.0);
    fillBox.lookAt(0, 0, 0);
    envScene.add(fillBox);

    // Rim Kicker: Soft daylight silver top-back reflector
    const rimBoxGeo = new THREE.PlaneGeometry(6.5, 2.8);
    const rimBoxMat = new THREE.MeshBasicMaterial({ color: 0xe8ecf2 });
    const rimBox = new THREE.Mesh(rimBoxGeo, rimBoxMat);
    rimBox.position.set(0.0, 4.0, -3.2);
    rimBox.lookAt(0, 0, 0);
    envScene.add(rimBox);

    // Vertical Highlight Strip: Broad commercial softbox reflection (w = 1.2 avoids needle streaks)
    const stripGeo = new THREE.PlaneGeometry(1.2, 7.5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xe2e6ee });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(3.4, 0.0, 1.2);
    strip.lookAt(0, 0, 0);
    envScene.add(strip);

    // Floor Reflector: Warm Coca-Cola crimson ground bounce
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x9e000c });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    envScene.add(floor);
  } else {
    envScene.background = new THREE.Color(0x22262e);

    // Key Softbox: Clean neutral white softbox reflector
    const keyBoxGeo = new THREE.PlaneGeometry(5.0, 6.5);
    const keyBoxMat = new THREE.MeshBasicMaterial({ color: 0xf4f6fa });
    const keyBox = new THREE.Mesh(keyBoxGeo, keyBoxMat);
    keyBox.position.set(3.5, 3.2, 2.8);
    keyBox.lookAt(0, 0, 0);
    envScene.add(keyBox);

    // Fill Softbox: Soft cool platinum reflector
    const fillBoxGeo = new THREE.PlaneGeometry(4.5, 6.5);
    const fillBoxMat = new THREE.MeshBasicMaterial({ color: 0xd4dee8 });
    const fillBox = new THREE.Mesh(fillBoxGeo, fillBoxMat);
    fillBox.position.set(-3.8, 1.8, 2.0);
    fillBox.lookAt(0, 0, 0);
    envScene.add(fillBox);

    // Rim Kicker: Soft top-back reflector
    const rimBoxGeo = new THREE.PlaneGeometry(6.5, 2.8);
    const rimBoxMat = new THREE.MeshBasicMaterial({ color: 0xe8ecf2 });
    const rimBox = new THREE.Mesh(rimBoxGeo, rimBoxMat);
    rimBox.position.set(0.0, 4.0, -3.2);
    rimBox.lookAt(0, 0, 0);
    envScene.add(rimBox);

    // Vertical Highlight Strip: Broad commercial softbox reflection
    const stripGeo = new THREE.PlaneGeometry(1.2, 7.5);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xdde2eb });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(3.4, 0.0, 1.2);
    strip.lookAt(0, 0, 0);
    envScene.add(strip);

    // Floor Reflector: Clean silver-graphite ground bounce
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x58606c });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    envScene.add(floor);
  }

  const envTexture = pmremGenerator.fromScene(envScene, 0.04).texture;
  pmremGenerator.dispose();

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

    // Directional soft penumbra lobe
    const penumbraX = cx - 16;
    const penumbraY = cy - 10;
    const gradPenumbra = ctx.createRadialGradient(penumbraX, penumbraY, 20, penumbraX, penumbraY, 175);

    if (reality === 'classic') {
      gradPenumbra.addColorStop(0.0, 'rgba(45, 0, 4, 0.55)');
      gradPenumbra.addColorStop(0.40, 'rgba(60, 0, 5, 0.28)');
      gradPenumbra.addColorStop(0.70, 'rgba(75, 0, 6, 0.10)');
      gradPenumbra.addColorStop(1.0, 'rgba(90, 0, 8, 0.0)');
    } else {
      gradPenumbra.addColorStop(0.0, 'rgba(18, 22, 28, 0.55)');
      gradPenumbra.addColorStop(0.40, 'rgba(24, 28, 36, 0.28)');
      gradPenumbra.addColorStop(0.70, 'rgba(32, 38, 48, 0.10)');
      gradPenumbra.addColorStop(1.0, 'rgba(40, 48, 60, 0.0)');
    }

    ctx.fillStyle = gradPenumbra;
    ctx.fillRect(0, 0, size, size);

    // Intense Ambient Occlusion Core directly beneath the base chime
    const gradCore = ctx.createRadialGradient(cx, cy, 25, cx, cy, 95);
    gradCore.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
    gradCore.addColorStop(0.50, 'rgba(0, 0, 0, 0.75)');
    gradCore.addColorStop(0.80, 'rgba(0, 0, 0, 0.28)');
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
    opacity: 0.82,
  });

  const mesh = new THREE.Mesh(shadowGeo, shadowMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.148;
  mesh.name = `ContactShadow_${reality}`;
  return mesh;
}
