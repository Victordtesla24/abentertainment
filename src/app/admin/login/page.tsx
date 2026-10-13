'use client';

import { useState, FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getApiUrl } from '@/lib/api-config';
import { setCsrfToken, setAuthToken } from '@/lib/admin-fetch';

const AUTH_PATH = '/api/admin/auth';

/**
 * Runs from the static HTML as soon as the form is parsed — before React has
 * hydrated the page. Until hydration the Sign In button is type="button" (the
 * form has two text fields, so Enter cannot trigger an implicit submission
 * either), which means nothing can submit the form natively. This script only
 * records that the visitor asked to sign in with both fields filled, so the
 * request can be sent the moment the real submit handler is attached.
 */
const EARLY_INTENT_SCRIPT = `(function(){var s=document.currentScript,f=s&&s.closest('form');if(!f)return;function filled(){return f.elements.username&&f.elements.password&&f.elements.username.value.trim()!==''&&f.elements.password.value!=='';}function mark(){if(filled())window.__abAdminLoginIntent=true;}f.addEventListener('click',function(e){var t=e.target;if(t&&t.closest&&t.closest('button'))mark();});f.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target&&e.target.tagName==='INPUT')mark();});})();`;

type IntentWindow = Window & { __abAdminLoginIntent?: boolean };

export default function AdminLoginPage() {
  const router = useRouter();
  // This page is a static export: its HTML (and therefore the form) is visible
  // before React has hydrated it. Until then the form has no submit handler, so
  // pressing Sign In or Enter would fall through to a native form submission,
  // which reloads the page with the fields cleared and never calls the API —
  // on slow phones the login "does nothing". `ready` keeps Sign In disabled
  // until the handler is attached; the inputs stay usable and are uncontrolled,
  // so anything typed before hydration is kept and read on submit. A Sign In
  // tap or Enter press made before hydration is remembered (EARLY_INTENT_SCRIPT)
  // and completed as soon as the page is ready.
  const formRef = useRef<HTMLFormElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const w = window as IntentWindow;
    if (w.__abAdminLoginIntent && formRef.current) {
      w.__abAdminLoginIntent = false;
      formRef.current.requestSubmit();
    }
  }, [ready]);

  useEffect(() => {
    if (!rateLimited) return;
    if (retryAfter <= 0) {
      setRateLimited(false);
      return;
    }
    const timer = setTimeout(() => {
      setRetryAfter((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [rateLimited, retryAfter]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || loading || rateLimited) return;
    const form = new FormData(e.currentTarget);
    // Usernames are matched case-insensitively and without surrounding spaces
    // (phone keyboards add both); the password is sent exactly as typed.
    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!username || !password) {
      setError('Enter your username and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl(AUTH_PATH), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          setAuthToken(data.token);
        }
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
          // The CSRF token doubles as the sessionStorage auth indicator read by
          // adminFetch; the session itself lives in the httpOnly cookie.
          if (!data.token) {
            setAuthToken(data.csrfToken);
          }
        }
        // Confirm the browser stored and sends the session cookie before
        // leaving this page, so a blocked cookie produces a clear message here
        // instead of a silent bounce back from the dashboard.
        const check = await fetch(getApiUrl(AUTH_PATH), {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        if (!check.ok) {
          setError('Signed in, but this browser did not keep the session cookie. Allow cookies for abentertainment.com.au and try again.');
          return;
        }
        router.push('/admin');
      } else if (res.status === 401) {
        setError('Incorrect username or password.');
      } else if (res.status === 429) {
        const retryAfterHeader = res.headers.get('Retry-After');
        const seconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30;
        setRetryAfter(seconds);
        setRateLimited(true);
        setError('');
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || `Sign-in failed (HTTP ${res.status}). Please try again.`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.06),transparent_60%)] pointer-events-none" />
      <div className="film-grain" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative w-20 h-20 mb-4">
            <div className="absolute inset-0 bg-[#C9A84C]/10 blur-2xl rounded-full" />
            <Image src="/images/AB_Logo_transparent.png" alt="AB Entertainment" fill className="object-contain" priority />
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-wide">
            AB Entertainment
          </h1>
          <p className="text-[#C9A84C]/50 text-xs uppercase tracking-[0.25em] font-body mt-1">Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]/40" />
            <h2 className="text-sm font-body font-semibold text-[#C9A84C] uppercase tracking-[0.2em]">
              Sign In
            </h2>
            <div className="w-10 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]/40" />
          </div>

          <form ref={formRef} onSubmit={handleSubmit} method="post" className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-xs font-body font-medium text-white/40 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full px-4 py-3 bg-white/[0.03] border border-[#C9A84C]/12 text-white font-body text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/40 focus:bg-white/[0.05] transition-all duration-300"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-body font-medium text-white/40 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white/[0.03] border border-[#C9A84C]/12 text-white font-body text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/40 focus:bg-white/[0.05] transition-all duration-300"
                placeholder="Enter password"
              />
            </div>

            {rateLimited && (
              <div className="text-yellow-400 text-sm bg-yellow-400/10 px-4 py-3 border border-yellow-400/20 font-body">
                Too Many Attempts &mdash; retry in {retryAfter} seconds
              </div>
            )}

            {!rateLimited && error && (
              <div className="text-red-400 text-sm bg-red-400/10 px-4 py-3 border border-red-400/20 font-body">
                {error}
              </div>
            )}

            <button
              type={ready ? 'submit' : 'button'}
              aria-busy={!ready || loading}
              disabled={loading || rateLimited}
              className="w-full py-3.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black font-body font-bold text-sm uppercase tracking-[0.12em] hover:shadow-[0_0_25px_rgba(201,168,76,0.35)] transition-all duration-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!ready ? 'Loading…' : loading ? 'Signing in...' : 'Sign In'}
            </button>
            <script dangerouslySetInnerHTML={{ __html: EARLY_INTENT_SCRIPT }} />
          </form>
        </div>

        <p className="text-center text-white/50 text-xs font-body mt-8">
          &copy; {new Date().getFullYear()} AB Entertainment. Admin access only.
        </p>
      </div>
    </div>
  );
}
