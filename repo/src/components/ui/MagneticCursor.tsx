"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

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

export function MagneticCursor() {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16);
      cursorY.set(e.clientY - 16);
    };

    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseLeave = () => setIsVisible(false);

    const handleLinkHover = () => setIsHovered(true);
    const handleLinkLeave = () => setIsHovered(false);

    window.addEventListener("mousemove", moveCursor);
    document.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseleave", handleMouseLeave);

    const interactiveElements = document.querySelectorAll(
      "a, button, [role='button'], [data-magnetic]"
    );

    interactiveElements.forEach((el) => {
      el.addEventListener("mouseenter", handleLinkHover);
      el.addEventListener("mouseleave", handleLinkLeave);
    });

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      document.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseleave", handleMouseLeave);
      interactiveElements.forEach((el) => {
        el.removeEventListener("mouseenter", handleLinkHover);
        el.removeEventListener("mouseleave", handleLinkLeave);
      });
    };
  }, [cursorX, cursorY, isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      <CursorTrail />
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[100] h-8 w-8 mix-blend-difference"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          opacity: isVisible ? 1 : 0,
        }}
      >
        <motion.div
          className="flex h-full w-full items-center justify-center rounded-full border border-ivory/50 bg-ivory/10 backdrop-blur-sm"
          animate={{
            scale: isHovered ? 1.8 : 1,
            backgroundColor: isHovered
              ? "rgba(245, 240, 232, 1)"
              : "rgba(245, 240, 232, 0.1)",
            borderWidth: isHovered ? "0px" : "1px",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
        />
      </motion.div>
    </>
  );
}
