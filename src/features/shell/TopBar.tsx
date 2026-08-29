import type { ComponentType, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { ICON_STROKE } from '@/features/ui/styles';

interface TopBarProps {
  readonly title: string;
  /** The screen's own icon — the one its navigation tab uses. */
  readonly icon?: ComponentType<IconProps>;
  readonly back?: { readonly to: string } | { readonly onBack: () => void };
  readonly backLabel?: string;
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

  const { pathname } = useLocation();

  return (
    <header className="pointer-events-none sticky top-0 z-10 px-4 pt-3 pb-1">
      {/* A stadium, not a card: at this height `rounded-cell` is the same full
          round the controls inside it wear, so the bar reads as one object of
          the same family rather than a panel that happens to be curved. */}
      <div className="bar-open mx-auto w-full max-w-lg" key={pathname}>
        <BarGoo />

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
