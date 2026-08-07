import { Suspense } from 'react';
import type { Metadata } from 'next';
import { InventoryBrowser } from '@/components/inventory/InventoryBrowser';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse Used Cars for Sale',
  description: 'Search thousands of used car listings by make, model, price, mileage, and location. Filter by private sellers or dealers on OnlySalvage.',
};

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryBrowser />
    </Suspense>
  );
}
