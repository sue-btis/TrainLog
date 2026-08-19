/**
 * The frame the three daily screens sit in (§10).
 *
 * Navigation is last in the document and fixed to the bottom of the viewport:
 * the app is operated one-handed, standing, so the thumb reaches the tabs and
 * the eyes read from the top (DESIGN.md, "Thumb-zone ordering"). It carries
 * only the screens that exist — Progress and More arrive with theirs.
 *
 * This is the one place glass appears, over the colour bloom DESIGN.md puts at
 * the bottom edge of every screen. The wizard and the harness render their own
 * frames and are deliberately outside this shell.
 */

import { NavLink, Outlet } from 'react-router';
import { CalendarDays, Dumbbell, ScrollText } from 'lucide-react';
import { COLUMN, ICON_STROKE, SCREEN } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/today', label: 'Today', Icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/routines', label: 'Routines', Icon: ScrollText },
] as const;

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

function BottomNav() {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-10">
      <div aria-hidden="true" className="bloom pointer-events-none absolute inset-x-0 bottom-0 h-32" />

      <div className="glass relative border-t border-rule">
        <div className="mx-auto flex w-full max-w-lg gap-2 px-4 py-2">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-control py-1',
                  'transition-[box-shadow,transform,background-color] duration-[110ms] ease-snap',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-planned',
                  'focus-visible:shadow-[0_0_0_3px_var(--color-planned-wash)]',
                  isActive
                    ? 'bg-planned-ink text-on-fill inset-shadow-sunk'
                    : 'text-ink-2 hover:bg-planned-wash',
                )
              }
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
              <span className="type-micro">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
