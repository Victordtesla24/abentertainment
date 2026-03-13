import { createClient } from '@sanity/client';
import { notFound } from 'next/navigation';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await sanity.fetch(`*[_type == "post"]{ "slug": slug.current }`);
  return slugs.filter((p: any) => p.slug).map((p: any) => ({
    slug: p.slug,
  }));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const post = await sanity.fetch(
    `*[_type == "post" && slug.current == $slug][0] {
      title,
      excerpt,
      publishedAt,
      body
    }`,
    { slug }
  );

  if (!post) {
    notFound();
  }

  // Very basic blocks-to-text rendering for simplicity
  const renderBody = () => {
    if (!post.body || !Array.isArray(post.body)) return null;
    return post.body.map((block: any, i: number) => {
      if (block._type === 'block' && block.children) {
        return (
          <p key={i} className="mb-6">
            {block.children.map((child: any) => child.text).join('')}
          </p>
        );
      }
      return null;
    });
  };

  return (
    <article className="min-h-screen bg-charcoal pt-32 pb-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <header className="mb-12 text-center">
          <div className="mb-6">
            <span className="text-gold font-jetbrainsMono text-sm tracking-[0.2em] uppercase">
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Recent Article'}
            </span>
          </div>
          <h1 className="font-playfair text-4xl md:text-5xl lg:text-6xl text-ivory mb-6 leading-tight">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="font-satoshi text-xl text-ivory/60 italic max-w-2xl mx-auto">
              {post.excerpt}
            </p>
          )}
        </header>

        <div className="prose prose-invert prose-lg max-w-none font-satoshi text-ivory/80 leading-relaxed marker:text-gold prose-p:mb-6 prose-headings:font-playfair prose-headings:text-gold prose-a:text-gold hover:prose-a:text-gold-light">
          {renderBody()}
        </div>
      </div>
    </article>
  );
}
