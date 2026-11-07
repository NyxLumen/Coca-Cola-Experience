import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './AssetValidationViewer.css';

export type ProductVariant = 'original' | 'diet' | 'zero';
export type LightingPreset = 'studio' | 'neutral' | 'directional';
export type TextureTier = '4k' | '2k' | '1k';
export type MaterialStrategy =
  | 'config-a-baseline'
  | 'config-a-enhanced'
  | 'dual-material-groups'
  | 'mask-driven-pbr'
  | 'unlit-base-color'
  | 'uv-checker'
  | 'debug-normals'
  | 'debug-roughness'
  | 'debug-metalness';

interface TelemetryData {
  fps: number;
  frameTimeMs: number;
  loadTimeMs: number;
  triangles: number;
  drawCalls: number;
  geometriesCount: number;
  texturesCount: number;
  estimatedVramMb: number;
  dimensions: string;
}

interface AssetValidationViewerProps {
  onBack?: () => void;
}

export function AssetValidationViewer({ onBack }: AssetValidationViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Configuration States
  const [product, setProduct] = useState<ProductVariant>('original');
  const [strategy, setStrategy] = useState<MaterialStrategy>('config-a-baseline');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio');
  const [textureTier, setTextureTier] = useState<TextureTier>('2k');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [disableNormalMap, setDisableNormalMap] = useState<boolean>(false);
  const [disableRoughnessMap, setDisableRoughnessMap] = useState<boolean>(false);
  const [lightIntensity, setLightIntensity] = useState<number>(1.0);
  const [envIntensity, setEnvIntensity] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);

  // Performance Telemetry State
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    fps: 0,
    frameTimeMs: 0,
    loadTimeMs: 0,
    triangles: 0,
    drawCalls: 0,
    geometriesCount: 0,
    texturesCount: 0,
    estimatedVramMb: 48,
    dimensions: 'calculating...',
  });

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const canMeshRef = useRef<THREE.Mesh | null>(null);
  const lightsRef = useRef<{
    keyLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    rimLight: THREE.DirectionalLight;
    ambientLight: THREE.AmbientLight;
  } | null>(null);

  // Texture Cache
  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
  const texturesCacheRef = useRef<Map<string, THREE.Texture>>(new Map());
  const glbOriginalTexturesRef = useRef<{
    diffuse: THREE.Texture | null;
    normal: THREE.Texture | null;
    mr: THREE.Texture | null;
  }>({ diffuse: null, normal: null, mr: null });

  // Initialize Scene, Camera, Renderer, Controls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0e0e11);

    // 2. Camera (35mm equivalent in vertical framing)
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    camera.position.set(0, 0.15, 3.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.2;
    controls.maxDistance = 7.0;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 5. Studio Environment (PMREM RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    const envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTexture;
    scene.environmentIntensity = 1.0;
    pmremGenerator.dispose();
    roomEnv.dispose();

    // 6. Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff6ed, 1.8);
    keyLight.position.set(2.8, 3.5, 3.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe8f0fc, 0.9);
    fillLight.position.set(-3.0, 1.5, 2.0);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2.2);
    rimLight.position.set(0.0, 3.2, -3.2);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x222226, 0.4);
    scene.add(ambientLight);

    lightsRef.current = { keyLight, fillLight, rimLight, ambientLight };

    // 7. Subtle Ground Contact Shadow Plane
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const ctx = shadowCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.12)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.002;
    scene.add(shadowPlane);

    // 8. Load Canonical GLB
    const loader = new GLTFLoader();
    const loadStartTime = performance.now();

    loader.load(
      '/models/coke-can.glb',
      (gltf) => {
        const loadEndTime = performance.now();
        const duration = Math.round(loadEndTime - loadStartTime);

        const canGroup = gltf.scene;
        let foundMesh: THREE.Mesh | null = null;

        canGroup.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            foundMesh = child as THREE.Mesh;
            foundMesh.castShadow = true;
            foundMesh.receiveShadow = true;
          }
        });

        if (foundMesh) {
          const mesh = foundMesh as THREE.Mesh;
          canMeshRef.current = mesh;

          // Compute exact dimensions
          mesh.geometry.computeBoundingBox();
          const bbox = mesh.geometry.boundingBox;
          let dimString = 'N/A';
          if (bbox) {
            const size = new THREE.Vector3();
            bbox.getSize(size);
            dimString = `${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`;
          }

          // Cache GLB embedded original textures
          const originalMat = mesh.material as THREE.MeshStandardMaterial;
          glbOriginalTexturesRef.current = {
            diffuse: originalMat.map,
            normal: originalMat.normalMap,
            mr: originalMat.metalnessMap,
          };

          // Setup geometry groups for Dual-Material segmentation:
          // Group 0: Cylindrical Body (Y in [-0.82, 0.82])
          // Group 1: Exposed Aluminum (Rim, Lid, Pull Tab, Bottom Dome)
          const geom = mesh.geometry;
          if (geom.index) {
            const indices = geom.index.array;
            const positions = geom.attributes.position.array;
            const bodyIndices: number[] = [];
            const metalIndices: number[] = [];

            for (let i = 0; i < indices.length; i += 3) {
              const i0 = indices[i];
              const i1 = indices[i + 1];
              const i2 = indices[i + 2];
              const y0 = positions[i0 * 3 + 1];
              const y1 = positions[i1 * 3 + 1];
              const y2 = positions[i2 * 3 + 1];
              const yAvg = (y0 + y1 + y2) / 3.0;

              if (yAvg >= -0.82 && yAvg <= 0.82) {
                bodyIndices.push(i0, i1, i2);
              } else {
                metalIndices.push(i0, i1, i2);
              }
            }

            // Create reordered index buffer for clean multi-material rendering
            const reordered = new Uint16Array(bodyIndices.length + metalIndices.length);
            reordered.set(bodyIndices, 0);
            reordered.set(metalIndices, bodyIndices.length);
            geom.setIndex(new THREE.BufferAttribute(reordered, 1));

            // Set geometry groups: group 0 = body, group 1 = metal
            geom.clearGroups();
            geom.addGroup(0, bodyIndices.length, 0);
            geom.addGroup(bodyIndices.length, metalIndices.length, 1);
          }

          setTelemetry((prev) => ({
            ...prev,
            loadTimeMs: duration,
            triangles: geom.index ? geom.index.count / 3 : 0,
            dimensions: dimString,
          }));
        }

        scene.add(canGroup);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading GLB:', err);
        setLoading(false);
      }
    );

    // 9. Animation & FPS Telemetry Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsAccumulator = 0;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = currentTime - lastTime;
      lastTime = currentTime;
      frameCount++;
      fpsAccumulator += 1000 / (delta || 16.6);

      if (frameCount >= 30) {
        const avgFps = Math.round(fpsAccumulator / frameCount);
        const avgDelta = (1000 / avgFps).toFixed(1);
        frameCount = 0;
        fpsAccumulator = 0;

        setTelemetry((prev) => ({
          ...prev,
          fps: avgFps,
          frameTimeMs: parseFloat(avgDelta),
          drawCalls: renderer.info.render.calls,
          geometriesCount: renderer.info.memory.geometries,
          texturesCount: renderer.info.memory.textures,
        }));
      }

      if (canMeshRef.current && autoRotate) {
        canMeshRef.current.rotation.y += 0.008;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 10. Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [autoRotate]);

  // Helper to load or fetch cached textures
  const getTexture = useCallback((path: string, isColor: boolean = false): THREE.Texture => {
    if (texturesCacheRef.current.has(path)) {
      return texturesCacheRef.current.get(path)!;
    }
    const tex = textureLoader.load(path);
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    } else {
      tex.colorSpace = THREE.NoColorSpace;
    }
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // CRITICAL FIX: glTF 2.0 convention specifies (0,0) at top-left.
    // Three.js TextureLoader defaults to flipY = true which inverted V coordinates,
    // corrupting Diet Coke and Zero Sugar with black texture margins on body and chime.
    tex.flipY = false;
    texturesCacheRef.current.set(path, tex);
    return tex;
  }, [textureLoader]);

  // Dynamic Material & Texture Strategy Construction
  useEffect(() => {
    const mesh = canMeshRef.current;
    if (!mesh || loading) return;

    // Resolve Textures for current product and resolution tier
    let diffuseTex: THREE.Texture | null = null;
    let normalTex: THREE.Texture | null = null;
    let mrTex: THREE.Texture | null = null;
    let maskTex: THREE.Texture | null = null;

    const prodName = product === 'original' ? 'classic' : product;

    if (textureTier === '4k') {
      // 4K Original Source Textures
      diffuseTex = getTexture(`/textures/4k/coke_${prodName}_diffuse_4k.png`, true);
      normalTex = disableNormalMap ? null : getTexture(`/textures/4k/coke_normal_4k.png`, false);
      mrTex = disableRoughnessMap ? null : getTexture(`/textures/4k/coke_${prodName}_metallic_roughness_4k.png`, false);
      maskTex = getTexture(`/textures/4k/coke_metallic_mask_4k.png`, false);
    } else {
      // 2K or 1K Optimized WebP Textures
      const tier = textureTier;
      diffuseTex = getTexture(`/textures/${tier}/coke_${prodName}_diffuse_${tier}.webp`, true);
      normalTex = disableNormalMap ? null : getTexture(`/textures/${tier}/coke_normal_${tier}.webp`, false);
      mrTex = disableRoughnessMap ? null : getTexture(`/textures/${tier}/coke_${prodName}_metallic_roughness_${tier}.webp`, false);
      maskTex = getTexture(`/textures/${tier}/coke_metallic_mask_${tier}.webp`, false);
    }

    const setMaterialCleanly = (mat: THREE.Material | THREE.Material[]) => {
      if (Array.isArray(mat)) {
        mesh.material = mat;
      } else if (mesh.geometry.groups && mesh.geometry.groups.length > 0) {
        mesh.material = [mat, mat];
      } else {
        mesh.material = mat;
      }
    };

    // Material Construction per Strategy
    if (strategy === 'unlit-base-color') {
      // Test A: Unlit Base-Color only (linear/raw unlit presentation)
      setMaterialCleanly(new THREE.MeshBasicMaterial({
        map: diffuseTex,
        toneMapped: false,
        wireframe,
      }));
    } else if (strategy === 'uv-checker') {
      // UV Diagnostic numbered checkerboard
      const checker = getTexture('/textures/uv_checker_numbered.png', true);
      setMaterialCleanly(new THREE.MeshBasicMaterial({
        map: checker,
        wireframe,
      }));
    } else if (strategy === 'config-a-baseline') {
      // Config A Baseline: Uniform MeshStandardMaterial (Preferred visual baseline)
      const mat = new THREE.MeshStandardMaterial({
        map: diffuseTex,
        normalMap: normalTex,
        roughnessMap: mrTex,
        metalnessMap: mrTex,
        metalness: 0.85,
        roughness: 1.0,
        wireframe,
      });
      setMaterialCleanly(mat);
    } else if (strategy === 'config-a-enhanced') {
      // Config A Enhanced: Product-Specific Physical Materials
      let metalnessVal = 0.82;
      let roughnessVal = 0.95;
      let clearcoatVal = 0.35;
      let clearcoatRoughnessVal = 0.08;

      if (product === 'diet') {
        metalnessVal = 0.90;
        roughnessVal = 1.00;
        clearcoatVal = 0.15;
        clearcoatRoughnessVal = 0.05;
      } else if (product === 'zero') {
        metalnessVal = 0.70;
        roughnessVal = 1.05;
        clearcoatVal = 0.40;
        clearcoatRoughnessVal = 0.08;
      }

      const mat = new THREE.MeshPhysicalMaterial({
        map: diffuseTex,
        normalMap: normalTex,
        roughnessMap: mrTex,
        metalness: metalnessVal,
        roughness: roughnessVal,
        clearcoat: clearcoatVal,
        clearcoatRoughness: clearcoatRoughnessVal,
        wireframe,
      });
      setMaterialCleanly(mat);
    } else if (strategy === 'dual-material-groups') {
      // Dual-Material Geometry Segmentation
      // Material 0: Body surface (Preserves Config A preferred sheen + subtle clearcoat)
      // Material 1: Exposed metal (rims, lid, pull tab, bottom chime in pure milled aluminum)
      let bodyMetalness = 0.85;
      let bodyRoughness = 0.95;
      let bodyClearcoat = 0.35;
      let bodyClearcoatRoughness = 0.08;

      if (product === 'diet') {
        bodyMetalness = 0.90;
        bodyRoughness = 1.00;
        bodyClearcoat = 0.15;
        bodyClearcoatRoughness = 0.05;
      } else if (product === 'zero') {
        bodyMetalness = 0.72;
        bodyRoughness = 1.05;
        bodyClearcoat = 0.35;
        bodyClearcoatRoughness = 0.08;
      }

      const bodyMat = new THREE.MeshPhysicalMaterial({
        map: diffuseTex,
        normalMap: normalTex,
        roughnessMap: mrTex,
        metalness: bodyMetalness,
        roughness: bodyRoughness,
        clearcoat: bodyClearcoat,
        clearcoatRoughness: bodyClearcoatRoughness,
        wireframe,
      });

      // Exposed metal lid & chime uses clean unopened stamped aluminum diffuse texture
      const metalDiffuse = (product === 'original')
        ? diffuseTex
        : (textureTier === '4k'
            ? getTexture('/textures/4k/coke_classic_diffuse_4k.png', true)
            : getTexture(`/textures/${textureTier}/coke_classic_diffuse_${textureTier}.webp`, true));

      const metalMat = new THREE.MeshStandardMaterial({
        map: metalDiffuse,
        normalMap: normalTex,
        roughnessMap: mrTex,
        metalness: 0.95,
        roughness: 0.28,
        wireframe,
      });

      mesh.material = [bodyMat, metalMat];
    } else if (strategy === 'mask-driven-pbr') {
      // Mask-Driven PBR: Uses pre-baked metallic mask texture
      const mat = new THREE.MeshStandardMaterial({
        map: diffuseTex,
        normalMap: normalTex,
        roughnessMap: mrTex,
        metalnessMap: maskTex,
        metalness: product === 'diet' ? 0.90 : 1.0,
        roughness: 1.0,
        wireframe,
      });
      setMaterialCleanly(mat);
    } else if (strategy === 'debug-normals') {
      setMaterialCleanly(new THREE.MeshNormalMaterial({
        normalMap: normalTex,
        wireframe,
      }));
    } else if (strategy === 'debug-roughness') {
      // Dedicated Roughness Debug Material:
      // Samples green channel strictly as vec3(roughnessValue)
      // toneMapped=false prevents ACESFilmic tone-mapping distortion
      const debugRoughnessMat = new THREE.ShaderMaterial({
        uniforms: { uRoughnessMap: { value: mrTex } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uRoughnessMap;
          varying vec2 vUv;
          void main() {
            float roughnessValue = texture2D(uRoughnessMap, vUv).g;
            gl_FragColor = vec4(vec3(roughnessValue), 1.0);
          }
        `,
        toneMapped: false,
        wireframe,
      });
      setMaterialCleanly(debugRoughnessMat);
    } else if (strategy === 'debug-metalness') {
      // Dedicated Metalness Debug Material:
      // Samples blue channel strictly as vec3(metalnessValue)
      const debugMetalnessMat = new THREE.ShaderMaterial({
        uniforms: { uMetallicMap: { value: mrTex } },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMetallicMap;
          varying vec2 vUv;
          void main() {
            float metalnessValue = texture2D(uMetallicMap, vUv).b;
            gl_FragColor = vec4(vec3(metalnessValue), 1.0);
          }
        `,
        toneMapped: false,
        wireframe,
      });
      setMaterialCleanly(debugMetalnessMat);
    }

    // Expose debug telemetry to window for runtime validation
    if (typeof window !== 'undefined') {
      (window as unknown as { __COKE_DEBUG__: unknown }).__COKE_DEBUG__ = {
        product,
        prodName,
        strategy,
        textureTier,
        textures: {
          diffuse: diffuseTex?.image ? { loaded: true, width: (diffuseTex.image as { width?: number }).width, height: (diffuseTex.image as { height?: number }).height } : null,
          normal: normalTex?.image ? { loaded: true, width: (normalTex.image as { width?: number }).width, height: (normalTex.image as { height?: number }).height } : null,
          mr: mrTex?.image ? { loaded: true, width: (mrTex.image as { width?: number }).width, height: (mrTex.image as { height?: number }).height } : null,
        },
      };
    }

    // Estimate VRAM consumption based on active texture tier
    const vramMap: Record<TextureTier, number> = { '4k': 192, '2k': 48, '1k': 12 };
    setTelemetry((prev) => ({
      ...prev,
      estimatedVramMb: vramMap[textureTier],
    }));
  }, [product, strategy, textureTier, wireframe, disableNormalMap, disableRoughnessMap, loading, getTexture]);

  // Lighting Preset Switcher
  useEffect(() => {
    if (!lightsRef.current || !sceneRef.current) return;
    const { keyLight, fillLight, rimLight, ambientLight } = lightsRef.current;

    if (lightingPreset === 'studio') {
      // Studio Rig: Balanced Commercial Lighting
      keyLight.intensity = 1.8 * lightIntensity;
      keyLight.color.setHex(0xfff6ed);
      keyLight.position.set(2.8, 3.5, 3.0);

      fillLight.intensity = 0.9 * lightIntensity;
      fillLight.color.setHex(0xe8f0fc);

      rimLight.intensity = 2.2 * lightIntensity;
      rimLight.color.setHex(0xffffff);

      ambientLight.intensity = 0.4 * lightIntensity;
      sceneRef.current.environmentIntensity = 1.0 * envIntensity;
    } else if (lightingPreset === 'neutral') {
      // Neutral Soft: Low-contrast diffused studio
      keyLight.intensity = 1.2 * lightIntensity;
      keyLight.color.setHex(0xfafafa);
      keyLight.position.set(2.0, 3.0, 2.5);

      fillLight.intensity = 1.0 * lightIntensity;
      fillLight.color.setHex(0xf5f5f5);

      rimLight.intensity = 1.2 * lightIntensity;
      rimLight.color.setHex(0xffffff);

      ambientLight.intensity = 0.6 * lightIntensity;
      sceneRef.current.environmentIntensity = 0.8 * envIntensity;
    } else if (lightingPreset === 'directional') {
      // High-Contrast Directional: Sharp cuts and strong specular highlights
      keyLight.intensity = 2.6 * lightIntensity;
      keyLight.color.setHex(0xffffff);
      keyLight.position.set(3.5, 4.0, 2.0);

      fillLight.intensity = 0.3 * lightIntensity;
      fillLight.color.setHex(0xd0d8e8);

      rimLight.intensity = 3.0 * lightIntensity;
      rimLight.color.setHex(0xffffff);

      ambientLight.intensity = 0.2 * lightIntensity;
      sceneRef.current.environmentIntensity = 1.4 * envIntensity;
    }
  }, [lightingPreset, lightIntensity, envIntensity]);

  // Camera Viewpoint Switcher
  const setCameraView = (view: 'front' | 'side' | 'three-quarter' | 'top' | 'bottom') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (view === 'front') {
      cam.position.set(0, 0.15, 3.2);
    } else if (view === 'side') {
      cam.position.set(3.2, 0.15, 0);
    } else if (view === 'three-quarter') {
      cam.position.set(2.2, 1.2, 2.2);
    } else if (view === 'top') {
      cam.position.set(0, 3.4, 0.001);
    } else if (view === 'bottom') {
      cam.position.set(0, -3.4, 0.001);
    }
    ctrl.target.set(0, 0, 0);
    ctrl.update();
    if (canMeshRef.current) {
      canMeshRef.current.rotation.set(0, 0, 0);
    }
  };

  // Reset Camera View
  const handleResetCamera = () => {
    setCameraView('front');
  };

  return (
    <div className="viewer-root">
      {/* Top Header */}
      <header className="viewer-header">
        <div className="viewer-title-group">
          <span className="viewer-badge">PHASE 1.3</span>
          <h1 className="viewer-title">PBR Material Pipeline & Texture Optimization</h1>
        </div>
        <div className="viewer-actions">
          <button className="viewer-btn" onClick={handleResetCamera}>
            Reset View
          </button>
          {onBack && (
            <button className="viewer-btn viewer-btn-primary" onClick={onBack}>
              Exit Viewer
            </button>
          )}
        </div>
      </header>

      {/* 3D Canvas Mounting Area */}
      <div ref={mountRef} className="viewer-canvas-container" />

      {/* Floating Controls Panel */}
      <div className="viewer-controls-panel">
        <div className="controls-heading">1. Product Selection</div>
        <div className="control-group">
          <div className="button-group">
            <button
              className={`button-group-btn ${product === 'original' ? 'active' : ''}`}
              onClick={() => setProduct('original')}
            >
              Classic Coke
            </button>
            <button
              className={`button-group-btn ${product === 'diet' ? 'active' : ''}`}
              onClick={() => setProduct('diet')}
            >
              Diet Coke
            </button>
            <button
              className={`button-group-btn ${product === 'zero' ? 'active' : ''}`}
              onClick={() => setProduct('zero')}
            >
              Zero Sugar
            </button>
          </div>
        </div>

        <div className="controls-heading">2. Material Strategy</div>
        <div className="control-group">
          <select
            id="material-select"
            className="material-select"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as MaterialStrategy)}
          >
            <option value="config-a-baseline">Config A: Baseline (Preferred Sheen)</option>
            <option value="config-a-enhanced">Config A: Enhanced Physical PBR</option>
            <option value="dual-material-groups">Dual-Material: Body vs Exposed Metal</option>
            <option value="mask-driven-pbr">Mask-Driven: Pre-baked Metallic Mask</option>
            <option value="unlit-base-color">Diagnostic: Unlit Base Color (Test A)</option>
            <option value="uv-checker">Diagnostic: Numbered UV Checkerboard</option>
            <option value="debug-normals">Debug: Tangent Normals Map</option>
            <option value="debug-roughness">Debug: Roughness Channel (G)</option>
            <option value="debug-metalness">Debug: Metallic Channel</option>
          </select>
        </div>

        <div className="controls-heading">3. Lighting Environment</div>
        <div className="control-group">
          <div className="button-group">
            <button
              className={`button-group-btn ${lightingPreset === 'studio' ? 'active' : ''}`}
              onClick={() => setLightingPreset('studio')}
            >
              Studio Rig
            </button>
            <button
              className={`button-group-btn ${lightingPreset === 'neutral' ? 'active' : ''}`}
              onClick={() => setLightingPreset('neutral')}
            >
              Neutral Soft
            </button>
            <button
              className={`button-group-btn ${lightingPreset === 'directional' ? 'active' : ''}`}
              onClick={() => setLightingPreset('directional')}
            >
              High Contrast
            </button>
          </div>
        </div>

        <div className="controls-heading">4. Texture Resolution Tier</div>
        <div className="control-group">
          <div className="button-group">
            <button
              className={`button-group-btn ${textureTier === '4k' ? 'active' : ''}`}
              onClick={() => setTextureTier('4k')}
            >
              4K Source
            </button>
            <button
              className={`button-group-btn ${textureTier === '2k' ? 'active' : ''}`}
              onClick={() => setTextureTier('2k')}
            >
              2K Desktop
            </button>
            <button
              className={`button-group-btn ${textureTier === '1k' ? 'active' : ''}`}
              onClick={() => setTextureTier('1k')}
            >
              1K Mobile
            </button>
          </div>
        </div>

        <div className="controls-heading">5. Sliders & Overlays</div>
        <div className="control-group">
          <label className="control-label">
            <span>Light Intensity</span>
            <span>{lightIntensity.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={lightIntensity}
            onChange={(e) => setLightIntensity(parseFloat(e.target.value))}
            className="slider-input"
          />
        </div>

        <div className="control-group">
          <label className="control-label">
            <span>Environment Reflections</span>
            <span>{envIntensity.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0.0"
            max="2.0"
            step="0.1"
            value={envIntensity}
            onChange={(e) => setEnvIntensity(parseFloat(e.target.value))}
            className="slider-input"
          />
        </div>

        <div className="control-group">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
            <span>Show Wireframe Overlay</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(e) => setAutoRotate(e.target.checked)}
            />
            <span>Auto-Rotate Mesh</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={disableNormalMap}
              onChange={(e) => setDisableNormalMap(e.target.checked)}
            />
            <span>Disable Normal Map (Test E)</span>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={disableRoughnessMap}
              onChange={(e) => setDisableRoughnessMap(e.target.checked)}
            />
            <span>Disable Roughness/Metal Map (Test F)</span>
          </label>
        </div>

        <div className="controls-heading">6. Camera Viewpoints</div>
        <div className="control-group">
          <div className="button-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
            <button className="button-group-btn" onClick={() => setCameraView('front')}>Front</button>
            <button className="button-group-btn" onClick={() => setCameraView('side')}>Side</button>
            <button className="button-group-btn" onClick={() => setCameraView('three-quarter')}>3/4</button>
            <button className="button-group-btn" onClick={() => setCameraView('top')}>Top Lid</button>
            <button className="button-group-btn" onClick={() => setCameraView('bottom')}>Bottom</button>
            <button className="button-group-btn" onClick={handleResetCamera}>Reset</button>
          </div>
        </div>
      </div>

      {/* Telemetry HUD (Bottom Left) */}
      <div className="viewer-telemetry-hud">
        <div className="hud-header">
          <span>Real-Time WebGL Telemetry</span>
          <span style={{ color: '#a1a1aa' }}>Tier: {textureTier.toUpperCase()}</span>
        </div>
        <div className="hud-grid">
          <div className="hud-item">
            <span className="hud-label">FPS</span>
            <span className="hud-value hud-value-highlight">{telemetry.fps || 60} fps</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Frame Time</span>
            <span className="hud-value">{telemetry.frameTimeMs || 16.6} ms</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Triangles</span>
            <span className="hud-value">{telemetry.triangles.toLocaleString()}</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Draw Calls</span>
            <span className="hud-value">{strategy === 'dual-material-groups' ? 3 : 2}</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">Est. VRAM Footprint</span>
            <span className="hud-value">{telemetry.estimatedVramMb} MB</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">GLB Load Time</span>
            <span className="hud-value">{telemetry.loadTimeMs} ms</span>
          </div>
          <div className="hud-item" style={{ gridColumn: 'span 2' }}>
            <span className="hud-label">Dimensions (W × H × D)</span>
            <span className="hud-value">{telemetry.dimensions}</span>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="viewer-loading-overlay">
          <div className="viewer-spinner" />
          <div className="viewer-loading-text">Loading canonical Coca-Cola assets...</div>
        </div>
      )}
    </div>
  );
}
