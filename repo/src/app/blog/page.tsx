import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { client } from '@/sanity/lib/client';
import { blogPostsQuery } from '@/sanity/lib/queries';
import imageUrlBuilder from '@sanity/image-url';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'The Cultural Journal | AB Entertainment',
  description:
    "Insights, reflections, and stories from the heart of Melbourne's Indian arts and cultural scene.",
  openGraph: {
    title: 'The Cultural Journal | AB Entertainment',
    description: 'Insights, reflections, and stories from Melbourne\'s premier Indian cultural event company.',
    type: 'website',
  },
};

const builder = imageUrlBuilder({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
});

function urlFor(source: any) {
  return builder.image(source);
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    'event-recap': 'Event Recap',
    'artist-spotlight': 'Artist Spotlight',
    'cultural-commentary': 'Cultural Commentary',
    'behind-the-scenes': 'Behind the Scenes',
    'announcements': 'Announcements',
  };
  return map[cat] ?? cat;
}

export default async function BlogPage() {
  let posts: any[] = [];
  try {
    if (client) {
      posts = await client.fetch(blogPostsQuery);
    }
  } catch {
    // Return empty state gracefully
  }

  return (
    <div className="min-h-screen bg-charcoal-deep pt-32 pb-24">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <header className="mb-16 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-12 bg-gold/40" />
            <span className="font-mono text-xs tracking-[0.4em] text-gold/60 uppercase">Journal</span>
            <div className="h-px w-12 bg-gold/40" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-ivory mb-6">
            The Cultural Journal
          </h1>
          <p className="font-body text-lg text-ivory/60 max-w-2xl mx-auto leading-relaxed">
            Insights, reflections, and stories from the heart of Melbourne's Indian arts
            and cultural scene.
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="text-center py-24">
            <p className="font-body text-ivory/65 text-lg">
              New articles are being prepared. Check back soon for fresh cultural insights.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post: any, index: number) => (
              <article key={post.id ?? post._id ?? index}>
                <Link
                  href={`/blog/${post.slug ?? '#'}`}
                  className="group block h-full rounded-2xl border border-ivory/10 bg-ivory/[0.02] overflow-hidden transition-all duration-300 hover:border-gold/30 hover:bg-ivory/[0.04]"
                >
                  {/* Hero image */}
                  {post.heroImage?.asset && (
                    <div className="relative h-52 overflow-hidden">
                      <Image
                        src={urlFor(post.heroImage).width(600).height(400).url()}
                        alt={post.heroImage.alt ?? post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                    </div>
                  )}

                  <div className="p-7">
                    {/* Meta */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      {post.category && (
                        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gold/70 border border-gold/20 rounded-full px-2.5 py-0.5">
                          {categoryLabel(post.category)}
                        </span>
                      )}
                      {post.aiGenerated && (
                        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ivory/55 border border-ivory/10 rounded-full px-2.5 py-0.5">
                          AI
                        </span>
                      )}
                    </div>

                    <h2 className="font-display text-xl text-ivory mb-3 leading-snug group-hover:text-gold transition-colors duration-200 line-clamp-2">
                      {post.title}
                    </h2>

                    {post.excerpt && (
                      <p className="font-body text-sm text-ivory/60 leading-relaxed line-clamp-3 mb-5">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-ivory/5">
                      <span className="font-mono text-xs text-ivory/55">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Recent'}
                      </span>
                      <span className="font-body text-xs font-semibold uppercase tracking-wider text-gold group-hover:underline">
                        Read →
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
