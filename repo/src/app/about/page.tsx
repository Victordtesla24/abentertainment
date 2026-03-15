import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { TeamSection } from "@/components/sections/TeamSection";
import { VisionSection } from "@/components/sections/VisionSection";
import { FALLBACK_SPONSORS } from "@/lib/site-data";
import { loadSitePage } from "@/sanity/lib/loaders";
import type { PageSection } from "@/types";

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
    <section className="min-h-screen bg-charcoal-deep">
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />
      <VisionSection />

      {page.sections ? (
        <section className="bg-charcoal-deep px-6 py-20">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="luxury-panel-dark rounded-[2rem] p-8 md:p-10">
              <p className="eyebrow-label">Operating Philosophy</p>
              <h2 className="mt-8 max-w-md font-display text-4xl leading-tight text-ivory">
                Built with the discipline of premium live production.
              </h2>
              <div className="mt-8 space-y-5">
                {page.sections[0]?.body.map((paragraph: string) => (
                  <p
                    key={paragraph}
                    className="font-body text-base leading-relaxed text-ivory/80 md:text-lg"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>

            <div className="grid gap-6">
              {page.sections.slice(1).map((section: PageSection) => (
                <article
                  key={section.title}
                  className="luxury-panel-dark rounded-[2rem] p-8"
                >
                  <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
                    {section.title}
                  </p>
                  <div className="mt-5 space-y-4">
                    {section.body.map((paragraph: string) => (
                      <p
                        key={paragraph}
                        className="font-body text-base leading-relaxed text-ivory/80"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <TeamSection />

      <section className="bg-charcoal-deep px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow-label">
            Sponsor Confidence
          </p>
          <h2 className="mt-8 max-w-lg font-display text-4xl leading-tight text-ivory md:text-5xl">
            Built for high-trust partnerships.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {FALLBACK_SPONSORS.map((sponsor) => (
              <article
                key={sponsor.id}
                className="luxury-panel-dark rounded-[2rem] p-8"
              >
                <p className="font-body text-[0.62rem] uppercase tracking-[0.34em] text-gold/72">
                  {sponsor.tier}
                </p>
                <h3 className="mt-5 font-display text-3xl text-ivory">
                  {sponsor.name}
                </h3>
                <p className="mt-4 font-body text-sm leading-relaxed text-ivory/75">
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
