import imageUrlBuilder, { type SanityImageSource } from "@sanity/image-url";
import { client } from "./client";

const builder = client ? imageUrlBuilder(client) : null;

export function urlFor(source: SanityImageSource) {
  if (!builder) {
    throw new Error("Sanity image builder is not configured.");
  }

  return builder.image(source);
}
