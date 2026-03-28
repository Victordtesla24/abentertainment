export function readOptionalEnv(key: string): string | undefined {
  if (typeof process === 'undefined') {
    throw new Error(
      'readOptionalEnv should only be called in server-side code or build time'
    );
  }

  const value = process.env[key];
  return value === undefined || value === '' ? undefined : value;
}

export function readRequiredEnv(key: string): string {
  const value = readOptionalEnv(key);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const isOpenAIConfigured = Boolean(readOptionalEnv('OPENAI_API_KEY'));
export const isDatabaseConfigured = Boolean(readOptionalEnv('DATABASE_URL'));
