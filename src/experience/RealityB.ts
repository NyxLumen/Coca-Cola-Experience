import * as THREE from 'three';
import { createRealityBMaterial, createContactShadowMesh, type RealityTextures } from './materials';

export class RealityB {
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
    this.scene.name = 'RealityB_DietCoke';

    // 1. Cool Metallic Slate Background
    this.scene.background = new THREE.Color(0x181a1f);

    // 2. Controlled Environment Reflections for Machined Aluminum
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 1.05;

    // 3. PBR Can Mesh with Diet Coke Material (Sharing Canonical Geometry)
    this.material = createRealityBMaterial(textures);
    this.canMesh = new THREE.Mesh(canonicalGeometry, this.material);
    this.canMesh.name = 'CokeCan_RealityB';
    this.canMesh.castShadow = true;
    this.canMesh.receiveShadow = true;
    // Stationed at exact identical world-space transform as Reality A
    this.canMesh.position.set(0, 0, 0);
    this.canMesh.rotation.set(0, 0, 0);
    this.canMesh.scale.set(1, 1, 1);
    this.scene.add(this.canMesh);

    // 4. Contact Shadow (Identical placement and scale)
    this.contactShadow = createContactShadowMesh();
    this.contactShadow.name = 'ContactShadow_RealityB';
    this.scene.add(this.contactShadow);

    // 5. Crisp Metallic Studio Lighting Rig
    // Key Light: High-clarity neutral cool key
    this.keyLight = new THREE.DirectionalLight(0xf4f7fa, 1.9);
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

    // Fill Light: Soft cool-blue ambient fill to prevent pitch shadows on aluminum
    this.fillLight = new THREE.DirectionalLight(0xd4e0ec, 1.0);
    this.fillLight.position.set(-3.0, 1.5, 2.0);
    this.scene.add(this.fillLight);

    // Rim Light: Pure white razor specular rim accentuating cylindrical silhouette
    this.rimLight = new THREE.DirectionalLight(0xffffff, 3.0);
    this.rimLight.position.set(0.0, 3.2, -3.2);
    this.scene.add(this.rimLight);

    // Ambient: Cool charcoal ambient fill
    this.ambientLight = new THREE.AmbientLight(0x1c2128, 0.6);
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
