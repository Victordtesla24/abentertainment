import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PortableText } from '@portabletext/react';
import { client } from '@/sanity/lib/client';
import { blogPostBySlugQuery, blogPostsQuery } from '@/sanity/lib/queries';
import imageUrlBuilder from '@sanity/image-url';

export const revalidate = 3600;

const builder = imageUrlBuilder({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
});

function urlFor(source: any) {
  return builder.image(source);
}

export async function generateStaticParams() {
  if (!client) return [];
  try {
    const posts = await client.fetch(blogPostsQuery);
    return posts
      .filter((p: any) => p.slug)
      .map((p: any) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!client) return {};
  try {
    const post = await client.fetch(blogPostBySlugQuery, { slug });
    if (!post) return {};
    const imageUrl = post.heroImage?.asset
      ? urlFor(post.heroImage).width(1200).height(630).url()
      : undefined;
    return {
      title: post.seo?.metaTitle ?? `${post.title} | AB Entertainment`,
      description: post.seo?.metaDescription ?? post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: 'article',
        publishedTime: post.publishedAt,
        authors: [post.author ?? 'AB Entertainment Team'],
        images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630 }] : [],
      },
    };
  } catch {
    return {};
  }
}

const portableTextComponents = {
  block: {
    normal: ({ children }: any) => (
      <p className="mb-6 font-body text-base text-ivory/80 leading-relaxed">{children}</p>
    ),
    h2: ({ children }: any) => (
      <h2 className="font-display text-3xl text-ivory mt-12 mb-5">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="font-display text-2xl text-ivory mt-8 mb-4">{children}</h3>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="my-8 pl-6 border-l-2 border-gold/60 italic font-body text-lg text-ivory/60">
        {children}
      </blockquote>
    ),
  },
  marks: {
    strong: ({ children }: any) => (
      <strong className="font-semibold text-ivory">{children}</strong>
    ),
    em: ({ children }: any) => <em className="italic text-ivory/90">{children}</em>,
    link: ({ value, children }: any) => (
      <a
        href={value?.href}
        target={value?.href?.startsWith('http') ? '_blank' : undefined}
        rel={value?.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
      >
        {children}
      </a>
    ),
  },
  list: {
    bullet: ({ children }: any) => (
      <ul className="mb-6 space-y-2 list-disc list-inside font-body text-ivory/80">{children}</ul>
    ),
    number: ({ children }: any) => (
      <ol className="mb-6 space-y-2 list-decimal list-inside font-body text-ivory/80">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  },
  types: {
    image: ({ value }: any) => {
      if (!value?.asset) return null;
      return (
        <figure className="my-10">
          <div className="relative w-full aspect-video rounded-xl overflow-hidden">
            <Image
              src={urlFor(value).width(1200).url()}
              alt={value.alt ?? ''}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 800px"
            />
          </div>
          {value.caption && (
            <figcaption className="mt-3 text-center font-body text-xs text-ivory/40">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
};

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

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: any = null;
  try {
    if (client) {
      post = await client.fetch(blogPostBySlugQuery, { slug });
    }
  } catch {
    // fall through to notFound
  }

  if (!post) {
    notFound();
  }

  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://abentertainment.web.com';
  const imageUrl = post.heroImage?.asset
    ? urlFor(post.heroImage).width(1200).height(630).url()
    : undefined;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author ?? 'AB Entertainment Team',
    },
    publisher: {
      '@type': 'Organization',
      name: 'AB Entertainment',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-512x512.png` },
    },
    datePublished: post.publishedAt,
    url: `${SITE_URL}/blog/${slug}`,
    ...(imageUrl && {
      image: { '@type': 'ImageObject', url: imageUrl, width: 1200, height: 630 },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="min-h-screen bg-charcoal-deep">
        {/* Hero */}
        {imageUrl ? (
          <div className="relative h-[55vh] min-h-[400px] w-full overflow-hidden">
            <Image
              src={imageUrl}
              alt={post.heroImage?.alt ?? post.title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-charcoal-deep/30 via-transparent to-charcoal-deep" />
          </div>
        ) : (
          <div className="h-32" />
        )}

        <div className="container mx-auto px-4 max-w-3xl pt-12 pb-24">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-8">
            <Link
              href="/blog"
              className="font-mono text-xs tracking-[0.2em] uppercase text-gold/60 hover:text-gold transition-colors"
            >
              ← The Cultural Journal
            </Link>
          </nav>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {post.category && (
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-gold border border-gold/30 rounded-full px-3 py-1">
                {categoryLabel(post.category)}
              </span>
            )}
            {post.tags?.map((tag: string) => (
              <span
                key={tag}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-ivory/30 border border-ivory/10 rounded-full px-3 py-1"
              >
                {tag}
              </span>
            ))}
            {post.aiGenerated && (
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-ivory/20 border border-ivory/10 rounded-full px-3 py-1">
                AI Generated
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-ivory mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="font-body text-xl text-ivory/50 italic leading-relaxed mb-8 border-l-2 border-gold/30 pl-5">
              {post.excerpt}
            </p>
          )}

          {/* Author + date */}
          <div className="flex items-center gap-4 mb-12 pb-12 border-b border-ivory/10">
            <div>
              <p className="font-body text-sm font-semibold text-ivory">
                {post.author ?? 'AB Entertainment Team'}
              </p>
              <p className="font-mono text-xs text-ivory/40">
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString('en-AU', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </p>
            </div>
          </div>

          {/* Body */}
          {post.body && (
            <div>
              <PortableText value={post.body} components={portableTextComponents} />
            </div>
          )}

          {/* Related Event */}
          {post.relatedEvent && (
            <div className="mt-16 pt-10 border-t border-ivory/10">
              <p className="font-mono text-xs tracking-[0.2em] uppercase text-gold/60 mb-4">
                Related Event
              </p>
              <Link
                href={`/events/${post.relatedEvent.slug}`}
                className="group flex items-center gap-4 rounded-2xl border border-ivory/10 hover:border-gold/30 bg-ivory/[0.02] p-5 transition-all"
              >
                {post.relatedEvent.heroImage?.asset && (
                  <div className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={urlFor(post.relatedEvent.heroImage).width(200).height(130).url()}
                      alt={post.relatedEvent.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="font-display text-lg text-ivory group-hover:text-gold transition-colors">
                    {post.relatedEvent.title}
                  </p>
                  {post.relatedEvent.date && (
                    <p className="font-mono text-xs text-ivory/40 mt-1">
                      {new Date(post.relatedEvent.date).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </Link>
            </div>
          )}

          {/* Back link */}
          <div className="mt-16 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-8 py-3 font-body text-sm font-semibold uppercase tracking-widest text-gold hover:bg-gold/10 transition-all"
            >
              ← Back to Journal
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
