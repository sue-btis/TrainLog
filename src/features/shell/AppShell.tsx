/**
 * The frame the three daily screens sit in (§10). The wizard and the harness
 * render their own frames and are deliberately outside it.
 */

import { Outlet } from 'react-router';
import { BottomNav } from '@/features/shell/BottomNav';
import { COLUMN, SCREEN } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function AppShell() {
  return (
    <main className={SCREEN}>
      <div className={cn(COLUMN, 'pb-32')}>
        <Outlet />
      </div>
      <BottomNav />
    </main>
  );
}
