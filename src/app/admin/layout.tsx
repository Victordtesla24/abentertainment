import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin layout — hides public Navigation and Footer.
 * Uses data attribute to signal the root layout's client components.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div data-admin-layout="true" className="min-h-screen bg-[#0a1628] admin-layout">
      {children}
    </div>
  );
}
