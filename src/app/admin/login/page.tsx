'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getApiUrl } from '@/lib/api-config';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/admin/auth'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        // Store token for session management
        if (data.token) {
          document.cookie = 'ab-admin-session-v3=' + data.token + '; path=/; max-age=86400; SameSite=None; Secure';
        }
        await new Promise((r) => setTimeout(r, 300));
        router.push('/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-xs font-body font-medium text-white/40 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-white/[0.03] border border-[#C9A84C]/12 text-white font-body text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/40 focus:bg-white/[0.05] transition-all duration-300"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 px-4 py-3 border border-red-400/20 font-body">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black font-body font-bold text-sm uppercase tracking-[0.12em] hover:shadow-[0_0_25px_rgba(201,168,76,0.35)] transition-all duration-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs font-body mt-8">
          &copy; {new Date().getFullYear()} AB Entertainment. Admin access only.
        </p>
      </div>
    </div>
  );
}
