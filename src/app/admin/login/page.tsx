'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

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
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
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
    <div className="min-h-screen flex items-center justify-center bg-[#062434] px-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-[#CC8A1C] mb-2">
            AB Entertainment
          </h1>
          <p className="text-[#7E7180] text-sm">Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#0a3a52]/50 border border-[#CC8A1C]/20 rounded-sm p-8">
          <h2 className="text-xl font-display font-semibold text-white mb-6">
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-[#7E7180] mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full px-4 py-3 bg-[#062434] border border-[#CC8A1C]/30 rounded-sm text-white placeholder-[#7E7180] focus:outline-none focus:border-[#CC8A1C] transition-colors"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#7E7180] mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-[#062434] border border-[#CC8A1C]/30 rounded-sm text-white placeholder-[#7E7180] focus:outline-none focus:border-[#CC8A1C] transition-colors"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-sm border border-red-400/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#CC8A1C] text-white font-semibold rounded-sm hover:bg-[#e0a83a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#7E7180] text-xs mt-6">
          &copy; {new Date().getFullYear()} AB Entertainment. Admin access only.
        </p>
      </div>
    </div>
  );
}
