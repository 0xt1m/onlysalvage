import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Drop-in replacements for next/link and next/navigation's Link/router/usePathname
// that stay in the current locale automatically -- using the plain next/link
// versions anywhere would silently bounce a Ukrainian visitor back to English
// on their very next click.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
