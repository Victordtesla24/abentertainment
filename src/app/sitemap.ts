import { MetadataRoute } from 'next'
import { getEvents } from '@/lib/data'
import { SITE_CONFIG } from '@/lib/constants'

const baseUrl = SITE_CONFIG.url

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/gallery`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sponsors`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  try {
    const events = await getEvents()
    const eventRoutes: MetadataRoute.Sitemap = events.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: new Date(event.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    return [...staticRoutes, ...eventRoutes]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticRoutes
  }
}
