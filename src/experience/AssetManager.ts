import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TextureTier } from './types';

export interface LoadedAssets {
  canonicalGeometry: THREE.BufferGeometry;
  canDimensions: THREE.Vector3;
  texturesA: {
    diffuse: THREE.Texture;
    normal: THREE.Texture;
    metallicRoughness: THREE.Texture;
  };
  texturesB: {
    diffuse: THREE.Texture;
    normal: THREE.Texture;
    metallicRoughness: THREE.Texture;
  };
}

export class AssetManager {
  private gltfLoader: GLTFLoader;
  private textureLoader: THREE.TextureLoader;
  private textureCache: Map<string, THREE.Texture> = new Map();
  private canonicalGeometry: THREE.BufferGeometry | null = null;
  private canDimensions: THREE.Vector3 = new THREE.Vector3();

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
  }

  public getTexture(path: string, isColor: boolean = false): THREE.Texture {
    if (this.textureCache.has(path)) {
      return this.textureCache.get(path)!;
    }
    const texture = this.textureLoader.load(path);
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // CRITICAL: glTF UV convention requires flipY = false to match UV mapping
    texture.flipY = false;
    this.textureCache.set(path, texture);
    return texture;
  }

  public async loadAll(tier: TextureTier = '2k'): Promise<LoadedAssets> {
    const glbPromise = new Promise<{ geom: THREE.BufferGeometry; dims: THREE.Vector3 }>((resolve, reject) => {
      this.gltfLoader.load(
        '/models/coke-can.glb',
        (gltf) => {
          let foundMesh: THREE.Mesh | null = null;
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh && !foundMesh) {
              foundMesh = child as THREE.Mesh;
            }
          });

          if (!foundMesh) {
            reject(new Error('No mesh found in canonical coke-can.glb'));
            return;
          }

          const mesh = foundMesh as THREE.Mesh;
          const geom = mesh.geometry.clone();

          geom.computeBoundingBox();
          const bbox = geom.boundingBox!;
          const dims = new THREE.Vector3();
          bbox.getSize(dims);

          this.canonicalGeometry = geom;
          this.canDimensions.copy(dims);
          resolve({ geom, dims });
        },
        undefined,
        (err) => reject(err)
      );
    });

    const { geom, dims } = await glbPromise;

    // Load textures according to tier
    const texturesA = this.loadProductTextures('classic', tier);
    const texturesB = this.loadProductTextures('diet', tier);

    return {
      canonicalGeometry: geom,
      canDimensions: dims,
      texturesA,
      texturesB,
    };
  }

  public loadProductTextures(product: 'classic' | 'diet', tier: TextureTier) {
    if (tier === '4k') {
      return {
        diffuse: this.getTexture(`/textures/4k/coke_${product}_diffuse_4k.png`, true),
        normal: this.getTexture('/textures/4k/coke_normal_4k.png', false),
        metallicRoughness: this.getTexture(`/textures/4k/coke_${product}_metallic_roughness_4k.png`, false),
      };
    }

    return {
      diffuse: this.getTexture(`/textures/${tier}/coke_${product}_diffuse_${tier}.webp`, true),
      normal: this.getTexture(`/textures/${tier}/coke_normal_${tier}.webp`, false),
      metallicRoughness: this.getTexture(`/textures/${tier}/coke_${product}_metallic_roughness_${tier}.png`, false),
    };
  }

  public getGeometry(): THREE.BufferGeometry | null {
    return this.canonicalGeometry;
  }

  public getDimensions(): THREE.Vector3 {
    return this.canDimensions;
  }

  public dispose(): void {
    this.textureCache.forEach((tex) => tex.dispose());
    this.textureCache.clear();
    if (this.canonicalGeometry) {
      this.canonicalGeometry.dispose();
      this.canonicalGeometry = null;
    }
  }
}
