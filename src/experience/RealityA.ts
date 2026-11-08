import * as THREE from 'three';
import { createRealityAMaterial, createContactShadowMesh, type RealityTextures } from './materials';

export class RealityA {
  public scene: THREE.Scene;
  public canMesh: THREE.Mesh;
  public contactShadow: THREE.Mesh;
  public material: THREE.MeshPhysicalMaterial;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  constructor(
    canonicalGeometry: THREE.BufferGeometry,
    textures: RealityTextures,
    envTexture: THREE.Texture
  ) {
    this.scene = new THREE.Scene();
    this.scene.name = 'RealityA_OriginalCoke';

    // 1. Cinematic Deep Crimson Background
    this.scene.background = new THREE.Color(0x380407);

    // 2. Environment Reflections
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.95;

    // 3. PBR Can Mesh with Original Coke Material
    this.material = createRealityAMaterial(textures);
    this.canMesh = new THREE.Mesh(canonicalGeometry, this.material);
    this.canMesh.name = 'CokeCan_RealityA';
    this.canMesh.castShadow = true;
    this.canMesh.receiveShadow = true;
    // Stationed at canonical origin
    this.canMesh.position.set(0, 0, 0);
    this.canMesh.rotation.set(0, 0, 0);
    this.canMesh.scale.set(1, 1, 1);
    this.scene.add(this.canMesh);

    // 4. Contact Shadow
    this.contactShadow = createContactShadowMesh();
    this.contactShadow.name = 'ContactShadow_RealityA';
    this.scene.add(this.contactShadow);

    // 5. Warm Cinematic Lighting Rig
    // Key Light: Warm ivory key illuminating the front branding
    this.keyLight = new THREE.DirectionalLight(0xfff2e6, 2.0);
    this.keyLight.position.set(2.8, 3.5, 3.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.normalBias = 0.015;

    // Phase 2D: Tighten shadow camera frustum to fit can bounds (16x effective texel density)
    const shadowD = 1.1;
    this.keyLight.shadow.camera.left = -shadowD;
    this.keyLight.shadow.camera.right = shadowD;
    this.keyLight.shadow.camera.top = shadowD * 1.15;
    this.keyLight.shadow.camera.bottom = -shadowD * 1.15;
    this.keyLight.shadow.camera.near = 1.8;
    this.keyLight.shadow.camera.far = 8.5;
    this.keyLight.shadow.camera.updateProjectionMatrix();

    this.scene.add(this.keyLight);

    // Fill Light: Warm rose/crimson fill maintaining soft shadow contrast
    this.fillLight = new THREE.DirectionalLight(0xff8888, 1.1);
    this.fillLight.position.set(-3.0, 1.5, 2.0);
    this.scene.add(this.fillLight);

    // Rim Light: Vivid crimson specular rim carving out the aluminum silhouette
    this.rimLight = new THREE.DirectionalLight(0xff4a4a, 2.8);
    this.rimLight.position.set(0.0, 3.2, -3.2);
    this.scene.add(this.rimLight);

    // Ambient: Controlled dark crimson ambient fill
    this.ambientLight = new THREE.AmbientLight(0x450808, 0.7);
    this.scene.add(this.ambientLight);
  }

  public updateMaterialTextures(textures: RealityTextures): void {
    this.material.map = textures.diffuse;
    this.material.normalMap = textures.normal;
    this.material.roughnessMap = textures.metallicRoughness;
    this.material.metalnessMap = textures.metallicRoughness;
    this.material.needsUpdate = true;
  }

  public dispose(): void {
    this.material.dispose();
    if (this.contactShadow.geometry) this.contactShadow.geometry.dispose();
    if (Array.isArray(this.contactShadow.material)) {
      this.contactShadow.material.forEach((m) => m.dispose());
    } else {
      this.contactShadow.material.dispose();
    }
  }
}
