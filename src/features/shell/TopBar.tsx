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
import { Link } from 'react-router';
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

  // The band around the pill is board the content scrolls through, so it does
  // not take the taps that belong to what is passing under it.
  return (
    <header className="pointer-events-none sticky top-0 z-10 px-4 pt-3 pb-1">
      {/* A stadium, not a card: at this height `rounded-cell` is the same full
          round the controls inside it wear, so the bar reads as one object of
          the same family rather than a panel that happens to be curved. */}
      <div className="glass pointer-events-auto relative mx-auto flex w-full max-w-lg items-center gap-2 rounded-cell p-2">
        <div className="flex w-12 shrink-0 items-center">
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

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          {Icon !== undefined && (
            <Icon
              aria-hidden="true"
              className="shrink-0 text-planned-ink"
              size={20}
              strokeWidth={ICON_STROKE}
            />
          )}
          <h1 className="min-w-0 truncate type-title">{title}</h1>
        </div>

        <div className="flex w-12 shrink-0 items-center justify-end">{action}</div>
      </div>
    </header>
  );
}
