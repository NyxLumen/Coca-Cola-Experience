export type ProductId = 'original' | 'diet' | 'zero';

export interface ProductColorPalette {
  readonly background: string;
  readonly surface: string;
  readonly primary: string;
  readonly accent: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
}

export interface ProductAtmosphereConfig {
  readonly lightingTone: 'warm' | 'cool' | 'dramatic';
  readonly finish: 'glossy' | 'metallic' | 'matte-contrast';
  readonly ambientColor: string;
  readonly keyLightColor: string;
  readonly rimLightColor: string;
  readonly fogColor: string;
  readonly particleTone: string;
}

export interface ProductMetadata {
  readonly id: ProductId;
  readonly title: string;
  readonly tag: string;
  readonly description: string;
  readonly invitationPrompt: string;
  readonly palette: ProductColorPalette;
  readonly atmosphere: ProductAtmosphereConfig;
}
