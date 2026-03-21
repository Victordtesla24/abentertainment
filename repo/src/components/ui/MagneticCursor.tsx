"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

// ── Gold particle trail on canvas ─────────────────────────────────────────
function CursorTrail() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.className = "pointer-events-none fixed inset-0 z-[99]";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; size: number }> = [];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMove = (event: MouseEvent) => {
      for (let i = 0; i < 2; i += 1) {
        particles.push({
          x: event.clientX + (Math.random() - 0.5) * 10,
          y: event.clientY + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.5,
          life: 1,
          size: Math.random() * 3 + 1,
        });
      }
    };

    let frameId = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.size *= 0.98;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.life * 0.5})`;
        ctx.fill();
      }
      frameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMove);
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frameId);
      canvas.remove();
    };
  }, []);

  return null;
}

// ── Main cursor component ──────────────────────────────────────────────────
export function MagneticCursor() {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Outer ring: slower / more inertia
  const ringX = useSpring(cursorX, { damping: 28, stiffness: 220, mass: 0.6 });
  const ringY = useSpring(cursorY, { damping: 28, stiffness: 220, mass: 0.6 });
  // Inner dot: snappy
  const dotX = useSpring(cursorX, { damping: 20, stiffness: 500, mass: 0.3 });
  const dotY = useSpring(cursorY, { damping: 20, stiffness: 500, mass: 0.3 });

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 18);
      cursorY.set(e.clientY - 18);
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);
    const handleLinkHover = () => setIsHovered(true);
    const handleLinkLeave = () => setIsHovered(false);

    window.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Attach hover listeners and re-attach on DOM mutations (dynamic elements)
    const attachListeners = () => {
      document.querySelectorAll("a, button, [role='button'], [data-magnetic]").forEach((el) => {
        el.addEventListener("mouseenter", handleLinkHover);
        el.addEventListener("mouseleave", handleLinkLeave);
      });
    };
    attachListeners();
    const observer = new MutationObserver(attachListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
    };
  }, [cursorX, cursorY, isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      <CursorTrail />

      {/* Outer gold ring */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[100] h-9 w-9"
        style={{ x: ringX, y: ringY, opacity: isVisible ? 1 : 0 }}
      >
        <motion.div
          className="h-full w-full rounded-full border border-gold/60"
          animate={{
            scale: isHovered ? 2.2 : 1,
            borderColor: isHovered ? "rgba(201,168,76,1)" : "rgba(201,168,76,0.6)",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        />
      </motion.div>

      {/* Inner dot */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[101] h-2 w-2"
        style={{ x: dotX, y: dotY, marginLeft: "16px", marginTop: "16px", opacity: isVisible ? 1 : 0 }}
      >
        <motion.div
          className="h-full w-full rounded-full bg-gold"
          animate={{ scale: isHovered ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        />
      </motion.div>
    </>
  );
}
