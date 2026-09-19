# Technical Architecture — Coca-Cola 3D Experience

## 1. Application Architecture

The system is structured with strict separation of concerns across four key layers:
1. **DOM / UI Layer:** Minimalist typographic overlays, accessibility nodes, interactive controls, and tactile annotations. Operates cleanly above the WebGL viewport with `pointer-events: none` on structural containers and `pointer-events: auto` on interactive anchors.
2. **3D Scene Layer (`Three.js / React Three Fiber`):** Continuous WebGL canvas hosting the camera rig, lighting system, product mesh carousel, ground planes, and post-processing passes.
3. **Animation & Transition Orchestrator (`GSAP`):** A centralized coordinator that drives synchronized timelines affecting 3D transforms, shader uniforms, lighting parameters, and DOM elements concurrently.
4. **Data & State Layer:** Single source of truth containing immutable product metadata, color configurations, atmospheric settings, and finite state machine definitions for product selection.

### Layer Hierarchy Diagram

```
┌────────────────────────────────────────────────────────┐
│                      DOM UI Layer                      │
│     (Typography, "TRY ME" Callout, Navigation, A11y)   │
└───────────────────────────▲────────────────────────────┘
                            │
┌───────────────────────────┴────────────────────────────┐
│         Animation & Orchestration Engine (GSAP)        │
│    (Master Timelines, Interpolators, Transition Lock)  │
└───────────────▲────────────────────────▲───────────────┘
                │                        │
┌───────────────┴───────────────┐ ┌──────┴───────────────┐
│     3D Scene Layer (R3F)      │ │   Product Data/State │
│ (Meshes, Lights, Camera, PFX) │ │ (Metadata, FSM State)│
└───────────────────────────────┘ └──────────────────────┘
```

---

## 2. Scene Architecture

*Status: Planned for Phase 2 & Phase 5.*

### Continuous Coordinate Space
Instead of unmounting and remounting separate Three.js scenes, all three products exist simultaneously within a shared world coordinate matrix:
- **`Hero Slot (Center)`:** `vec3(0.0, 0.0, 0.0)` — Focus of the primary camera viewport.
- **`Flank Slot (Peripheral)`:** `vec3(3.2, -0.2, -1.2)` — Candidate product, angled toward center, receiving rim light.
- **`Offstage Slot (Reservoir)`:** `vec3(-4.5, 0.0, -3.0)` — Awaiting rotation into the flank position.

### Lighting Rig
- **Key Light:** Directional light targeting the hero can's curvature; smoothly alters color temperature and intensity per product personality.
- **Fill Light:** Low-intensity ambient/directional fill preventing crushed shadows.
- **Rim Light:** High-contrast backlight emphasizing metallic contours and silhouettes.
- **Dynamic Floor / Backdrop:** Smooth gradient plane receiving contact shadows via soft depth/accumulator shadow techniques.

---

## 3. Product State Architecture

*Status: Foundation schemas implemented in Phase 0; full state machine planned for Phase 3.*

### State Machine Model
The product state is managed by a deterministic Finite State Machine (FSM):
- **States:**
  - `IDLE`: Normal viewing mode; responds to pointer parallax and subtle breathing animations.
  - `TRANSITIONING`: Master transition in progress; user interactions on product switching are queued or locked.
- **State Properties:**
  - `activeProductId`: The hero product (`'original' | 'diet' | 'zero'`).
  - `candidateProductId`: The peripheral product offering the "TRY ME" interaction.
  - `backgroundProductId`: The product currently offstage.
  - `transitionProgress`: Normalized `0.0 -> 1.0` scalar driving all interpolated parameters.

### Data Schemas (Phase 0 Foundation)
Located at:
- `src/types/product.ts`: Strict types for product keys, color palettes, atmospheric profiles, and metadata.
- `src/data/products.ts`: Declarative dictionary providing all aesthetic and lighting parameters for each product variant.

---

## 4. Animation Architecture

*Status: Planned for Phase 4 (Idle/Parallax) and Phase 5 (Transition Engine).*

### Single Master Timeline Principle
Transitions must never be implemented as independent CSS transitions or uncoordinated `useFrame` lerps. Instead:
1. **Central Dispatch:** When a product change is requested, the orchestrator constructs a unified GSAP Timeline (`timeline({ defaults: { ease: 'power3.inOut' } })`).
2. **Synchronized Tracks:**
   - **Track 1 (Spatial Translations):** Center product translates to offstage flank; candidate translates to center; offstage enters flank.
   - **Track 2 (Rotational Choreography):** Cans spin into their respective beauty angles.
   - **Track 3 (Light & Color Tweens):** Scene background color, key light color, and ambient intensities tween smoothly.
   - **Track 4 (Material Uniforms):** Roughness, metalness, and shader parameters interpolate.
   - **Track 5 (DOM Typography):** Title and descriptors cross-fade and stagger via split text/reveal masks.
3. **Completion & Hand-off:** On timeline completion, the FSM returns to `IDLE` state and re-enables cursor parallax.

---

## 5. Shader & Material Architecture

*Status: Planned for Phase 6.*

### Material Strategy
- **Standard PBR Base:** Custom MeshPhysicalMaterial extensions to leverage physical clearcoat, roughness maps, and anisotropic reflections for can aluminum.
- **Custom Post-Processing & Screen Effects:**
  - Procedural micro-condensation and bubble distortion shaders.
  - Smooth color grading LUT transitions between the warm crimson, cold silver, and high-contrast obsidian atmospheres.
  - Subtle chromatic aberration and cinematic film grain.

---

## 6. Directory Structure

The project conforms to the following modular architecture:

```
src/
├── components/
│   ├── ui/             # Planned Phase 8: DOM overlays, typography, annotations
│   └── experience/     # Planned Phase 2: R3F Canvas and scene wrapper
├── scene/
│   ├── components/     # Planned Phase 2: Can meshes, lighting rig, camera rig
│   ├── materials/      # Planned Phase 6: PBR textures and custom material definitions
│   └── effects/        # Planned Phase 6: Post-processing and atmosphere
├── animation/          # Planned Phase 5: Centralized GSAP timeline orchestrators
├── data/               # Implemented Phase 0: Product specifications and color dictionaries
├── shaders/            # Planned Phase 6: GLSL fragment and vertex shaders
├── hooks/              # Planned Phase 4: Pointer tracking, responsive viewport hooks
├── types/              # Implemented Phase 0: TypeScript definitions and schemas
├── utils/              # Implemented Phase 0: Math and formatting helpers
├── App.tsx             # Implemented Phase 0: Foundation shell
├── App.css             # Implemented Phase 0: Layout foundation
├── index.css           # Implemented Phase 0: Global reset and typography
└── main.tsx            # Implemented Phase 0: React 19 entrypoint
```

*Note: Directories are populated with code only when their respective phase is implemented, avoiding dummy files.*

---

## 7. Roadmap & Phase Boundaries

| Phase | Description | Status |
|---|---|---|
| **Phase 0** | Creative Direction & Technical Foundation | **CURRENT (Active)** |
| **Phase 1** | 3D Asset Pipeline (can geometries, UVs, normal maps) | Planned |
| **Phase 2** | Core 3D Scene (Three.js/R3F setup, camera rig, lights) | Planned |
| **Phase 3** | Product State System (FSM, data bindings) | Planned |
| **Phase 4** | Idle Motion & Parallax Interaction | Planned |
| **Phase 5** | Transition Engine (central GSAP coordinated timelines) | Planned |
| **Phase 6** | Shader & Atmosphere System (bubbles, condensation, materials) | Planned |
| **Phase 7** | Product-Specific Art Direction (fine-tuning each variant) | Planned |
| **Phase 8** | UI & Typography (editorial layout, "TRY ME" button) | Planned |
| **Phase 9** | Micro-interactions & Polish | Planned |
| **Phase 10** | Responsive Experience (mobile framing, canvas scaling) | Planned |
| **Phase 11** | Performance & Accessibility (draw calls, reduced motion) | Planned |
| **Phase 12** | Final Portfolio Presentation | Planned |

---

## 8. Performance Considerations

1. **Draw Call Budget:** Maintain ≤ 25 draw calls per frame across all three can models by sharing geometry buffers and standardizing texture atlases.
2. **Texture Optimization:** Textures will be formatted in WebP/KTX2 with mipmapping enabled to keep GPU VRAM footprint below 50MB.
3. **Frame Budget:** Hard target of 60 FPS on mid-tier mobile GPUs and 120 FPS on high-refresh displays.
4. **Adaptive DPR:** Cap device pixel ratio at `Math.min(window.devicePixelRatio, 2)` to avoid fill-rate bottlenecks on 4K/retina screens.
5. **Reduced Motion:** If `prefers-reduced-motion: reduce` is detected, 3D translations are condensed into soft cross-dissolves and pointer parallax is disabled.
