"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
uniform float uTime;
uniform float uSize;
uniform vec2 uMouse;
uniform float uPixelRatio;
attribute float aScale;
attribute float aPhase;
varying float vAlpha;
varying float vDepth;

void main() {
  vec3 pos = position;

  // Sinusoidal wave drift
  float wave  = sin(uTime * 0.45 + aPhase * 6.2831);
  float drift = cos(uTime * 0.22 + aPhase * 3.1415);
  pos.x += wave  * 0.45;
  pos.y += drift * 0.3 + wave * 0.15;
  pos.z += sin(uTime * 0.3 + aPhase * 4.0) * 0.25;

  // Mouse-reactive repulsion in screen-space
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vec2 screenPos  = mvPosition.xy / -mvPosition.z;
  float dist      = distance(screenPos, uMouse);
  float influence = smoothstep(0.8, 0.0, dist);
  pos.xy += normalize(screenPos - uMouse) * influence * 0.35;

  vec4 finalMv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position  = projectionMatrix * finalMv;

  // Perspective-correct point sizing
  gl_PointSize = uSize * aScale * uPixelRatio * (280.0 / -finalMv.z);

  // Soft vertical fade
  vAlpha = smoothstep(-6.0, 1.0, pos.y) * smoothstep(6.0, 1.0, pos.y);

  // Pass camera-space depth for atmospheric perspective
  vDepth = -finalMv.z;
}
`;

const fragmentShader = `
varying float vAlpha;
varying float vDepth;
uniform vec3  uColor;
uniform vec3  uColorSecondary;
uniform float uTime;

// SDF: circle
float sdCircle(vec2 p) {
  return length(p);
}

// SDF: diamond (L1 norm)
float sdDiamond(vec2 p) {
  return abs(p.x) + abs(p.y);
}

// SDF: 5-point star
float sdStar(vec2 p, float r, int n, float m) {
  float an = 3.14159265 / float(n);
  float en = 3.14159265 / m;
  vec2 acs = vec2(cos(an), sin(an));
  vec2 ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs;
  p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);

  // Deterministically select shape per-particle
  float selector = fract(vAlpha * 3.7);
  float d;
  if (selector < 0.33) {
    d = sdCircle(p);                      // Circle
  } else if (selector < 0.66) {
    d = sdDiamond(p * 1.8);               // Diamond
  } else {
    d = sdStar(p * 2.2, 0.35, 5, 2.5);   // 5-point Star
  }

  if (d > 0.5) discard;

  // Gamma-corrected glow falloff
  float glow  = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);

  // Colour blend: secondary at edges, primary at core
  vec3 color  = mix(uColorSecondary, uColor, glow);

  // HDR: core exceeds 1.0 to drive bloom accumulation
  float hdr   = glow * 1.8;

  // Atmospheric depth fade
  float depthFade = smoothstep(12.0, 2.0, vDepth);

  gl_FragColor = vec4(color * hdr, glow * vAlpha * depthFade * 0.85);
}
`;

export function GoldDustShader({ count = 5000 }: { count?: number }) {
  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 8], fov: 55 }} dpr={[1, 1.5]}>
        <ShaderPoints count={count} />
      </Canvas>
    </div>
  );
}

function ShaderPoints({ count = 5000 }: { count?: number }) {
  const pointsRef   = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, scales, phases } = useMemo(() => {
    const seeded = (seed: number) => {
      const value = Math.sin(seed * 9999.1) * 43758.5453;
      return value - Math.floor(value);
    };
    const pos = new Float32Array(count * 3);
    const scl = new Float32Array(count);
    const ph = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (seeded(i + 7) - 0.5) * 24;
      pos[i * 3 + 1] = (seeded(i + 701) - 0.5) * 14;
      pos[i * 3 + 2] = (seeded(i + 7001) - 0.5) * 12;
      scl[i] = seeded(i + 23) * 1.25 + 0.35;
      ph[i] = seeded(i + 53);
    }
    return { positions: pos, scales: scl, phases: ph };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 1.5 },
      uMouse: { value: new THREE.Vector2(99, 99) },
      uPixelRatio: { value: typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 2) : 1 },
      uColor: { value: new THREE.Color("#C9A84C") },
      uColorSecondary: { value: new THREE.Color("#6B1D3A") },
    }),
    []
  );

  // ── FIX: drive uTime uniform every frame so shader animation runs ──────
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
