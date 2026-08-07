import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'uk', 'ru', 'es', 'ro'],
  defaultLocale: 'en',
  // English (the default) keeps today's URLs with no prefix -- /inventory,
  // /sell, etc -- so every existing link, bookmark, and the sitemap keep
  // working unchanged. The other locales get an explicit /uk, /ru, /es, /ro
  // prefix. 'ro' is also what Moldovan uses -- there's no distinct ISO 639-1
  // code for it (the old 'mo' was deprecated in favor of 'ro' for both).
  localePrefix: 'as-needed',
});

export const localeNames: Record<string, string> = {
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  es: 'Español',
  ro: 'Română (Moldova)',
};

export type Locale = (typeof routing.locales)[number];
