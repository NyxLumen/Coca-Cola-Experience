# Coca-Cola 3D Experience

A portfolio-quality conceptual 3D interactive web experience featuring three iconic Coca-Cola products:

1. **Coca-Cola Original**
2. **Diet Coke**
3. **Coca-Cola Zero Sugar**

All three products inhabit a single, continuous 3D coordinate space. State transitions coordinate 3D spatial translations, dynamic lighting rigs, material sheens, background atmospheres, and typography in one unified physical event.

---

## 📖 Documentation

- **[DESIGN.md](./DESIGN.md)**: Creative direction, product personalities, spatial layout, typography, and atmospheric principles.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Technical architecture, scene coordinate design, animation orchestration principles, performance budgets, and roadmap phase boundaries.

---

## 🛠 Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite
- **3D Engine** *(Phase 2+)*: Three.js, React Three Fiber, Drei
- **Animation Orchestration** *(Phase 5+)*: GSAP
- **Post-Processing & Shaders** *(Phase 6+)*: Custom GLSL & React Three Postprocessing
- **Styling**: Modern CSS

---

## 🗺 Roadmap

- [x] **Phase 0 — Creative Direction & Technical Foundation**
- [x] **Phase 1 — 3D Asset Pipeline** *(Canonical GLB, Config A PBR, Calibrated Roughness Pipeline)*
- [x] **Phase 2A — Dual-Reality Rendering Foundation** *(Synchronized Cameras, Dual Render Targets & Compositor)*
- [x] **Phase 2B — GPU Fluid Simulation** *(Eulerian Navier-Stokes, Momentum Advection, Jacobi Pressure, Idle Vortices)*
- [x] **Phase 2C — Fluid-Driven Compositor (Revised)** *(Density-Driven Reveal, Spatially Locked Realities, Sub-Pixel Alignment, Subtle Optical Edge)*
- [ ] **Phase 3 — Product State System**
- [ ] **Phase 4 — Idle Motion & Interaction**
- [ ] **Phase 5 — Transition Engine**
- [ ] **Phase 6 — Shader & Atmosphere System**
- [ ] **Phase 7 — Product-Specific Art Direction**
- [ ] **Phase 8 — UI & Typography**
- [ ] **Phase 9 — Micro-interactions & Polish**
- [ ] **Phase 10 — Responsive Experience**
- [ ] **Phase 11 — Performance & Accessibility**
- [ ] **Phase 12 — Final Portfolio Presentation**

---

## 🚀 Development

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

### Production Build & Linting
```bash
npm run build
npm run lint
```
