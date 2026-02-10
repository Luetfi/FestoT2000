import { getDictionary, isValidLocale, defaultLocale } from '@/lib/dictionaries/get-dictionary';
import { SearchInput } from '@/components/search/search-input';
import { QuickFilters } from '@/components/search/quick-filters';

interface HomePageProps {
  searchParams: Promise<{ lang?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const lang = isValidLocale(params.lang) ? params.lang : defaultLocale;
  const dict = await getDictionary(lang);

  const quickFilters = [
    { id: 'error-code', label: dict.filterErrorCode, query: 'Fehlercode' },
    { id: 'commissioning', label: dict.filterCommissioning, query: 'Inbetriebnahme' },
    { id: 'how-to', label: dict.filterHowTo, query: 'How-to' },
    { id: 'interfaces', label: dict.filterInterfaces, query: 'Schnittstellen' },
  ];

  return (
    <main
      className="bg-background px-8"
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        width: '100%',
      }}
    >
      <div className="w-full max-w-3xl space-y-8">
        {/* Search input */}
        <SearchInput
          placeholder={dict.searchPlaceholder}
          buttonText={dict.searchButton}
          lang={lang}
        />

        {/* Quick filter chips */}
        <QuickFilters filters={quickFilters} lang={lang} />

        {/* Subtle helper text */}
        <p className="text-center text-sm text-muted-foreground">
          {lang === 'de'
            ? 'Geben Sie ein Problem, einen Fehlercode oder eine Produktbezeichnung ein'
            : 'Enter a problem, error code, or product name'}
        </p>
      </div>
    </main>
  );
}
