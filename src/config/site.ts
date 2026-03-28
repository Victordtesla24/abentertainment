import { SITE_CONFIG as _SITE_CONFIG } from '@/lib/constants';

export const SITE_CONFIG = {
  ..._SITE_CONFIG,
  phone: _SITE_CONFIG.contact.phone,
  email: _SITE_CONFIG.contact.email,
};
