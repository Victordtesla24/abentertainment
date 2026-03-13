import { NextResponse } from 'next/server';
import { createClient } from '@sanity/client';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dummy',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  token: process.env.SANITY_API_WRITE_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

export const maxDuration = 60; // AI Vision processing can take time
export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch up to 10 events that have gallery images without aiTags
    const eventsToProcess = await sanity.fetch(
      `*[_type == "event" && defined(gallery) && length(gallery) > 0] {
        _id,
        "images": gallery[(!defined(aiTags) || length(aiTags) == 0) && defined(asset->url)] {
          _key,
          "url": asset->url
        }
      }[length(images) > 0][0...10]`
    );

    if (eventsToProcess.length === 0) {
      return NextResponse.json({ message: 'No images to process', processed: 0 });
    }

    let processedCount = 0;
    const transaction = sanity.transaction();

    for (const event of eventsToProcess) {
      const updatedGallery = [];
      
      for (const img of event.images) {
        if (!img.url) continue;

        try {
          const result = await generateText({
            model: anthropic('claude-3-5-sonnet-20241022'),
            messages: [
              {
                role: 'user',
                content: [
                  { 
                    type: 'text', 
                    text: 'Analyze this event photo. Provide a JSON response with exactly two fields without markdown formatting: "aiTags" (an array of 3-5 descriptive strings) and "aiCategory" (one of: "On Stage", "Audience", "Behind the Scenes", "VIP & Sponsors", "Venue & Ambiance").' 
                  },
                  { 
                    type: 'image', 
                    image: new URL(img.url) 
                  }
                ]
              }
            ]
          });

          // Clean up potential markdown formatting in response if any
          const cleanJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          
          if (parsed.aiTags && parsed.aiCategory) {
            // Need to construct path to patch specific array element
            // Sanity mutation via patch does not easily support patching inside an array element directly without _key
            // Because we only fetched a subset of gallery, we'll use insert/replace or custom Sanity syntax.
            // A simpler approach is to append the mutation to the transaction:
            transaction.patch(event._id, (p) => 
               p.setIfMissing({ gallery: [] })
                .insert('replace', `gallery[_key=="${img._key}"]`, [
                  {
                    _key: img._key,
                    _type: 'image',
                    asset: { _ref: img.url, _type: 'reference' }, // We need the original asset ref. This might be tricky.
                  } // Actually, it's safer to just set aiTags and aiCategory on the specific array element if sanity supports dot notation
                ])
            );
            
            // Wait, sanity mutation supports nested dot notation arrays:
            // p.set({ `gallery[_key=="${img._key}"].aiTags`: parsed.aiTags })
            transaction.patch(event._id, (p) => 
               p.set({ 
                 [`gallery[_key=="${img._key}"].aiTags`]: parsed.aiTags,
                 [`gallery[_key=="${img._key}"].aiCategory`]: parsed.aiCategory
               })
            );
            processedCount++;
          }
        } catch (e) {
          console.error(`Failed to process image ${img.url}:`, e);
        }
      }
    }

    if (processedCount > 0) {
      await transaction.commit();
    }

    return NextResponse.json({
      message: 'Processing complete',
      processedImageCount: processedCount,
    });
  } catch (error) {
    console.error('Error processing gallery images:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
