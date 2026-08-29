import type { ReactNode } from 'react';
import { WELL } from '@/features/ui/styles';

export function Reading({ children }: { readonly children: ReactNode }) {
  return (
    <section className={WELL}>
      <p className="type-body-sm text-ink-2">Reading {children}…</p>
    </section>
  );
}
