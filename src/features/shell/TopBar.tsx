/**
 * The top bar a task screen opens with: one way back, the name of the step you
 * are on, and room for an accessory action.
 *
 * It exists for the screens that take the bottom away. The three daily screens
 * keep the nav in the thumb zone and need no bar; the wizard replaces that nav
 * with its action bar, and a task you cannot leave from the top is a task with
 * no exit at all.
 *
 * It carries the heading itself — the `<h1>` lives here, not in a card below
 * it. A wizard that titled the step twice, once in a bar and once on a white
 * slab under it, was two objects doing one job.
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

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ICON_STROKE } from '@/features/ui/styles';

interface TopBarProps {
  readonly title: string;
  /** What the back control does: leave for a route, or ask first. */
  readonly back: { readonly to: string } | { readonly onBack: () => void };
  readonly backLabel?: string;
  /** The accessory action, if this screen has one. */
  readonly action?: ReactNode;
}

export function TopBar({ title, back, backLabel = 'Back', action }: TopBarProps) {
  const icon = <ArrowLeft aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />;

  // The band around the pill is board the content scrolls through, so it does
  // not take the taps that belong to what is passing under it.
  return (
    <header className="pointer-events-none sticky top-0 z-10 px-4 pt-3 pb-1">
      {/* A stadium, not a card: at this height `rounded-cell` is the same full
          round the controls inside it wear, so the bar reads as one object of
          the same family rather than a panel that happens to be curved. */}
      <div className="glass pointer-events-auto relative mx-auto flex w-full max-w-lg items-center gap-2 rounded-cell p-2">
        {'to' in back ? (
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

        <h1 className="min-w-0 flex-1 truncate type-title">{title}</h1>

        {/* Nothing sits flush against the curve: an accessory action keeps the
            same 8px the back control has on the other side. */}
        {action === undefined ? (
          <span aria-hidden="true" className="w-2 shrink-0" />
        ) : (
          <div className="flex shrink-0 items-center">{action}</div>
        )}
      </div>
    </header>
  );
}
