import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await req.formData();
  const tier = formData.get('tier') as string | null;
  const logoFile = formData.get('logo') as File | null;

  if (!tier) {
    return NextResponse.json({ error: 'Tier is required' }, { status: 400 });
  }

  // Upload logo to Sanity if provided
  let logoAssetId: string | undefined;
  if (logoFile && logoFile.size > 0) {
    const sanityToken = process.env.SANITY_API_WRITE_TOKEN;
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
    const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';

    if (sanityToken && projectId) {
      const logoBuffer = await logoFile.arrayBuffer();
      const uploadResponse = await fetch(
        `https://${projectId}.api.sanity.io/v2024-01-01/assets/images/${dataset}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sanityToken}`,
            'Content-Type': logoFile.type || 'image/png',
          },
          body: logoBuffer,
        }
      );

      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json() as { document?: { _id: string } };
        logoAssetId = uploadData?.document?._id;
      }
    }
  }

  // Upsert sponsor document in Sanity with the authenticated user's info
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
  const sanityToken = process.env.SANITY_API_WRITE_TOKEN;

  if (projectId && sanityToken) {
    const mutations = [
      {
        createOrReplace: {
          _type: 'sponsor',
          _id: `sponsor-${userId}`,
          clerkUserId: userId,
          tier,
          updatedAt: new Date().toISOString(),
          ...(logoAssetId
            ? {
                logo: {
                  _type: 'image',
                  asset: { _type: 'reference', _ref: logoAssetId },
                },
              }
            : {}),
        },
      },
    ];

    const mutateResponse = await fetch(
      `https://${projectId}.api.sanity.io/v2024-01-01/data/mutate/${dataset}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sanityToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mutations }),
      }
    );

    if (!mutateResponse.ok) {
      console.error('Sanity mutation failed:', await mutateResponse.text());
      return NextResponse.json({ error: 'Failed to save sponsor data' }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    tier,
    logoUploaded: !!logoAssetId,
    message: 'Sponsorship details saved successfully.',
  });
}
