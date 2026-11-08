import * as THREE from 'three';
import { createRealityAMaterial, type RealityTextures } from './materials';
import {
  createStudioCycloramaMesh,
  createCausticGlowMesh,
  createCampaignContactShadow,
  createStudioBackgroundTexture,
} from './environments';

export class RealityA {
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
    this.scene.name = 'RealityA_OriginalCoke';

    // 1. Dedicated Saturated Crimson Studio Background Texture
    this.bgTexture = createStudioBackgroundTexture('classic');
    this.scene.background = this.bgTexture;

    // 2. Dedicated PMREM Studio Environment Reflections (Clean White Softboxes & Red Floor Bounce)
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 1.20;

    // 3. Seamless Rich Multi-Tonal Coca-Cola Red Cyclorama Infinity Cove
    this.cyclorama = createStudioCycloramaMesh('classic');
    this.cyclorama.layers.set(1);
    this.scene.add(this.cyclorama);

    // 4. Luminous Red Liquid Light Caustic Pool
    this.causticGlow = createCausticGlowMesh('classic');
    this.causticGlow.layers.set(0);
    this.scene.add(this.causticGlow);

    // 5. Multi-Lobe Campaign Grounding Shadow
    this.contactShadow = createCampaignContactShadow('classic');
    this.contactShadow.layers.set(0);
    this.scene.add(this.contactShadow);

    // 6. Canonical PBR Can Mesh with Dynamic Commercial Hero Orientation
    this.material = createRealityAMaterial(textures);
    this.canMesh = new THREE.Mesh(canonicalGeometry, this.material);
    this.canMesh.name = 'CokeCan_RealityA';
    this.canMesh.castShadow = true;
    this.canMesh.receiveShadow = true;
    this.canMesh.layers.set(0);

    // Dynamic campaign tilt presenting the Spencerian script heroically
    this.canMesh.position.set(0.0, 0.05, 0.0);
    this.canMesh.rotation.set(0.06, 0.38, -0.19);
    this.canMesh.scale.set(1.0, 1.0, 1.0);
    this.scene.add(this.canMesh);

    // 7. Commercial Studio Lighting Rig
    // Product Key Light: Clean commercial white softbox revealing true red body and pristine white Spencerian script
    this.keyLight = new THREE.DirectionalLight(0xfffaf4, 2.4);
    this.keyLight.position.set(1.8, 3.2, 3.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.bias = -0.0001;
    this.keyLight.shadow.normalBias = 0.015;

    // Tuned shadow frustum
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
    // Soft, diffused ambient scarlet glow without concentrated hotspot or clipping
    this.backdropSpot = new THREE.SpotLight(0xc8101e, 0.30, 20, Math.PI / 1.7, 1.0);
    this.backdropSpot.position.set(0.0, 0.6, -0.6);
    this.backdropSpot.target.position.set(0.0, 0.8, -3.5);
    this.backdropSpot.layers.set(1);
    this.scene.add(this.backdropSpot);
    this.scene.add(this.backdropSpot.target);

    // Stage Ambient: Dedicated soft ambient on Layer 1 bringing out the rich cyclorama texture without blowing out
    this.stageAmbient = new THREE.AmbientLight(0xffffff, 0.28);
    this.stageAmbient.layers.set(1);
    this.scene.add(this.stageAmbient);

    // Fill Light: Soft neutral-white fill preserving pristine white logo contrast and eliminating center trough
    this.fillLight = new THREE.DirectionalLight(0xf0f4f8, 1.3);
    this.fillLight.position.set(-1.8, 1.8, 3.0);
    this.fillLight.layers.set(0);
    this.scene.add(this.fillLight);

    // Rim Light Top: Crisp white top rim separating silver lid and tab with razor highlights
    this.rimLightTop = new THREE.DirectionalLight(0xffffff, 2.8);
    this.rimLightTop.position.set(0.1, 3.8, -2.5);
    this.rimLightTop.layers.set(0);
    this.scene.add(this.rimLightTop);

    // Specular Strip: Clean commercial white highlight down cylinder flank
    this.specularStrip = new THREE.DirectionalLight(0xffffff, 1.8);
    this.specularStrip.position.set(3.2, 0.1, 0.8);
    this.specularStrip.layers.set(0);
    this.scene.add(this.specularStrip);

    // Flank Kicker: Neutral kicker defining left silhouette
    this.rimLightFlank = new THREE.DirectionalLight(0xf0f2f5, 1.2);
    this.rimLightFlank.position.set(-3.2, 0.0, -1.0);
    this.rimLightFlank.layers.set(0);
    this.scene.add(this.rimLightFlank);

    // Ambient: Soft neutral studio ambient preventing muddy shadows without adding a red veil
    this.ambientLight = new THREE.AmbientLight(0x32282c, 0.45);
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
