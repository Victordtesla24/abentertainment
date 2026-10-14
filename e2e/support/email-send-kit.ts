/**
 * Shared pieces of the in-process sending specs: fake settings, and a fetch stub that records each request exactly as it
 * would go to Resend and answers from a script (the last answer repeats). Nothing here talks to a real service.
 */

export const API_KEY = 're_test_0123456789abcdef';
export const ENV: Record<string, string> = {
  RESEND_API_KEY: API_KEY,
  EMAIL_FROM: 'AB Entertainment <newsletter@abentertainment.com.au>',
  EMAIL_REPLY_TO: 'abhi@abentertainment.com.au',
  SESSION_SECRET: 'unit-test-session-secret-0123456789abcdef',
};
export const ADDRESS = 'jane.doe@example.com';

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  raw: string;
  body: { from: string; to: string[]; subject: string; html: string; text: string; reply_to?: string; headers: Record<string, string>; tags: Array<{ name: string; value: string }> };
}

export type Step = (() => Response) | Error;
export const json = (status: number, payload: unknown, headers: Record<string, string> = {}) => () => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json', ...headers } });
export const accepted = (id = 're_0001') => json(200, { id });
export const refused = (status: number, name: string, message: string, headers: Record<string, string> = {}) => json(status, { statusCode: status, name, message }, headers);

export function stubFetch(script: Step[] = [accepted()]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    const raw = String(init.body ?? '');
    calls.push({ url, method: String(init.method), headers: { ...(init.headers as Record<string, string>) }, raw, body: JSON.parse(raw) as Call['body'] });
    const step = script[Math.min(calls.length - 1, script.length - 1)];
    if (step instanceof Error) throw step;
    return step();
  }) as unknown as typeof fetch;
  return { impl, calls };
}
