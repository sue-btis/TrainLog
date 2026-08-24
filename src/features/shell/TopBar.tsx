/**
 * The bar every screen opens with: where you are, drawn and named, with one way
 * back where there is somewhere to go back to.
 *
 * It carries the heading itself — the `<h1>` lives here, not in a card below
 * it. A screen that titled itself twice, once in a bar and once on a white slab
 * under it, was two objects doing one job.
 *
 * The name sits in the middle and takes the icon its navigation tab uses, so
 * the tab you pressed and the screen you land on say the same word twice. The
 * two ends hold their 48px whether or not anything is in them: a title that
 * recentres when a back arrow appears is a title that moves between screens.
 *
 * **It floats.** It does not reach any edge: a gap of board runs above and
 * beside it, so the column slides *under* a pill rather than up to a lid.
 *
 * What the blur works on is the content itself, sliding past underneath. The
 * nav's bloom was tried up here and does not survive the trip: mirrored to the
 * top edge it lands at a different density behind a bar half the nav's height,
 * so instead of matching the nav it read as a third colour. One film, two
 * backdrops, and the honest one up here is the page.
 */

import type { ComponentType, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { ICON_STROKE } from '@/features/ui/styles';

interface TopBarProps {
  readonly title: string;
  /** The screen's own icon — the one its navigation tab uses. */
  readonly icon?: ComponentType<IconProps>;
  /** What the back control does: leave for a route, or ask first. A root
      section has nowhere to go back to and passes nothing. */
  readonly back?: { readonly to: string } | { readonly onBack: () => void };
  readonly backLabel?: string;
  /** The accessory action, if this screen has one. */
  readonly action?: ReactNode;
}

interface IconProps {
  readonly 'aria-hidden'?: boolean | 'true';
  readonly className?: string;
  readonly size?: number;
  readonly strokeWidth?: number;
}

export function TopBar({ title, icon: Icon, back, backLabel = 'Back', action }: TopBarProps) {
  const icon = <ArrowLeft aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />;

  // The bar opens once per screen, so the animated subtree is keyed by the
  // route. React would otherwise keep these nodes across a navigation and only
  // swap the words in them, and a CSS animation does not replay for an element
  // that never left the document.
  const { pathname } = useLocation();

  // The band around the pill is board the content scrolls through, so it does
  // not take the taps that belong to what is passing under it.
  return (
    <header className="pointer-events-none sticky top-0 z-10 px-4 pt-3 pb-1">
      {/* A stadium, not a card: at this height `rounded-cell` is the same full
          round the controls inside it wear, so the bar reads as one object of
          the same family rather than a panel that happens to be curved. */}
      {/* `flex-wrap`, and a title that claims a minimum width rather than
          absorbing whatever is left.
          The two gutters are rem-sized, so at 200% text zoom they double to
          96px each while the viewport does not — which used to squeeze the
          title row to 55px and let `truncate` eat the heading down to a
          sliver, leaving a lifter unable to tell which screen they were on
          (WCAG 1.4.4). With a floor of its own, the title drops to a full-width
          second row instead of vanishing. */}
      <div className="bar-open mx-auto w-full max-w-lg" key={pathname}>
        <BarGoo />

        {/* The liquid the bar arrives as: a body that squashes as it stretches,
            and two satellites the widening edge overtakes. It wears the same
            translucent white the glass resolves to, so the material does not
            change under it while it runs, and it is gone once the bar is open. */}
        <span aria-hidden="true" className="bar-liquid">
          <span className="bar-body bg-glass-fill" />
          <span className="bar-sat bar-sat-a bg-glass-fill" />
          <span className="bar-sat bar-sat-b bg-glass-fill" />
        </span>

        <div className="glass bar-face pointer-events-auto relative flex w-full flex-wrap items-center gap-2 rounded-cell p-2">
          <div className="bar-end flex w-12 shrink-0 items-center">
            {back === undefined ? null : 'to' in back ? (
              <Button aria-label={backLabel} asChild size="icon" variant="ghost">
                <Link to={back.to}>{icon}</Link>
              </Button>
            ) : (
              <Button
                aria-label={backLabel}
                onClick={back.onBack}
                size="icon"
                type="button"
                variant="ghost"
              >
                {icon}
              </Button>
            )}
          </div>

          <div className="flex min-w-32 flex-1 items-center justify-center gap-2">
            {Icon !== undefined && (
              <Icon
                aria-hidden="true"
                className="bar-icon shrink-0 text-planned-ink"
                size={20}
                strokeWidth={ICON_STROKE}
              />
            )}
            <h1 className="bar-title min-w-0 text-center type-title">{title}</h1>
          </div>

          <div className="bar-end flex w-12 shrink-0 items-center justify-end">{action}</div>
        </div>
      </div>
    </header>
  );
}

/**
 * The gooey filter for the bar, declared inside the keyed subtree so it lives
 * exactly as long as the thing that uses it. Same recipe as the navigation's:
 * blur the shapes together, then ramp the alpha back to a hard edge so the
 * overlap fuses instead of fading. The region only has to cover the blur — the
 * satellites are overtaken well inside the bar's own footprint, so nothing
 * travels past its ends.
 */
function BarGoo() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0" focusable="false">
      <defs>
        <filter height="200%" id="bar-goo" width="110%" x="-5%" y="-50%">
          <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="4" />
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
