import { createClient } from '@sanity/client';
import Link from 'next/link';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
});

export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await sanity.fetch(
    `*[_type == "post"] | order(publishedAt desc) {
      _id,
      title,
      "slug": slug.current,
      excerpt,
      publishedAt
    }`
  );

  return (
    <div className="min-h-screen bg-charcoal pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="font-playfair text-5xl md:text-6xl text-gold mb-6 text-center">
          The Cultural Journal
        </h1>
        <p className="font-satoshi text-ivory/60 text-center max-w-2xl mx-auto mb-16 text-lg">
          Insights, reflections, and stories from the heart of Melbourne's Indian arts and cultural scene.
        </p>

        {posts.length === 0 ? (
          <div className="text-center text-ivory/80 font-satoshi py-12">
            No articles found. Check back later for fresh cultural insights.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {posts.map((post: any) => (
              <Link 
                key={post._id} 
                href={`/blog/${post.slug || '#'}`}
                className="group block bg-charcoal-light/50 border border-gold/10 hover:border-gold/40 rounded-2xl p-8 transition-all duration-300 hover:bg-gold/5"
              >
                <div className="mb-4">
                  <span className="text-gold font-jetbrainsMono text-sm tracking-widest uppercase">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
                <h2 className="font-playfair text-2xl text-ivory mb-4 group-hover:text-gold transition-colors">
                  {post.title}
                </h2>
                <p className="font-satoshi text-ivory/70 line-clamp-3">
                  {post.excerpt || 'Read more about this cultural highlight...'}
                </p>
                <div className="mt-6 inline-flex items-center text-gold font-satoshi text-sm uppercase tracking-wider font-semibold group-hover:underline">
                  Read Article
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
