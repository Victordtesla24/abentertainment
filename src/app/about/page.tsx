import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { TeamSection } from "@/components/sections/TeamSection";
import { VisionSection } from "@/components/sections/VisionSection";
import { FALLBACK_SPONSORS } from "@/lib/site-data";
import { loadSitePage } from "@/sanity/lib/loaders";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about AB Entertainment's operating philosophy, founders, and approach to premium Indian and Marathi cultural experiences.",
};

export default async function AboutPage() {
  const page = await loadSitePage("about");

  if (!page) {
    return null;
  }

  return (
    <section className="min-h-screen bg-charcoal">
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />
      <VisionSection />

      {page.sections ? (
        <section className="bg-charcoal-deep px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
            {page.sections.map((section) => (
              <article
                key={section.title}
                className="rounded-[2rem] border border-ivory/10 bg-charcoal p-8"
              >
                <h2 className="font-display text-3xl text-ivory">
                  {section.title}
                </h2>
                <div className="mt-5 space-y-4">
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="font-body text-base leading-relaxed text-ivory/65"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <TeamSection />

      <section className="bg-charcoal-deep px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-body text-xs uppercase tracking-[0.3em] text-gold/70">
            Sponsor Confidence
          </p>
          <h2 className="mt-4 font-display text-3xl text-ivory md:text-4xl">
            Built for high-trust partnerships.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {FALLBACK_SPONSORS.map((sponsor) => (
              <article
                key={sponsor.id}
                className="rounded-[2rem] border border-ivory/10 bg-charcoal p-8"
              >
                <p className="font-body text-xs uppercase tracking-[0.2em] text-gold/70">
                  {sponsor.tier}
                </p>
                <h3 className="mt-3 font-display text-2xl text-ivory">
                  {sponsor.name}
                </h3>
                <p className="mt-4 font-body text-sm leading-relaxed text-ivory/55">
                  {sponsor.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
