# Design System & Creative Direction — Coca-Cola 3D Experience

## 1. Project Concept

The Coca-Cola 3D Experience is a portfolio-grade, conceptual interactive web experience built around a single, continuous 3D coordinate space housing three iconic product variants:

1. **Coca-Cola Original**
2. **Diet Coke**
3. **Coca-Cola Zero Sugar**

Rather than treating each product as a disconnected page, slide, or detached model swap, the entire experience exists within one shared, continuous environment. The currently active product occupies center stage. A secondary product rests partially visible in the peripheral space, inviting exploration with a tactile, handwritten interaction prompt ("TRY ME").

When switching products, the experience does not cut or trigger isolated transitions. Instead, the scene executes **one coordinated physical event**:
- The current hero moves smoothly from center toward the periphery.
- The selected product moves from the side into the focal center.
- The environment background shifts in hue and depth.
- The lighting rig recalculates tone, key/fill balance, and specular highlights.
- Typography, surface reflections, and atmospheric elements transform in complete synchrony.

---

## 2. Product Personalities

Each product embodies a distinct visual, material, and emotional signature:

### Coca-Cola Original
* **Atmosphere:** Deep, iconic Coca-Cola heritage red environment with soft, ambient warmth.
* **Lighting:** Warm, luminous key lighting that wraps around the silhouette without harsh cutoffs.
* **Finish & Materials:** High-gloss lacquer finish with rich, deep crimson body reflection and liquid condensation subtlety.
* **Atmospheric Details:** Soft particle micro-bubbles, subtle effervescence floating through light shafts.
* **Motion Profile:** Smooth, graceful, weighted movement that emphasizes timeless heritage and optimism.

### Diet Coke
* **Atmosphere:** Cool, modern silver/light gray environment; crisp and airy.
* **Lighting:** Cooler studio key lighting, sharper specular highlights across the can shoulder and rim.
* **Finish & Materials:** Brushed/metallic aluminum sheen with precise, bright reflection cuts.
* **Atmospheric Details:** Clean, crisp air with minimal particle interference; subtle condensation frost.
* **Motion Profile:** Sharp, precise, agile movement; contemporary and editorial.
* **Accents:** Handwritten callout annotations ("TRY ME") adding human warmth against modernist silver.

### Coca-Cola Zero Sugar
* **Atmosphere:** Near-black, charcoal/obsidian environment punctuated by focused crimson accents.
* **Lighting:** Dramatic, high-contrast chiaroscuro lighting; sharp directional cuts with deep cast shadows.
* **Finish & Materials:** Matte-contrast finish where deep velvety blacks meet bright reflective aluminum rims and bold red typography.
* **Atmospheric Details:** Dense, low-key mist with sharp backlit rim cuts and energetic crimson ember-like particles.
* **Motion Profile:** Strong, decisive, impactful visual movement communicating uncompromising taste intensity.

---

## 3. Core Interaction & Spatial Staging

### Spatial Layout
The 3D environment maintains a multi-anchor continuous coordinate layout:
- **Hero Position (`Anchor.Center`):**
  - Position: Centered in the viewport `(x: 0, y: 0, z: 0)`.
  - Scale & Rotation: Dominant scale, slight three-quarter beauty angle `(yaw: ~-15deg)` presenting primary can face and branding.
  - Interactive State: Subtle idle floating and responsive tilt tracking user cursor/pointer position.
- **Peripheral Candidate (`Anchor.Side`):**
  - Position: Partially cropped along the viewport edge `(x: +3.2, y: -0.2, z: -1.2)`.
  - Scale & Rotation: Scaled down (~0.75x) with depth-of-field softness and glancing rim illumination.
  - Interactive State: Distinctive handwritten "TRY ME" visual tag hovering nearby, pulsing with gentle micro-motion.
- **Offstage Reservoir (`Anchor.Offstage`):**
  - Position: Positioned behind camera or deep in the opposite flank `(x: -4.5, y: 0, z: -3.0)`.
  - Ready to smoothly carousel into the peripheral anchor upon the next product cycle.

---

## 4. Visual Principles

1. **Continuous Physical Cohesion:** Every element is part of the same physical world. No hard cuts, no 2D overlay illusions that conflict with 3D space.
2. **Material Authenticity:** Aluminum, printed ink, metallic foils, and condensation beads must respond faithfully to physical light rather than flat shading.
3. **Intentional Hierarchy:** The hero product is unmistakable. The peripheral candidate creates curiosity without fighting for primary attention.
4. **Calibrated Color Depth:** Avoid flat primary colors. Use dimensional gradients, subsurface richness, and ambient occlusion to achieve depth.
5. **Anti-Slop Restraint:**
   - No generic purple or blue AI neon glows.
   - No arbitrary floating particles that don't serve carbonation or atmosphere.
   - No cluttered dashboard cards or 3-column feature grids.
   - No generic system serifs or default fonts.

---

## 5. Transition Philosophy

* **Single Coordinated Event:** When a transition fires, all subsystems (camera rig, product mesh matrices, environment background, lighting rigs, post-processing color grading, and DOM typography) are orchestrated by a single master timeline.
* **Physical Momentum:** Objects obey weight and momentum. Moving out of center involves ease-in acceleration followed by smooth deceleration into the flank position. The incoming hero swoops in with proportional spring dynamics.
* **Lighting Interpolation:** Never snap lights. The key, rim, and ambient lights smoothly morph their color temperatures, angles, and intensities across the transition curve.
* **Zero Race Conditions:** The transition engine enforces an atomic state lock during camera and asset choreography to prevent conflicting interaction interrupts.

---

## 6. Typography Direction

* **Display / Brand:** Modern high-contrast grotesque or customized geometric sans with tight tracking for product titles and hero numbers.
* **Editorial / Annotation:** Elegant italic serif or expressive hand-drawn script reserved exclusively for "TRY ME" invitations and flavor nuances, contrasting with the structural product titles.
* **Technical / Metadata:** Monospace (`ui-monospace`, `SFMono-Regular`, `Consolas`) for technical specs, volume designations, and foundation telemetry.
* **Anti-Cliché Rule:** No generic marketing slogans, no "Next-Gen Refreshment", and no emoji decorations.

---

## 7. Atmosphere & Environmental Direction

* **Depth & Volumetrics:** Subtle radial depth gradients in the background that suggest an infinite studio void rather than a flat canvas.
* **Liquid & Carbonation:** Micro-bubbles and carbonation trails rendered with subtle refraction, scaled appropriately to avoid visual clutter.
* **Shadow Management:** Contact shadows underneath cans ground them in physical reality; soft ambient occlusion maintains realism.
* **Post-Processing Tonality:** Fine-grain film texture over the final render pipeline prevents color banding and infuses a cinematic, tangible quality.

---

## 8. Interaction Philosophy

* **Tactile & Responsive:** The user is an observer in an illuminated studio. Cursor movement creates gentle rotational parallax on the hero can and shifts the specular highlights across the metallic cylinder.
* **Clear Affordances:** The peripheral product's "TRY ME" tag acts as an unmistakable invitation to tap or click.
* **Accessible Fallbacks:** While 3D and motion are central, the experience respects `prefers-reduced-motion` by gracefully reducing parallax amplitude and using linear fade-and-settle choreography instead of rapid multi-axis translations.
