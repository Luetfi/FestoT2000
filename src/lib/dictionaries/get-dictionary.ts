import 'server-only';

const dictionaries = {
  de: () => import('./de.json').then((module) => module.default),
  en: () => import('./en.json').then((module) => module.default),
} as const;

export type Locale = keyof typeof dictionaries;
export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

export const defaultLocale: Locale = 'de';

export function isValidLocale(locale: string | undefined): locale is Locale {
  return locale === 'de' || locale === 'en';
}
