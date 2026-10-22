import { Suspense } from 'react';
import { FestoHeader } from '@/components/layout/festo-header';

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Suspense fallback={
        <header className="sticky top-0 z-10 bg-background border-b-2 border-[#0091DC]">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          </div>
        </header>
      }>
        <FestoHeader />
      </Suspense>
      {children}
    </>
  );
}
