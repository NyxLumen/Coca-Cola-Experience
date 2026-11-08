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
    this.scene.add(this.cyclorama);

    // 4. Luminous Red Liquid Light Caustic Pool
    this.causticGlow = createCausticGlowMesh('classic');
    this.scene.add(this.causticGlow);

    // 5. Multi-Lobe Campaign Grounding Shadow
    this.contactShadow = createCampaignContactShadow('classic');
    this.scene.add(this.contactShadow);

    // 6. Canonical PBR Can Mesh with Dynamic Commercial Hero Orientation
    this.material = createRealityAMaterial(textures);
    this.canMesh = new THREE.Mesh(canonicalGeometry, this.material);
    this.canMesh.name = 'CokeCan_RealityA';
    this.canMesh.castShadow = true;
    this.canMesh.receiveShadow = true;

    // Dynamic campaign tilt presenting the Spencerian script heroically
    this.canMesh.position.set(0.0, 0.05, 0.0);
    this.canMesh.rotation.set(0.06, 0.38, -0.19);
    this.canMesh.scale.set(1.0, 1.0, 1.0);
    this.scene.add(this.canMesh);

    // 7. Commercial Studio Lighting Rig
    // Key Light: Clean commercial white softbox revealing true red body and pristine white Spencerian script
    this.keyLight = new THREE.DirectionalLight(0xfffaf4, 2.5);
    this.keyLight.position.set(2.6, 3.4, 2.6);
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
    this.scene.add(this.keyLight);

    // Backdrop Spotlight: Positioned BEHIND the can (z = -0.6) pointing backwards onto the cyclorama wall
    // This illuminates the environment with vibrant red aura WITHOUT spilling onto the can
    this.backdropSpot = new THREE.SpotLight(0xff1222, 2.4, 12, Math.PI / 2.6, 0.85);
    this.backdropSpot.position.set(0.0, 0.6, -0.6);
    this.backdropSpot.target.position.set(0.0, 0.8, -3.2);
    this.scene.add(this.backdropSpot);
    this.scene.add(this.backdropSpot.target);

    // Fill Light: Soft neutral-white fill preserving pristine white logo contrast
    this.fillLight = new THREE.DirectionalLight(0xf0f4f8, 1.15);
    this.fillLight.position.set(-2.8, 1.4, 2.0);
    this.scene.add(this.fillLight);

    // Rim Light Top: Crisp white top rim separating silver lid and tab with razor highlights
    this.rimLightTop = new THREE.DirectionalLight(0xffffff, 2.8);
    this.rimLightTop.position.set(0.1, 3.8, -2.5);
    this.scene.add(this.rimLightTop);

    // Specular Strip: Clean commercial white highlight down cylinder flank
    this.specularStrip = new THREE.DirectionalLight(0xffffff, 1.8);
    this.specularStrip.position.set(3.2, 0.1, 0.8);
    this.scene.add(this.specularStrip);

    // Flank Kicker: Neutral kicker defining left silhouette
    this.rimLightFlank = new THREE.DirectionalLight(0xf0f2f5, 1.2);
    this.rimLightFlank.position.set(-3.2, 0.0, -1.0);
    this.scene.add(this.rimLightFlank);

    // Ambient: Soft neutral studio ambient preventing muddy shadows without adding a red veil
    this.ambientLight = new THREE.AmbientLight(0x32282c, 0.45);
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
