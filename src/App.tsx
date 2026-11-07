import { useState } from 'react';
import { PRODUCTS, PRODUCT_ORDER } from './data/products';
import { AssetValidationViewer } from './viewer/AssetValidationViewer';
import { DualRealityExperience } from './experience/DualRealityExperience';
import './App.css';

export type AppViewMode = 'experience' | 'viewer' | 'phase0';

export default function App() {
  const [viewMode, setViewMode] = useState<AppViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'viewer') return 'viewer';
    if (viewParam === 'phase0') return 'phase0';
    return 'experience'; // Default to Phase 2A Dual-Reality Experience
  });

  if (viewMode === 'experience') {
    return (
      <DualRealityExperience
        onBackToViewer={() => setViewMode('viewer')}
        onBackToPhase0={() => setViewMode('phase0')}
      />
    );
  }

  if (viewMode === 'viewer') {
    return <AssetValidationViewer onBack={() => setViewMode('experience')} />;
  }

  return (
    <main className="phase-container">
      <header className="phase-header">
        <div>
          <div className="brand-label">Coca-Cola 3D Continuous Experience</div>
          <h2 className="phase-title">Phase 0 — Creative Direction & Technical Foundation</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setViewMode('experience')}
            style={{
              background: '#f40009',
              color: '#ffffff',
              border: 'none',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Launch Dual-Reality Experience (Phase 2A) →
          </button>
          <button
            onClick={() => setViewMode('viewer')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            3D Asset Viewer (Phase 1.3)
          </button>
          <span className="badge-phase">PHASE 2A READY</span>
        </div>
      </header>

      <section className="phase-content">
        <div className="concept-overview">
          <h1>Three Icons. One Continuous World.</h1>
          <p>
            An interactive 3D web experience where Coca-Cola Original, Diet Coke, and
            Coca-Cola Zero Sugar coexist inside a shared spatial coordinate universe. Seamless
            state transitions coordinate physical camera movement, lighting, materials, and typography.
          </p>
        </div>

        <div className="products-grid">
          {PRODUCT_ORDER.map((id) => {
            const product = PRODUCTS[id];
            return (
              <article key={product.id} className="product-card">
                <div>
                  <div className="product-card-header">
                    <span className="product-id-tag">{product.id}</span>
                    <span
                      className="color-swatch"
                      style={{ backgroundColor: product.palette.primary }}
                      title={`Primary: ${product.palette.primary}`}
                    />
                  </div>
                  <h3>{product.title}</h3>
                  <div className="product-tag">{product.tag}</div>
                  <p className="product-desc">{product.description}</p>
                </div>
                <div className="product-attributes">
                  <div>Finish: {product.atmosphere.finish}</div>
                  <div>Tone: {product.atmosphere.lightingTone}</div>
                  <div>Interaction: "{product.invitationPrompt}"</div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="phase-footer">
        <div>Foundation: Vite + React 19 + TypeScript + Three.js r187</div>
        <div>Active Milestone: Phase 2A — Dual-Reality Rendering Foundation</div>
      </footer>
    </main>
  );
}
