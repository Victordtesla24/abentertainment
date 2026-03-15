import type { Metadata } from "next";
import { RichTextContent } from "@/components/content/RichTextContent";
import { PageHero } from "@/components/layout/PageHero";
import { FALLBACK_SITE_PAGES } from "@/lib/site-data";
import { loadSitePage } from "@/sanity/lib/loaders";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the terms that govern use of the AB Entertainment website and digital booking flows.",
};

export default async function TermsPage() {
  const page = (await loadSitePage("terms")) ?? FALLBACK_SITE_PAGES.terms;

  return (
    <section className="min-h-screen bg-charcoal-deep">
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        description={page.description}
      />
      <div className="mx-auto max-w-4xl space-y-10 px-6 pb-24 lg:px-8">
        {page.content ? (
          <RichTextContent value={page.content} />
        ) : (
          page.sections?.map((section) => (
            <article
              key={section.title}
              className="rounded-[2rem] border border-ivory/10 bg-charcoal-deep/70 p-8"
            >
              <h2 className="font-display text-2xl text-ivory">{section.title}</h2>
              <div className="mt-4 space-y-4">
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
          ))
        )}
      </div>
    </section>
  );
}
