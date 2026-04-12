'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import * as THREE from 'three';

// ─── Hero Slide Data ────────────────────────────────────────────────────────
const heroSlides = [
  {
    id: 'slide-1',
    badge: 'Welcome to',
    title: 'AB ENTERTAINMENT',
    subtitle: "Melbourne's Legendary Indian & Marathi Performing Arts Experience",
    bg: '/images/hero-bg.jpg',
  },
  {
    id: 'slide-2',
    badge: 'Celebrating',
    title: 'CULTURAL EXCELLENCE',
    subtitle: 'Indian & Marathi Performing Arts in Melbourne',
    bg: '/images/hero-bg-2.jpg',
  },
  {
    id: 'slide-3',
    badge: 'Discover',
    title: 'UNFORGETTABLE MOMENTS',
    subtitle: '6+ Events · 25+ Team · 25,000+ Audience Reach',
    bg: '/images/hero-bg.jpg',
  },
];

/**
 * Hero video background configuration.
 * Uses stable production video assets from public/video.
 * Falls back gracefully to image carousel if video fails to load.
 * Video assets are stored in public/video/ (same directory as other video assets).
 */
const HERO_VIDEO = {
  src: '/video/ab-transition.mp4',
  webmSrc: '/video/ab-transition.webm',
  poster: '/images/hero-bg.jpg',
};

const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];
const SLIDE_DURATION = 8000;

// ─── Volumetric Spotlight WebGL Layer ───────────────────────────────────────
function VolumetricSpotlight({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Detect low-power devices
    const isLowPower = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isLowPower) return;

    const gl =
      canvas.getContext('webgl2', { alpha: true, antialias: false }) ||
      canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) {
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl,
        antialias: false,
        alpha: true,
      });
    } catch {
      // Gracefully degrade when WebGL is unavailable so the hero still renders.
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    camera.position.set(0, 0, 5);

    // ─── Volumetric Cone (Spotlight beam) ──────────────────────────────
    const coneGeo = new THREE.ConeGeometry(3, 8, 32, 1, true);
    const coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#C9A84C') },
        uOpacity: { value: 0.08 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vY;
        void main() {
          vUv = uv;
          vY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        varying float vY;

        void main() {
          // Gradient from tip (bright) to base (transparent)
          float gradient = smoothstep(-4.0, 4.0, vY);
          float alpha = gradient * uOpacity;

          // Edge falloff
          float dist = distance(vUv, vec2(0.5, vUv.y));
          alpha *= smoothstep(0.5, 0.2, dist);

          // Animated shimmer
          float shimmer = sin(vUv.y * 20.0 + uTime * 2.0) * 0.15 + 0.85;
          alpha *= shimmer;

          // Dust particles effect
          float dust = sin(vUv.x * 40.0 + uTime) * sin(vUv.y * 30.0 - uTime * 0.5);
          dust = smoothstep(0.7, 1.0, dust) * 0.3;
          alpha += dust * gradient;

          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 2, -2);
    cone.rotation.z = Math.PI;
    scene.add(cone);

    // Secondary spotlight beam (dimmer, offset)
    const cone2 = cone.clone();
    const mat2 = coneMat.clone();
    mat2.uniforms.uOpacity.value = 0.04;
    cone2.material = mat2;
    cone2.position.set(-1.5, 2.5, -3);
    cone2.rotation.z = Math.PI;
    cone2.rotation.x = 0.15;
    cone2.scale.setScalar(0.7);
    scene.add(cone2);

    // Third beam from right
    const cone3 = cone.clone();
    const mat3 = coneMat.clone();
    mat3.uniforms.uOpacity.value = 0.04;
    cone3.material = mat3;
    cone3.position.set(1.5, 2.5, -3);
    cone3.rotation.z = Math.PI;
    cone3.rotation.x = -0.15;
    cone3.scale.setScalar(0.7);
    scene.add(cone3);

    // ─── Floating gold dust particles ──────────────────────────────────
    const dustCount = 120;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustVelocities = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 8;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
      dustVelocities[i * 3] = (Math.random() - 0.5) * 0.003;
      dustVelocities[i * 3 + 1] = Math.random() * 0.004 + 0.001;
      dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0xC9A84C,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // ─── Animation Loop ────────────────────────────────────────────────
    let time = 0;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.01;

      // Update shader uniforms
      coneMat.uniforms.uTime.value = time;
      mat2.uniforms.uTime.value = time + 1.0;
      mat3.uniforms.uTime.value = time + 2.0;

      // Slow spotlight sway
      cone.rotation.x = Math.sin(time * 0.3) * 0.08;
      cone.position.x = Math.sin(time * 0.2) * 0.3;

      cone2.rotation.x = Math.sin(time * 0.25 + 1) * 0.1 + 0.15;
      cone3.rotation.x = Math.sin(time * 0.25 + 2) * 0.1 - 0.15;

      // Update dust particles
      const positions = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        let x = positions.getX(i) + dustVelocities[i * 3];
        let y = positions.getY(i) + dustVelocities[i * 3 + 1];
        const z = positions.getZ(i) + dustVelocities[i * 3 + 2];

        // Wrap around
        if (y > 4) y = -3;
        if (x > 5) x = -5;
        if (x < -5) x = 5;

        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;

      renderer.render(scene, camera);
    }

    animate();

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      coneGeo.dispose();
      coneMat.dispose();
      mat2.dispose();
      mat3.dispose();
      dustGeo.dispose();
      dustMat.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Main CinematicHero ─────────────────────────────────────────────────────
export function CinematicHero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [slides, setSlides] = useState(heroSlides);

  // Fetch live hero settings so admin changes appear without rebuild
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.heroTitle) return;
        setSlides(prev => prev.map((s, i) => i === 0
          ? { ...s, subtitle: data.heroSubtitle || s.subtitle }
          : s
        ));
      })
      .catch(() => {});
  }, []);

  const { scrollY } = useScroll();
  const parallaxBg = useTransform(scrollY, [0, 800], [0, -150]);
  const parallaxContent = useTransform(scrollY, [0, 800], [0, -60]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 800], [1, 1.05]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const handleDotKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % slides.length;
      goToSlide(next);
      (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + slides.length) % slides.length;
      goToSlide(prev);
      (e.currentTarget.parentElement?.children[prev] as HTMLElement)?.focus();
    }
  }, [goToSlide]);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    const htmlHasPreloaderDone = document.documentElement.classList.contains(
      'preloader-done'
    );
    if (htmlHasPreloaderDone) {
      setHeroReady(true);
      return;
    }

    const handlePreloaderComplete = () => setHeroReady(true);
    window.addEventListener('ab:preloader-complete', handlePreloaderComplete);

    // Fallback: if preloader event never fires (e.g. video fails to load), start hero after 5 seconds
    const fallbackTimer = setTimeout(() => {
      setHeroReady(true);
    }, 5000);

    return () => {
      window.removeEventListener('ab:preloader-complete', handlePreloaderComplete);
      clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <section
      className="relative w-full h-screen overflow-hidden bg-black"
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero slideshow"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPaused(false);
      }}
    >
      {/* Animated Background Images with Ken Burns */}
      <motion.div className="absolute inset-0" style={{ y: parallaxBg, scale: heroScale }}>
        {/* Video background layer — plays when asset exists, falls back to image slideshow */}
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_VIDEO.poster}
          className="absolute inset-0 w-full h-[130%] object-cover"
          style={{ filter: 'saturate(0.85) contrast(1.1)' }}
          aria-hidden="true"
          onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
        >
          <source src={HERO_VIDEO.src} type="video/mp4" />
          <source src={HERO_VIDEO.webmSrc} type="video/webm" />
        </video>

        {/* Image slideshow fallback — visible when video not available */}
        <AnimatePresence mode="sync">
          <motion.div
            key={slides[currentSlide].bg + currentSlide}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1.0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 2.2, ease: EASE }}
          >
            <img
              src={slides[currentSlide].bg}
              alt=""
              aria-hidden="true"
              width={1920}
              height={1080}
              className="w-full h-[130%] object-cover"
              style={{ filter: 'saturate(0.85) contrast(1.1)' }}
              loading={currentSlide === 0 ? 'eager' : 'lazy'}
              fetchPriority={currentSlide === 0 ? 'high' : 'auto'}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Cinematic overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90 z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 z-[1]" />
      <div className="absolute inset-0 z-[2]" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)',
      }} />
      <div className="film-grain" />
      <div className="absolute inset-0 z-[3] opacity-[0.04]" style={{
        background: 'radial-gradient(ellipse at 50% 80%, rgba(201,168,76,0.3), transparent 60%)',
      }} />

      {/* Volumetric Spotlight WebGL Layer */}
      <VolumetricSpotlight className="z-[4]" />

      {/* Hero Content */}
      <motion.div
        className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center"
        style={{ y: parallaxContent, opacity: heroOpacity }}
        initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
        animate={
          heroReady
            ? { opacity: 1, y: 0, filter: 'blur(0px)' }
            : { opacity: 0, y: 24, filter: 'blur(10px)' }
        }
        transition={{ duration: 0.9, ease: EASE }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.7, filter: 'blur(10px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.5, ease: EASE }}
          className="mb-10"
        >
          <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto">
            <div className="absolute inset-0 rounded-full bg-[#C9A84C]/10 blur-2xl animate-pulse" />
            <Image
              src="/images/AB_Logo_transparent.png"
              alt="AB Entertainment Logo"
              fill
              className="object-contain drop-shadow-[0_0_30px_rgba(201,168,76,0.4)]"
              priority
            />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl px-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
              className="mb-6"
            >
              <span className="inline-block px-6 py-2.5 bg-gradient-to-r from-[#C9A84C]/10 via-[#C9A84C]/20 to-[#C9A84C]/10 border border-[#C9A84C]/25 text-[#C9A84C] text-sm md:text-base font-body font-medium tracking-[0.2em] uppercase backdrop-blur-md">
                {slides[currentSlide].badge}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 1, delay: 0.3, ease: EASE }}
              className="text-5xl md:text-7xl lg:text-[6rem] xl:text-[7.5rem] font-black leading-[0.88] tracking-tight uppercase mb-7"
              style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
            >
              <span className="gold-shimmer">{slides[currentSlide].title}</span>
            </motion.h1>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, delay: 0.6, ease: EASE }}
              className="flex items-center justify-center gap-3 mb-7 origin-center"
            >
              <div className="w-16 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/50" />
              <div className="w-1.5 h-1.5 rotate-45 bg-[#C9A84C]/60" />
              <div className="w-16 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/50" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8, ease: EASE }}
              className="text-lg md:text-xl lg:text-2xl text-white/70 font-body font-light tracking-wide max-w-2xl mx-auto"
            >
              {slides[currentSlide].subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0, ease: EASE }}
          className="mt-12 flex flex-col sm:flex-row gap-5"
        >
          <Link
            href="/events"
            className="group relative px-10 py-4 bg-gradient-to-r from-[#C9A84C] via-[#D4B65C] to-[#C9A84C] text-black text-sm uppercase tracking-[0.15em] font-body font-bold overflow-hidden transition-all duration-500 hover:shadow-[0_0_40px_rgba(201,168,76,0.4)] hover:scale-[1.02]"
          >
            <span className="relative z-10">Buy Tickets</span>
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4B65C] via-[#E8D5A3] to-[#D4B65C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Link>
          <Link
            href="/contact"
            className="group px-10 py-4 border border-white/20 text-white text-sm uppercase tracking-[0.15em] font-body font-medium hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-all duration-500 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(201,168,76,0.15)]"
          >
            Contact Us
          </Link>
        </motion.div>

        {/* Carousel dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-14 flex gap-3 items-center"
        >
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              onKeyDown={(e) => handleDotKeyDown(e, index)}
              className={`relative h-[2px] transition-all duration-700 ease-out overflow-hidden focus-visible:outline-2 focus-visible:outline-[#C9A84C] focus-visible:outline-offset-4 ${
                currentSlide === index
                  ? 'bg-[#C9A84C]/30 w-12'
                  : 'bg-white/50 w-3 hover:bg-white/60'
              }`}
              aria-current={currentSlide === index ? 'true' : 'false'}
              aria-label={`Go to slide ${index + 1}`}
            >
              {currentSlide === index && (
                <motion.div
                  className="absolute inset-0 bg-[#C9A84C]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: SLIDE_DURATION / 1000, ease: 'linear' }}
                  style={{ transformOrigin: 'left' }}
                />
              )}
            </button>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom cinematic fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent z-20 pointer-events-none" />

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-[#C9A84C]/70 text-[9px] uppercase tracking-[0.3em] font-body">Scroll</span>
        <div className="w-[1px] h-10 bg-gradient-to-b from-[#C9A84C]/40 to-[#C9A84C]" />
      </motion.div>
    </section>
  );
}
