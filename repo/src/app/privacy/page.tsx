import type { Metadata } from "next";
import { RichTextContent } from "@/components/content/RichTextContent";
import { PageHero } from "@/components/layout/PageHero";
import { FALLBACK_SITE_PAGES } from "@/lib/site-data";
import { loadSitePage } from "@/sanity/lib/loaders";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Review how AB Entertainment handles personal information collected through the website and event workflows.",
};

export default async function PrivacyPage() {
  const page = (await loadSitePage("privacy")) ?? FALLBACK_SITE_PAGES.privacy;

  return (
    <section className="min-h-screen bg-charcoal">
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
