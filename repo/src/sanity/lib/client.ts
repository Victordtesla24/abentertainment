import { createClient } from "next-sanity";
import { env, isSanityConfigured } from "@/lib/env";

export const client = isSanityConfigured
  ? createClient({
      projectId: env.sanity.projectId!,
      dataset: env.sanity.dataset!,
      apiVersion: "2024-01-01",
      token: env.sanity.token,
      useCdn: process.env.NODE_ENV === "production" && !env.sanity.token,
    })
  : null;
