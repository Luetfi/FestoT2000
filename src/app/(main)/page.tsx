import { Suspense } from 'react';
import { HomeContent } from '@/components/home/home-content';

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
