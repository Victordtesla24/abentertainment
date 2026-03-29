import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Page Not Found',
  description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
  return (
    <main className="bg-[#0A0A0A] min-h-screen flex items-center justify-center">
      <div className="text-center px-6">
        <p className="text-[#C9A84C] text-sm uppercase tracking-[0.3em] font-body font-semibold mb-6">
          Page Not Found
        </p>
        <h1 className="text-8xl md:text-9xl font-display font-bold text-white mb-4">
          4<span className="text-[#C9A84C]">0</span>4
        </h1>
        <p className="text-white/40 font-body text-lg mb-10 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black text-sm uppercase tracking-wider font-body font-bold hover:shadow-[0_0_25px_rgba(201,168,76,0.35)] transition-all duration-400"
          >
            Back to Home
          </Link>
          <Link
            href="/contact"
            className="px-8 py-3 border border-white/15 text-white/60 text-sm uppercase tracking-wider font-body font-medium hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-all duration-400"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </main>
  );
}
