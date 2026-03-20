"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryImage } from "@/types";

type GalleryLightboxProps = {
  images: GalleryImage[];
  initialIndex?: number;
  onClose: () => void;
};

export function GalleryLightbox({ images, initialIndex = 0, onClose }: GalleryLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overlayRef.current || !imageRef.current) return;
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
    gsap.fromTo(imageRef.current, { scale: 0.96, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "power3.out" });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setActiveIndex((prev) => (prev + 1) % images.length);
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, onClose]);

  const handleSwipe = (direction: "left" | "right") => {
    const next =
      direction === "left" ? (activeIndex + 1) % images.length : (activeIndex - 1 + images.length) % images.length;
    if (!imageRef.current) {
      setActiveIndex(next);
      return;
    }
    gsap.to(imageRef.current, {
      x: direction === "left" ? -100 : 100,
      opacity: 0,
      duration: 0.2,
      onComplete: () => {
        setActiveIndex(next);
        gsap.fromTo(
          imageRef.current,
          { x: direction === "left" ? 100 : -100, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.3, ease: "power2.out" }
        );
      },
    });
  };

  const image = images[activeIndex];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[120] bg-charcoal-deep/95 p-4 backdrop-blur-md md:p-12"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery image viewer"
    >
      <div ref={imageRef} className="relative mx-auto h-full max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl">
        <Image src={image.src} alt={image.alt} fill className="object-cover" />
      </div>
      <button
        onClick={onClose}
        className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-full border border-gold/25 bg-charcoal-deep/70 text-gold"
        aria-label="Close lightbox"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        onClick={() => handleSwipe("right")}
        className="absolute left-6 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-ivory/12 bg-charcoal-deep/70 text-ivory"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => handleSwipe("left")}
        className="absolute right-6 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-ivory/12 bg-charcoal-deep/70 text-ivory"
        aria-label="Next image"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
