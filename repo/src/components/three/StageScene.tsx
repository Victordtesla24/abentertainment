"use client";

import { Bloom, ChromaticAberration, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshDistortMaterial, MeshReflectorMaterial, PointMaterial, Points, SpotLight } from "@react-three/drei";
import { BlendFunction } from "postprocessing";
import { useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";

function GoldParticleField({ count = 2000 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const seeded = (seed: number) => {
      const value = Math.sin(seed * 9999.1) * 43758.5453;
      return value - Math.floor(value);
    };
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (seeded(i + 1) - 0.5) * 20;
      pos[i * 3 + 1] = (seeded(i + 101) - 0.5) * 12;
      pos[i * 3 + 2] = (seeded(i + 1001) - 0.5) * 10;
    }
    return pos;
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#C9A84C"
        size={0.03}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

function VolumetricSpotlights() {
  return (
    <>
      <SpotLight
        position={[-4, 8, 2]}
        angle={0.3}
        penumbra={0.8}
        intensity={4}
        color="#C9A84C"
        castShadow
        distance={20}
        attenuation={5}
        anglePower={4}
        volumetric
      />
      <SpotLight
        position={[4, 8, 2]}
        angle={0.3}
        penumbra={0.8}
        intensity={3}
        color="#6B1D3A"
        castShadow
        distance={20}
        attenuation={5}
        anglePower={4}
        volumetric
      />
      <SpotLight
        position={[0, 10, 0]}
        angle={0.5}
        penumbra={1}
        intensity={2}
        color="#F5F0E8"
        distance={25}
        attenuation={6}
        anglePower={3}
        volumetric
      />
    </>
  );
}

function StageFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
      <planeGeometry args={[30, 20]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={512}
        mixBlur={1}
        mixStrength={40}
        roughness={0.8}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#1A1A1A"
        metalness={0.8}
        mirror={0}
      />
    </mesh>
  );
}

function FloatingOrb() {
  const orbRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!orbRef.current) return;
    orbRef.current.rotation.x = state.clock.elapsedTime * 0.15;
    orbRef.current.rotation.z = state.clock.elapsedTime * 0.12;
  });

  return (
    <Float speed={1.3} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={orbRef} position={[0, 0.6, -1]} castShadow>
        <icosahedronGeometry args={[1.2, 24]} />
        <MeshDistortMaterial color="#C9A84C" roughness={0.2} metalness={0.9} distort={0.28} speed={1.7} />
      </mesh>
    </Float>
  );
}

export function StageScene() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-charcoal via-charcoal-deep to-charcoal"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      <Canvas camera={{ position: [0, 2, 8], fov: 58 }} shadows dpr={[1, 1.5]}>
        <color attach="background" args={["#111111"]} />
        <ambientLight intensity={0.25} />
        <VolumetricSpotlights />
        <SuspendedScene />
        <EffectComposer>
          <Bloom intensity={0.65} luminanceThreshold={0.3} luminanceSmoothing={0.7} />
          {/* DepthOfField — cinematic bokeh for theatre depth */}
          <DepthOfField focusDistance={0.01} focalLength={0.02} bokehScale={3} />
          <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.001, 0.0015] as unknown as THREE.Vector2} />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function SuspendedScene() {
  return (
    <>
      {/* Warm tungsten environment — approximates 2700K-3200K theatre lighting */}
      <Environment preset="warehouse" />
      <GoldParticleField />
      <StageFloor />
      <FloatingOrb />
    </>
  );
}
