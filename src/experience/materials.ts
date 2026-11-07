import * as THREE from 'three';

export interface RealityTextures {
  diffuse: THREE.Texture;
  normal: THREE.Texture;
  metallicRoughness: THREE.Texture;
}

export function createRealityAMaterial(textures: RealityTextures): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    name: 'RealityA_ClassicCoke_Material',
    map: textures.diffuse,
    normalMap: textures.normal,
    roughnessMap: textures.metallicRoughness,
    metalnessMap: textures.metallicRoughness,
    metalness: 0.85,
    roughness: 1.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.08,
  });
}

export function createRealityBMaterial(textures: RealityTextures): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    name: 'RealityB_DietCoke_Material',
    map: textures.diffuse,
    normalMap: textures.normal,
    roughnessMap: textures.metallicRoughness,
    metalnessMap: textures.metallicRoughness,
    metalness: 0.90,
    roughness: 1.0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.05,
  });
}

export function createContactShadowMesh(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });

  const mesh = new THREE.Mesh(shadowGeo, shadowMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.002;
  return mesh;
}
