export const BASE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 1. Semi-Lagrangian Advection
export const ADVECTION_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tVelocity;
  uniform sampler2D tSource;
  uniform vec2 uTexelSize;
  uniform float uDt;
  uniform float uDissipation;
  varying vec2 vUv;

  void main() {
    vec2 vel = texture2D(tVelocity, vUv).xy;
    vec2 coord = vUv - uDt * vel * uTexelSize;
    // Hardware bilinear filtering smoothly interpolates source quantity
    vec4 result = uDissipation * texture2D(tSource, coord);
    gl_FragColor = result;
  }
`;

// 2. Smooth Gaussian Splatting (Force & Density Injection)
export const SPLAT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tTarget;
  uniform vec2 uPoint;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uAspect;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - uPoint;
    p.x *= uAspect;
    float d2 = dot(p, p);
    // Smooth isotropic Gaussian distribution
    float splat = exp(-d2 / max(uRadius, 0.0001));
    vec4 base = texture2D(tTarget, vUv);
    gl_FragColor = vec4(base.rgb + uColor * splat, base.a);
  }
`;

// 3. Velocity Divergence Calculation
export const DIVERGENCE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float L = texture2D(tVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(tVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(tVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    float T = texture2D(tVelocity, vUv + vec2(0.0, uTexelSize.y)).y;

    // Discrete central difference divergence: div = (dR/dx + dT/dy) / 2
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

// 4. Pressure Solving via Jacobi Iteration
export const JACOBI_PRESSURE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tPressure;
  uniform sampler2D tDivergence;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float L = texture2D(tPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(tPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(tPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float T = texture2D(tPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float div = texture2D(tDivergence, vUv).x;

    // Standard Poisson pressure solver: p = (L + R + B + T - div) / 4
    float p = (L + R + B + T - div) * 0.25;
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
  }
`;

// 5. Gradient Subtraction (Divergence-Free Velocity Projection)
export const GRADIENT_SUBTRACT_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tPressure;
  uniform sampler2D tVelocity;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    float L = texture2D(tPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float R = texture2D(tPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float B = texture2D(tPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float T = texture2D(tPressure, vUv + vec2(0.0, uTexelSize.y)).x;

    vec2 vel = texture2D(tVelocity, vUv).xy;
    vel -= 0.5 * vec2(R - L, T - B);
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`;

// 6. Decay / Pressure Clear
export const DECAY_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tSource;
  uniform float uDecay;
  varying vec2 vUv;

  void main() {
    gl_FragColor = uDecay * texture2D(tSource, vUv);
  }
`;

// 7. Debug Visualizer Shader
export const DEBUG_VISUALIZER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D tTexture;
  uniform int uDebugType; // 1: velocity, 2: magnitude, 3: density, 4: divergence, 5: pressure
  varying vec2 vUv;

  // Visual Turbo/Jet palette
  vec3 heatmap(float t) {
    t = clamp(t, 0.0, 1.0);
    return clamp(vec3(
      1.5 * t,
      1.5 * (1.0 - abs(2.0 * t - 1.0)),
      1.5 * (1.0 - t)
    ), 0.0, 1.0);
  }

  void main() {
    vec4 val = texture2D(tTexture, vUv);

    if (uDebugType == 1) {
      // Velocity vector field: mapped to directional color
      vec2 vel = val.xy * 0.02;
      vec3 col = vec3(0.5 + vel.x, 0.5 + vel.y, 0.5 - 0.5 * (vel.x + vel.y));
      gl_FragColor = vec4(col, 1.0);
    } else if (uDebugType == 2) {
      // Velocity magnitude heatmap
      float speed = length(val.xy) * 0.025;
      vec3 col = heatmap(speed);
      gl_FragColor = vec4(col, 1.0);
    } else if (uDebugType == 3) {
      // Density
      gl_FragColor = vec4(val.rgb, 1.0);
    } else if (uDebugType == 4) {
      // Divergence: Red for positive (expansion), Blue for negative (compression)
      float div = val.x * 20.0;
      vec3 col = vec3(max(div, 0.0), 0.0, max(-div, 0.0));
      gl_FragColor = vec4(col, 1.0);
    } else if (uDebugType == 5) {
      // Pressure: Cyan (positive) to Magenta (negative)
      float p = val.x * 10.0;
      vec3 col = (p >= 0.0)
        ? mix(vec3(0.0), vec3(0.1, 0.8, 0.9), clamp(p, 0.0, 1.0))
        : mix(vec3(0.0), vec3(0.9, 0.2, 0.7), clamp(-p, 0.0, 1.0));
      gl_FragColor = vec4(col, 1.0);
    } else {
      gl_FragColor = val;
    }
  }
`;
