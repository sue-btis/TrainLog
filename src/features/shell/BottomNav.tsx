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
 *
 * The bar's face is unchanged — the taken tab is the same solid `planned-ink`
 * pill it has always been. What changed is that the pill is now drawn by the
 * liquid layer rather than by a background colour, so it can arrive as liquid:
 * it spreads from a flat seed, throws three satellites out and swallows them
 * again. The motion is `src/styles/theme.css` (§ the liquid tab); this file
 * only says where the blobs are.
 *
 * Nothing here is driven by JavaScript: `aria-current` is already on the active
 * link, so the router's own state is what triggers the animation.
 */

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
                  // `min-w-0` is what lets a tab shrink below its label's
                  // intrinsic width. Without it the four labels forced the row
                  // to 436px inside a 375px container at 200% text zoom, and
                  // the primary navigation clipped its own words. Wrapping
                  // costs height; clipping costs the label.
                  'nav-tab relative isolate flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center rounded-control py-1 px-0.5',
                  'transition-colors duration-[110ms] ease-snap',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-planned',
                  'focus-visible:shadow-[0_0_0_3px_var(--color-planned-wash)]',
                  // The taken tab's fill is the liquid layer's job now; the same
                  // `planned-ink`, arriving as a body rather than as a colour.
                  // What stays here is the text colour it has to clear, and the
                  // wash an untaken tab shows a pointer.
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

/**
 * The gooey filter, declared once for the whole bar. It is what makes separate
 * shapes read as one body of liquid when they touch: blur them together, then
 * ramp the alpha back to a hard edge so the overlap fuses instead of fading.
 *
 * The region is stated explicitly. A filter's default box is only 10% larger
 * than the element, and the satellites travel further than that — left at the
 * default they would be cut off in mid-air, which is the one visible flaw in
 * the reference. `stdDeviation` is 3.5 rather than the reference's 4 because
 * our pill's corner is 14px, not 22px: blur it harder and the goo rounds the
 * corner past the radius the design system gave it.
 */
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
