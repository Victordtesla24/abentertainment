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
    <div data-admin-layout="true" className="min-h-screen bg-[#0A0A0A] admin-layout">
      {children}
    </div>
  );
}
