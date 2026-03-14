import { defineType, defineField, defineArrayMember } from 'sanity';
import { CalendarIcon } from '@sanity/icons';

export default defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      initialValue: 'draft',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Upcoming', value: 'upcoming' },
          { title: 'Live', value: 'live' },
          { title: 'Past', value: 'past' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'endDate',
      title: 'End Date',
      type: 'datetime',
    }),
    defineField({
      name: 'venue',
      title: 'Venue',
      type: 'object',
      fields: [
        defineField({
          name: 'name',
          title: 'Venue Name',
          type: 'string',
        }),
        defineField({
          name: 'address',
          title: 'Address',
          type: 'string',
        }),
        defineField({
          name: 'city',
          title: 'City',
          type: 'string',
        }),
        defineField({
          name: 'capacity',
          title: 'Capacity',
          type: 'number',
        }),
        defineField({
          name: 'mapUrl',
          title: 'Map URL',
          type: 'url',
        }),
      ],
    }),
    defineField({
      name: 'artists',
      title: 'Artists',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Name',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'role',
              title: 'Role',
              type: 'string',
            }),
            defineField({
              name: 'bio',
              title: 'Bio',
              type: 'text',
            }),
            defineField({
              name: 'photo',
              title: 'Photo',
              type: 'image',
              options: { hotspot: true },
            }),
          ],
          preview: {
            select: {
              title: 'name',
              subtitle: 'role',
              media: 'photo',
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt Text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'aiAlt',
          title: 'AI-Generated Alt Text',
          type: 'string',
          readOnly: true,
        }),
      ],
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'blockContent',
    }),
    defineField({
      name: 'aiDescription',
      title: 'AI-Generated Description',
      type: 'text',
      readOnly: true,
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      type: 'string',
    }),
    defineField({
      name: 'ticketUrl',
      title: 'Ticket URL',
      type: 'url',
    }),
    defineField({
      name: 'ticketPrice',
      title: 'Ticket Price',
      type: 'object',
      fields: [
        defineField({
          name: 'from',
          title: 'From',
          type: 'number',
        }),
        defineField({
          name: 'to',
          title: 'To',
          type: 'number',
        }),
        defineField({
          name: 'currency',
          title: 'Currency',
          type: 'string',
          initialValue: 'AUD',
        }),
      ],
    }),
    defineField({
      name: 'gallery',
      title: 'Gallery',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({
              name: 'alt',
              title: 'Alt Text',
              type: 'string',
            }),
            defineField({
              name: 'aiTags',
              title: 'AI Tags',
              type: 'array',
              of: [{ type: 'string' }],
              readOnly: true,
            }),
            defineField({
              name: 'aiCategory',
              title: 'AI Category',
              type: 'string',
              readOnly: true,
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'sponsors',
      title: 'Sponsors',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'sponsor' }],
        }),
      ],
    }),
    defineField({
      name: 'seo',
      title: 'SEO',
      type: 'object',
      fields: [
        defineField({
          name: 'metaTitle',
          title: 'Meta Title',
          type: 'string',
        }),
        defineField({
          name: 'metaDescription',
          title: 'Meta Description',
          type: 'text',
          rows: 3,
        }),
        defineField({
          name: 'ogImage',
          title: 'Open Graph Image',
          type: 'image',
        }),
        defineField({
          name: 'aiMetaDescription',
          title: 'AI-Generated Meta Description',
          type: 'text',
          readOnly: true,
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      status: 'status',
      date: 'date',
      media: 'heroImage',
    },
    prepare({ title, status, date, media }) {
      const formattedDate = date
        ? new Date(date).toLocaleDateString('en-AU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'No date';
      return {
        title,
        subtitle: `${status?.toUpperCase() || 'DRAFT'} — ${formattedDate}`,
        media,
      };
    },
  },
});
