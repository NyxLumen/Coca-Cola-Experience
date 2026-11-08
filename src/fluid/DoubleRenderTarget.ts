import * as THREE from 'three';

export class DoubleRenderTarget {
  public read: THREE.WebGLRenderTarget;
  public write: THREE.WebGLRenderTarget;
  public width: number;
  public height: number;

  constructor(width: number, height: number, options?: THREE.RenderTargetOptions) {
    this.width = width;
    this.height = height;

    const defaultOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      ...options,
    };

    this.read = new THREE.WebGLRenderTarget(width, height, defaultOptions);
    this.write = new THREE.WebGLRenderTarget(width, height, defaultOptions);
  }

  public swap(): void {
    const temp = this.read;
    this.read = this.write;
    this.write = temp;
  }

  public setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.read.setSize(width, height);
    this.write.setSize(width, height);
  }

  public dispose(): void {
    this.read.dispose();
    this.write.dispose();
  }
}
