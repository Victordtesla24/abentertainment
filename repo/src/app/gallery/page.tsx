import type { Metadata } from "next";
import { GalleryPageClient } from "@/components/pages/GalleryPageClient";
import { PageDecorations } from "@/components/layout/PageDecorations";
import { loadGallery } from "@/sanity/lib/loaders";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Explore the visual archive of AB Entertainment productions, audience moments, and backstage atmosphere.",
};

export default async function GalleryPage() {
  const galleryItems = await loadGallery();
  return (
    <div className="relative">
      <PageDecorations />
      <GalleryPageClient galleryItems={galleryItems} />
    </div>
  );
}
