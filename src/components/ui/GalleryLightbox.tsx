'use client';

import { useState, useCallback } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import 'yet-another-react-lightbox/styles.css';

interface GalleryLightboxProps {
  images: { src: string; alt: string; title?: string }[];
}

function GalleryImage({ image, onClick }: { image: { src: string; alt: string }; onClick: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <button
      onClick={onClick}
      className="block w-full overflow-hidden border border-[#C9A84C]/10 hover:border-[#C9A84C]/30 transition-all duration-500 group cursor-pointer break-inside-avoid mb-4"
      aria-label={`View ${image.alt} in lightbox`}
    >
      <div className="relative overflow-hidden">
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white opacity-0 group-hover:opacity-80 transition-opacity duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export default function GalleryLightbox({ images }: GalleryLightboxProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const openLightbox = useCallback((idx: number) => {
    setIndex(idx);
    setOpen(true);
  }, []);

  const slides = images.map((img) => ({
    src: img.src,
    alt: img.alt,
    title: img.title,
  }));

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((image, idx) => (
          <GalleryImage key={image.src} image={image} onClick={() => openLightbox(idx)} />
        ))}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        slides={slides}
        plugins={[Zoom, Fullscreen]}
        styles={{
          container: { backgroundColor: 'rgba(10, 10, 10, 0.95)' },
        }}
        zoom={{
          maxZoomPixelRatio: 3,
          scrollToZoom: true,
        }}
      />
    </>
  );
}
