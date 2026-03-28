import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * Admin layout — strips public Navigation and Footer.
 * Auth is handled at the page level (admin/page.tsx redirects to /admin/login).
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a1628]">
      {children}
    </div>
  );
}
