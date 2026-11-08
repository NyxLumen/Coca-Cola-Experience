import * as THREE from 'three';
import { createRealityBMaterial, type RealityTextures } from './materials';
import {
  createStudioCycloramaMesh,
  createCausticGlowMesh,
  createCampaignContactShadow,
  createStudioBackgroundTexture,
} from './environments';

export class RealityB {
  public scene: THREE.Scene;
  public canMesh: THREE.Mesh;
  public cyclorama: THREE.Mesh;
  public causticGlow: THREE.Mesh;
  public contactShadow: THREE.Mesh;
  public material: THREE.MeshPhysicalMaterial;
  private bgTexture: THREE.CanvasTexture;

  // Commercial Studio Lighting Rig
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private rimLightTop: THREE.DirectionalLight;
  private rimLightFlank: THREE.DirectionalLight;
  private specularStrip: THREE.DirectionalLight;
  private backdropSpot: THREE.SpotLight;
  private ambientLight: THREE.AmbientLight;
  private stageAmbient: THREE.AmbientLight;

  constructor(
    canonicalGeometry: THREE.BufferGeometry,
    textures: RealityTextures,
    envTexture: THREE.Texture
  ) {
    this.scene = new THREE.Scene();
    this.scene.name = 'RealityB_DietCoke';

    // 1. Dedicated Bright Platinum Silver Background Texture
    this.bgTexture = createStudioBackgroundTexture('diet');
    this.scene.background = this.bgTexture;

    // 2. Dedicated PMREM Studio Environment Reflections (Cool Silver & Neutral Softboxes)
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 1.20;

    // 3. Seamless Brushed Platinum Silver Cyclorama Infinity Cove (NOT plain white!)
    this.cyclorama = createStudioCycloramaMesh('diet');
    this.cyclorama.layers.set(1);
    this.scene.add(this.cyclorama);

    // 4. Luminous Platinum Liquid Light Caustic Pool
    this.causticGlow = createCausticGlowMesh('diet');
    this.causticGlow.layers.set(0);
    this.scene.add(this.causticGlow);

    // 5. Multi-Lobe Campaign Grounding Shadow (Graphite Tint)
    this.contactShadow = createCampaignContactShadow('diet');
    this.contactShadow.layers.set(0);
    this.scene.add(this.contactShadow);

    // 6. Canonical PBR Can Mesh with Identical Dynamic Hero Orientation
    this.material = createRealityBMaterial(textures);
    this.canMesh = new THREE.Mesh(canonicalGeometry, this.material);
    this.canMesh.name = 'CokeCan_RealityB';
    this.canMesh.castShadow = true;
    this.canMesh.receiveShadow = true;
    this.canMesh.layers.set(0);

    // Exact identical transform as Reality A ensuring seamless fluid composite
    this.canMesh.position.set(0.0, 0.05, 0.0);
    this.canMesh.rotation.set(0.06, 0.38, -0.19);
    this.canMesh.scale.set(1.0, 1.0, 1.0);
    this.scene.add(this.canMesh);

    // 7. High-Clarity Commercial Lighting Rig
    // Product Key Light: Clean neutral white key revealing brushed aluminum form
    this.keyLight = new THREE.DirectionalLight(0xf5f8fc, 2.4);
    this.keyLight.position.set(1.8, 3.2, 3.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.normalBias = 0.015;

    // Matching tuned shadow frustum
    const shadowD = 1.25;
    this.keyLight.shadow.camera.left = -shadowD;
    this.keyLight.shadow.camera.right = shadowD;
    this.keyLight.shadow.camera.top = shadowD * 1.15;
    this.keyLight.shadow.camera.bottom = -shadowD * 1.15;
    this.keyLight.shadow.camera.near = 1.6;
    this.keyLight.shadow.camera.far = 8.8;
    this.keyLight.shadow.camera.updateProjectionMatrix();
    this.keyLight.layers.set(0);
    this.scene.add(this.keyLight);

    // Backdrop Spotlight: Positioned on Layer 1 illuminating ONLY the cyclorama wall behind the can
    // Soft, broad cool platinum diffused aura (NO harsh white hotspot!)
    this.backdropSpot = new THREE.SpotLight(0xa8b8c8, 0.25, 20, Math.PI / 1.7, 1.0);
    this.backdropSpot.position.set(0.0, 0.6, -0.6);
    this.backdropSpot.target.position.set(0.0, 0.8, -3.5);
    this.backdropSpot.layers.set(1);
    this.scene.add(this.backdropSpot);
    this.scene.add(this.backdropSpot.target);

    // Stage Ambient: Dedicated soft ambient on Layer 1 for cyclorama texture clarity
    this.stageAmbient = new THREE.AmbientLight(0xffffff, 0.28);
    this.stageAmbient.layers.set(1);
    this.scene.add(this.stageAmbient);

    // Fill Light: Soft cool slate-blue fill preventing muddy darks and eliminating center trough
    this.fillLight = new THREE.DirectionalLight(0xcfdce8, 1.3);
    this.fillLight.position.set(-1.8, 1.8, 3.0);
    this.fillLight.layers.set(0);
    this.scene.add(this.fillLight);

    // Rim Light Top: Pure razor-white top rim defining lid, tab, and shoulder
    this.rimLightTop = new THREE.DirectionalLight(0xffffff, 2.8);
    this.rimLightTop.position.set(0.0, 3.8, -2.5);
    this.rimLightTop.layers.set(0);
    this.scene.add(this.rimLightTop);

    // Specular Strip: Crisp vertical highlight down cylinder flank
    this.specularStrip = new THREE.DirectionalLight(0xffffff, 1.8);
    this.specularStrip.position.set(3.2, 0.1, 0.8);
    this.specularStrip.layers.set(0);
    this.scene.add(this.specularStrip);

    // Flank Kicker: Ice-platinum kicker defining left silhouette
    this.rimLightFlank = new THREE.DirectionalLight(0xd0e0f2, 1.2);
    this.rimLightFlank.position.set(-3.2, 0.0, -1.0);
    this.rimLightFlank.layers.set(0);
    this.scene.add(this.rimLightFlank);

    // Ambient: Clean cool silver bounce lighting
    this.ambientLight = new THREE.AmbientLight(0x282e38, 0.45);
    this.ambientLight.layers.set(0);
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
    this.bgTexture.dispose();
    this.stageAmbient.dispose();
    this.cyclorama.geometry.dispose();
    if (Array.isArray(this.cyclorama.material)) {
      this.cyclorama.material.forEach((m) => m.dispose());
    } else {
      this.cyclorama.material.dispose();
    }
    this.causticGlow.geometry.dispose();
    (this.causticGlow.material as THREE.Material).dispose();
    this.contactShadow.geometry.dispose();
    if (Array.isArray(this.contactShadow.material)) {
      this.contactShadow.material.forEach((m) => m.dispose());
    } else {
      this.contactShadow.material.dispose();
    }
  }
}
