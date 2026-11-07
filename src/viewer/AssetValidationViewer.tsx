import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './AssetValidationViewer.css';

export type MaterialMode =
  | 'default-gltf'
  | 'uniform-lacquer'
  | 'derived-dual-pbr'
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
  dimensions: string;
}

interface AssetValidationViewerProps {
  onBack?: () => void;
}

export function AssetValidationViewer({ onBack }: AssetValidationViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [materialMode, setMaterialMode] = useState<MaterialMode>('derived-dual-pbr');
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [lightIntensity, setLightIntensity] = useState<number>(1.2);
  const [envIntensity, setEnvIntensity] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    fps: 0,
    frameTimeMs: 0,
    loadTimeMs: 0,
    triangles: 0,
    drawCalls: 0,
    geometriesCount: 0,
    texturesCount: 0,
    dimensions: 'calculating...',
  });

  // Mutable refs to Three.js objects for real-time reactivity without full re-mounts
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
  const materialsCacheRef = useRef<Map<MaterialMode, THREE.Material>>(new Map());

  // Setup Three.js Scene, Camera, Renderer, Controls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0e0e11);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
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

    // 7. Subtle Contact Shadow Plane
    // Generate soft radial gradient texture for the contact shadow
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
    shadowPlane.position.y = -1.002; // Placed right below the base at y = -1.000
    scene.add(shadowPlane);

    // 8. Model Loading with GLTFLoader
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

          // Build Materials Cache
          const defaultMat = mesh.material as THREE.MeshStandardMaterial;
          const diffuseMap = defaultMat.map;
          const normalMap = defaultMat.normalMap;
          const mrMap = defaultMat.metalnessMap;

          materialsCacheRef.current.set('default-gltf', defaultMat);

          // Config B: Uniform Dielectric Clearcoat
          const lacquerMat = new THREE.MeshPhysicalMaterial({
            map: diffuseMap,
            normalMap: normalMap,
            roughnessMap: mrMap,
            metalness: 0.08,
            roughness: 0.16,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
            reflectivity: 0.5,
          });
          materialsCacheRef.current.set('uniform-lacquer', lacquerMat);

          // Config C: Derived Dual-PBR (Shader-level separation of Painted Lacquer vs Exposed Aluminum)
          const dualPbrMat = new THREE.MeshPhysicalMaterial({
            map: diffuseMap,
            normalMap: normalMap,
            roughnessMap: mrMap,
            metalness: 1.0,
            roughness: 1.0,
            clearcoat: 1.0,
            clearcoatRoughness: 0.08,
          });

          // Inject custom chrominance logic in GLSL fragment shader
          dualPbrMat.onBeforeCompile = (shader) => {
            // Modify fragment shader to calculate chrominance on the fly
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <roughnessmap_fragment>',
              `
              #include <roughnessmap_fragment>
              // Sample base diffuse color to isolate red body paint from aluminum surfaces
              vec4 colSample = texture2D(map, vMapUv);
              float redness = colSample.r - max(colSample.g, colSample.b);
              float isPaint = smoothstep(0.12, 0.32, redness);
              
              // Paint: smooth clearcoat lacquer over ink (low roughness)
              // Metal: brushed aluminum with slightly higher microscopic scatter
              roughnessFactor = mix(clamp(roughnessFactor * 1.45 + 0.10, 0.0, 1.0), roughnessFactor * 0.95, isPaint);
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <metalnessmap_fragment>',
              `
              #include <metalnessmap_fragment>
              // Where isPaint == 1.0: metalness = 0.04 (dielectric lacquer)
              // Where isPaint == 0.0: metalness = 0.94 (exposed aluminum lid, rim, chime)
              metalnessFactor = mix(0.94, 0.04, isPaint);
              `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <clearcoat_fragment>',
              `
              #include <clearcoat_fragment>
              // Clearcoat applied only to the painted body, disabled on bare metal
              clearcoat = mix(0.0, 1.0, isPaint);
              clearcoatRoughness = 0.07;
              `
            );
          };
          materialsCacheRef.current.set('derived-dual-pbr', dualPbrMat);

          // Config D: Debug Normals
          const normalsMat = new THREE.MeshNormalMaterial({
            normalMap: normalMap,
          });
          materialsCacheRef.current.set('debug-normals', normalsMat);

          // Config E: Debug Roughness (Shader visualizing roughness grayscale)
          const roughnessDebugMat = new THREE.ShaderMaterial({
            uniforms: {
              uRoughnessMap: { value: mrMap },
            },
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
                // glTF roughness is stored in the GREEN channel
                float r = texture2D(uRoughnessMap, vUv).g;
                gl_FragColor = vec4(vec3(r), 1.0);
              }
            `,
          });
          materialsCacheRef.current.set('debug-roughness', roughnessDebugMat);

          // Config F: Debug Metalness (Shader visualizing derived metalness)
          const metalnessDebugMat = new THREE.ShaderMaterial({
            uniforms: {
              uDiffuseMap: { value: diffuseMap },
            },
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform sampler2D uDiffuseMap;
              varying vec2 vUv;
              void main() {
                vec4 col = texture2D(uDiffuseMap, vUv);
                float isPaint = smoothstep(0.12, 0.32, col.r - max(col.g, col.b));
                float metalness = mix(0.94, 0.04, isPaint);
                gl_FragColor = vec4(vec3(metalness), 1.0);
              }
            `,
          });
          materialsCacheRef.current.set('debug-metalness', metalnessDebugMat);

          // Apply initially selected material
          mesh.material = dualPbrMat;

          // Record initial telemetry
          setTelemetry((prev) => ({
            ...prev,
            loadTimeMs: duration,
            triangles: mesh.geometry.index ? mesh.geometry.index.count / 3 : 0,
            dimensions: dimString,
          }));
        }

        scene.add(canGroup);
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Error loading GLB:', error);
        setLoading(false);
      }
    );

    // 9. Render & Animation Loop with FPS Telemetry
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

      // Auto-rotation if enabled
      if (canMeshRef.current && autoRotate) {
        canMeshRef.current.rotation.y += 0.008;
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // 10. Responsive resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
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

  // Update Material Configuration dynamically
  useEffect(() => {
    const mesh = canMeshRef.current;
    if (!mesh) return;

    const selectedMat = materialsCacheRef.current.get(materialMode);
    if (selectedMat) {
      mesh.material = selectedMat;
      if ('wireframe' in selectedMat) {
        (selectedMat as THREE.MeshStandardMaterial).wireframe = wireframe;
      }
      selectedMat.needsUpdate = true;
    }
  }, [materialMode, wireframe]);

  // Update Light Intensities dynamically
  useEffect(() => {
    if (!lightsRef.current) return;
    const { keyLight, fillLight, rimLight, ambientLight } = lightsRef.current;
    keyLight.intensity = 1.8 * lightIntensity;
    fillLight.intensity = 0.9 * lightIntensity;
    rimLight.intensity = 2.2 * lightIntensity;
    ambientLight.intensity = 0.4 * lightIntensity;
  }, [lightIntensity]);

  // Update Environment Reflection Intensity
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.environmentIntensity = envIntensity;
    }
  }, [envIntensity]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0.15, 3.2);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    if (canMeshRef.current) {
      canMeshRef.current.rotation.set(0, 0, 0);
    }
  };

  return (
    <div className="viewer-root">
      {/* Top Header */}
      <header className="viewer-header">
        <div className="viewer-title-group">
          <span className="viewer-badge">PHASE 1.2</span>
          <h1 className="viewer-title">Three.js Real-Time Asset Validation</h1>
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
        <div className="controls-heading">Material & Shader Config</div>

        <div className="control-group">
          <label className="control-label" htmlFor="material-select">
            <span>Configuration Mode</span>
          </label>
          <select
            id="material-select"
            className="material-select"
            value={materialMode}
            onChange={(e) => setMaterialMode(e.target.value as MaterialMode)}
          >
            <option value="derived-dual-pbr">Config C: Derived Dual-PBR (Recommended)</option>
            <option value="default-gltf">Config A: Default glTF (Metallic 0.85)</option>
            <option value="uniform-lacquer">Config B: Uniform Lacquer (Clearcoat)</option>
            <option value="debug-normals">Debug: Tangent Normals</option>
            <option value="debug-roughness">Debug: Roughness Channel (G)</option>
            <option value="debug-metalness">Debug: Derived Metalness Mask</option>
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">
            <span>Lighting Multiplier</span>
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
        </div>
      </div>

      {/* Telemetry HUD (Bottom Left) */}
      <div className="viewer-telemetry-hud">
        <div className="hud-header">Real-Time WebGL Telemetry</div>
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
            <span className="hud-value">{telemetry.drawCalls || 2}</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">GLB Load Time</span>
            <span className="hud-value">{telemetry.loadTimeMs} ms</span>
          </div>
          <div className="hud-item">
            <span className="hud-label">GPU Textures</span>
            <span className="hud-value">{telemetry.texturesCount}</span>
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
          <div className="viewer-loading-text">Loading coke-can.glb into Three.js...</div>
        </div>
      )}
    </div>
  );
}
