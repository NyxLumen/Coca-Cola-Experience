import { useState } from 'react';
import { PRODUCTS, PRODUCT_ORDER } from './data/products';
import { AssetValidationViewer } from './viewer/AssetValidationViewer';
import './App.css';

export default function App() {
  const [viewMode, setViewMode] = useState<'phase0' | 'viewer'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'phase0' ? 'phase0' : 'viewer';
  });

  if (viewMode === 'viewer') {
    return <AssetValidationViewer onBack={() => setViewMode('phase0')} />;
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
            onClick={() => setViewMode('viewer')}
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
            Launch 3D Asset Viewer →
          </button>
          <span className="badge-phase">PHASE 0 READY</span>
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
        <div>Foundation: Vite + React 19 + TypeScript</div>
        <div>Active Milestone: Phase 1.2 — Real-Time GLB Validation</div>
      </footer>
    </main>
  );
}
