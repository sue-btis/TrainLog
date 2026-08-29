import { NavLink } from 'react-router';
import { SECTIONS } from '@/features/shell/sections';
import { ICON_STROKE } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

export function BottomNav() {
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-10">
      <GooFilter />

      <div aria-hidden="true" className="bloom pointer-events-none absolute inset-x-0 bottom-0 h-32" />

      <div className="glass relative border-t border-rule">
        <div className="mx-auto flex w-full max-w-lg gap-2 px-4 py-2">
          {SECTIONS.map(({ to, label, Icon }) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'nav-tab relative isolate flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-control py-1 px-0.5',
                  'transition-colors duration-[110ms] ease-snap',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-planned',
                  'focus-visible:shadow-[0_0_0_3px_var(--color-planned-wash)]',
                  isActive ? 'text-on-fill' : 'text-ink-2 hover:bg-planned-wash',
                )
              }
              key={to}
              to={to}
            >
              <span aria-hidden="true" className="nav-liquid">
                <span className="nav-body bg-planned-ink" />
                <span className="nav-sat nav-sat-a bg-planned-ink" />
                <span className="nav-sat nav-sat-b bg-planned-ink" />
                <span className="nav-sat nav-sat-c bg-planned-ink" />
              </span>

              <span className="nav-press flex flex-col items-center gap-1">
                <Icon aria-hidden="true" className="nav-icon" size={20} strokeWidth={ICON_STROKE} />
                <span className="type-micro text-center [overflow-wrap:anywhere]">{label}</span>
              </span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

function GooFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <filter height="250%" id="nav-goo" width="240%" x="-70%" y="-75%">
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3.5" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
  );
}
