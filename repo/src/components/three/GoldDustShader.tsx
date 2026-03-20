"use client";

import { Canvas } from "@react-three/fiber";
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

void main() {
  vec3 pos = position;
  float wave = sin(uTime * 0.45 + aPhase * 6.2831);
  float drift = cos(uTime * 0.22 + aPhase * 3.1415);

  pos.x += wave * 0.45;
  pos.y += drift * 0.3 + wave * 0.15;
  pos.z += sin(uTime * 0.3 + aPhase * 4.0) * 0.25;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  vec2 screenPos = mvPosition.xy / -mvPosition.z;
  float dist = distance(screenPos, uMouse);
  float influence = smoothstep(0.8, 0.0, dist);
  pos.xy += normalize(screenPos - uMouse) * influence * 0.35;

  vec4 finalMv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * finalMv;
  gl_PointSize = uSize * aScale * uPixelRatio * (280.0 / -finalMv.z);

  vAlpha = smoothstep(-6.0, 1.0, pos.y) * smoothstep(6.0, 1.0, pos.y);
}
`;

const fragmentShader = `
varying float vAlpha;
uniform vec3 uColor;
uniform vec3 uColorSecondary;

void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  if (d > 0.5) discard;

  float glow = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);
  vec3 color = mix(uColorSecondary, uColor, glow);
  gl_FragColor = vec4(color, glow * vAlpha * 0.75);
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
  const pointsRef = useRef<THREE.Points>(null);

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
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color("#C9A84C") },
      uColorSecondary: { value: new THREE.Color("#6B1D3A") },
    }),
    []
  );

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
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
