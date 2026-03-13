import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  token: process.env.SANITY_API_WRITE_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

export const maxDuration = 60;
export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Generate topic for Indian Cultural Events in Melbourne
    const prompt = `You are an expert cultural blogger for AB Entertainment, Melbourne's premium Indian events brand.
Write a fresh, engaging blog post (around 400-600 words) about Indian arts, theatre, music, or cultural events in Melbourne.
Return ONLY a valid JSON object with absolute NO markdown blocks like \`\`\`json:
{
  "title": "A catchy, SEO-friendly headline",
  "excerpt": "A 2-sentence summary of the post",
  "content": "The full blog post content in rich text format (Markdown or simple text)"
}`;

    const result = await generateText({
      model: openai('gpt-4o'),
      prompt,
    });

    const cleanJson = result.text.replace(/\r?\n/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
    const blogPost = JSON.parse(cleanJson);

    // Create the blog post in Sanity
    const doc = await sanity.create({
      _type: 'post',
      title: blogPost.title,
      slug: {
        _type: 'slug',
        current: blogPost.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      },
      excerpt: blogPost.excerpt,
      // Simplifying the block content for our basic implementation, in a real scenario we'd use block format
      body: [
        {
          _type: 'block',
          children: [{ _type: 'span', text: blogPost.content }],
          markDefs: [],
          style: 'normal'
        }
      ],
      publishedAt: new Date().toISOString()
    });

    return NextResponse.json({
      message: 'Successfully generated and published AI blog post',
      post_id: doc._id,
      title: blogPost.title
    });

  } catch (error) {
    console.error('Error auto-generating blog content:', error);
    return NextResponse.json({ error: 'AI Blog Generation failed' }, { status: 500 });
  }
}
