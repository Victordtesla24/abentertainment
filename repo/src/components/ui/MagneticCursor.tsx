"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, [role='button'], [data-magnetic]";

export function MagneticCursor() {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const hoveredRef = useRef(false);
  const visibleRef = useRef(false);
  const activeMagneticRef = useRef<HTMLElement | null>(null);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 24, stiffness: 280, mass: 0.55 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener("resize", checkDesktop);

    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }

    const resetMagneticTarget = (target: HTMLElement | null) => {
      if (!target) {
        return;
      }

      target.style.setProperty("--magnetic-x", "0px");
      target.style.setProperty("--magnetic-y", "0px");
    };

    const setHoveredState = (value: boolean) => {
      if (hoveredRef.current === value) {
        return;
      }

      hoveredRef.current = value;
      setIsHovered(value);
    };

    const setVisibleState = (value: boolean) => {
      if (visibleRef.current === value) {
        return;
      }

      visibleRef.current = value;
      setIsVisible(value);
    };

    const handleMouseMove = (event: MouseEvent) => {
      cursorX.set(event.clientX - 16);
      cursorY.set(event.clientY - 16);
      setVisibleState(true);

      const target = (event.target as HTMLElement | null)?.closest(
        INTERACTIVE_SELECTOR
      ) as HTMLElement | null;
      setHoveredState(Boolean(target));

      const magneticTarget = (event.target as HTMLElement | null)?.closest(
        "[data-magnetic]"
      ) as HTMLElement | null;

      if (activeMagneticRef.current && activeMagneticRef.current !== magneticTarget) {
        resetMagneticTarget(activeMagneticRef.current);
      }

      activeMagneticRef.current = magneticTarget;

      if (!magneticTarget) {
        return;
      }

      const rect = magneticTarget.getBoundingClientRect();
      const offsetX = ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * 18;
      const offsetY = ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * 18;

      magneticTarget.style.setProperty("--magnetic-x", `${offsetX}px`);
      magneticTarget.style.setProperty("--magnetic-y", `${offsetY}px`);
    };

    const handlePointerLeave = () => {
      setHoveredState(false);
      setVisibleState(false);
      resetMagneticTarget(activeMagneticRef.current);
      activeMagneticRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      resetMagneticTarget(activeMagneticRef.current);
      activeMagneticRef.current = null;
    };
  }, [cursorX, cursorY, isDesktop]);

  if (!isDesktop) {
    return null;
  }

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[100] h-8 w-8"
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        opacity: isVisible ? 1 : 0,
      }}
    >
      <motion.div
        className="relative flex h-full w-full items-center justify-center"
        animate={{
          scale: isHovered ? 1.7 : 1,
        }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
      >
        <motion.span
          className="absolute inset-0 rounded-full border border-ivory/55 bg-ivory/6 backdrop-blur-sm"
          animate={{
            opacity: isHovered ? 0.95 : 0.75,
            backgroundColor: isHovered
              ? "rgba(245, 240, 232, 0.22)"
              : "rgba(245, 240, 232, 0.06)",
            borderColor: isHovered
              ? "rgba(201, 168, 76, 0.8)"
              : "rgba(245, 240, 232, 0.55)",
          }}
          transition={{ duration: 0.2 }}
        />
        <motion.span
          className="h-1.5 w-1.5 rounded-full bg-gold"
          animate={{
            scale: isHovered ? 1.6 : 1,
            opacity: isHovered ? 0.9 : 0.7,
          }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
        />
      </motion.div>
    </motion.div>
  );
}
