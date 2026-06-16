import 'server-only';
import { getDictionary, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { AdminNav } from '@/components/admin/admin-nav';

// Wraps the authenticated admin pages (review, gaps) with a shared header + nav.
// The /admin/login page lives outside this route group, so it stays bare.
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dict = await getDictionary(defaultLocale);

  return (
    <div className="min-h-screen bg-background">
      <AdminNav
        title={dict.adminAreaTitle}
        labels={{
          review: dict.adminNavReview,
          gaps: dict.adminNavGaps,
          logout: dict.adminLogout,
        }}
      />
      {children}
    </div>
  );
}
