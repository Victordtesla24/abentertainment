import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Provide a static locale since we are not changing routing structures 
  // without touching existing logic.
  const locale = 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
