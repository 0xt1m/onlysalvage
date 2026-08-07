import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Inter, Playfair_Display } from 'next/font/google'
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import "../globals.css";

import { Toaster } from "sonner"
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { BackToTopButton } from '@/components/layout/BackToTopButton'
import { ScrollToTop } from '@/components/layout/ScrollToTop'
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { routing } from '@/i18n/routing';

import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
})

const DEFAULT_DESCRIPTION =
  "Browse thousands of verified salvage, rebuilt, and clean-title car listings from private sellers and dealers, or list your own vehicle in minutes. Rated sellers, transparent pricing, no hassle.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OnlySalvage | Buy and Sell Salvage Cars",
    template: "%s | OnlySalvage",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ["salvage cars", "rebuilt title cars", "buy a salvage car", "sell a salvage car", "salvage car marketplace", "salvage vehicles for sale"],
  openGraph: {
    type: "website",
    siteName: "OnlySalvage",
    title: "OnlySalvage | Buy and Sell Salvage Cars",
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/share-logo.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "OnlySalvage | Buy and Sell Salvage Cars",
    description: DEFAULT_DESCRIPTION,
    images: ["/share-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Lets every server component in this locale's tree call e.g. getTranslations()
  // without each one having to re-derive the locale from params itself.
  setRequestLocale(locale);

  // Read the theme straight from the request cookie so the very first byte
  // of HTML already has the right data-theme -- no flash, and no inline
  // script (which years of Next.js App Router quirks have shown React's
  // hydration warns about regardless of where in the tree it's placed).
  // A visitor with no cookie yet gets no attribute at all, and
  // globals.css's prefers-color-scheme media query takes it from there.
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const theme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;

  return (
    <html lang={locale} data-theme={theme} suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen flex flex-col",
          inter.variable,
          playfair.variable
        )}
      >
        <NextIntlClientProvider>
          <ThemeProvider initialTheme={theme}>
            <AuthProvider>
              <ScrollToTop />
              <Navbar />
                {children}
                <Toaster />
              <Footer />
              <BackToTopButton />
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
