'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminNavProps {
  title: string;
  labels: { review: string; gaps: string; logout: string };
}

const LINKS = [
  { href: '/admin/review', key: 'review' as const },
  { href: '/admin/gaps', key: 'gaps' as const },
];

export function AdminNav({ title, labels }: AdminNavProps) {
  const pathname = usePathname();

  async function logout() {
    try {
      await fetch('/api/auth/admin/logout', { method: 'POST' });
    } catch {
      // ignore — redirect anyway
    }
    window.location.href = '/admin/login';
  }

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <span className="font-[family-name:var(--font-title)] text-lg">{title}</span>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {labels[l.key]}
              </Link>
            );
          })}
        </nav>
        <Button variant="outline" size="sm" onClick={logout} className="ml-auto">
          {labels.logout}
        </Button>
      </div>
    </header>
  );
}
