import type { ProductId, ProductMetadata } from '../types/product';

export const PRODUCTS: Record<ProductId, ProductMetadata> = {
  original: {
    id: 'original',
    title: 'Coca-Cola Original',
    tag: 'Classic Refreshment',
    description: 'The authentic, timeless taste in its signature red environment with warm lighting and soft atmosphere.',
    invitationPrompt: 'TRY ME',
    palette: {
      background: '#8B0000',
      surface: '#F40009',
      primary: '#F40009',
      accent: '#FFE6E6',
      textPrimary: '#FFFFFF',
      textSecondary: '#FFAFAF',
    },
    atmosphere: {
      lightingTone: 'warm',
      finish: 'glossy',
      ambientColor: '#4A0D0D',
      keyLightColor: '#FFF2E6',
      rimLightColor: '#FF6B6B',
      fogColor: '#600606',
      particleTone: '#FFE2D1',
    },
  },
  diet: {
    id: 'diet',
    title: 'Diet Coke',
    tag: 'Distinct & Crisp',
    description: 'Crisp, bold, zero-calorie refreshment immersed in a sleek silver atmosphere with cooler specular highlights.',
    invitationPrompt: 'TRY ME',
    palette: {
      background: '#C7C9CB',
      surface: '#ECECEC',
      primary: '#D11242',
      accent: '#111111',
      textPrimary: '#111111',
      textSecondary: '#4A4A4A',
    },
    atmosphere: {
      lightingTone: 'cool',
      finish: 'metallic',
      ambientColor: '#A0A4A8',
      keyLightColor: '#F5F7FA',
      rimLightColor: '#FFFFFF',
      fogColor: '#B8BAC0',
      particleTone: '#E2E8F0',
    },
  },
  zero: {
    id: 'zero',
    title: 'Coca-Cola Zero Sugar',
    tag: 'Zero Sugar, Pure Intensity',
    description: 'High-contrast, near-black environment punctuated by sharp crimson accents and dramatic directional shadows.',
    invitationPrompt: 'TRY ME',
    palette: {
      background: '#0B0B0C',
      surface: '#18181B',
      primary: '#E50914',
      accent: '#FF2E36',
      textPrimary: '#FFFFFF',
      textSecondary: '#A1A1AA',
    },
    atmosphere: {
      lightingTone: 'dramatic',
      finish: 'matte-contrast',
      ambientColor: '#0F0F12',
      keyLightColor: '#FFFFFF',
      rimLightColor: '#FF2E36',
      fogColor: '#050506',
      particleTone: '#FF4545',
    },
  },
};

export const PRODUCT_ORDER: ProductId[] = ['original', 'diet', 'zero'];
