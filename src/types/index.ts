export type {
  Event,
  Sponsor,
  GalleryImage,
  Testimonial,
  SiteSettings,
} from '@/lib/data';

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  message: string;
  eventInterest?: string;
}

export interface AdminSession {
  user: string;
  iat: number;
  exp: number;
}
