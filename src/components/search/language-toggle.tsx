'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LanguageIcon } from '@/components/icons/festo-icons';

interface LanguageToggleProps {
  currentLang: 'de' | 'en';
  label: string;
}

export function LanguageToggle({ currentLang, label }: LanguageToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggleLanguage = () => {
    const newLang = currentLang === 'de' ? 'en' : 'de';
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', newLang);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-2"
    >
      <LanguageIcon size={16} />
      {label}
    </Button>
  );
}
