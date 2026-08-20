/**
 * The bottom navigation (§10).
 *
 * Fixed in the thumb zone because the app is operated one-handed, standing. It
 * carries only the screens that exist — Progress and More arrive with theirs.
 *
 * It appears on the three daily screens, and on the wizard's steps that are not
 * inside the task: choosing a file, and the confirmation after accepting. While
 * a routine is being edited the action bar owns the bottom instead, so the two
 * never stack.
 */

import { NavLink } from 'react-router';
import { SECTIONS } from '@/features/shell/sections';
import { ICON_STROKE } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function BottomNav() {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-10">
      <div aria-hidden="true" className="bloom pointer-events-none absolute inset-x-0 bottom-0 h-32" />

      <div className="glass relative border-t border-rule">
        <div className="mx-auto flex w-full max-w-lg gap-2 px-4 py-2">
          {SECTIONS.map(({ to, label, Icon }) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-control py-1',
                  'transition-[box-shadow,transform,background-color] duration-[110ms] ease-snap',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-planned',
                  'focus-visible:shadow-[0_0_0_3px_var(--color-planned-wash)]',
                  isActive ? 'bg-planned-ink text-on-fill' : 'text-ink-2 hover:bg-planned-wash',
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
