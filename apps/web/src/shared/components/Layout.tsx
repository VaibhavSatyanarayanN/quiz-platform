import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';

export function Layout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
