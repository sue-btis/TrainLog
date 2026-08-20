/**
 * The wizard's action bar: where the user is, what is in the way, and the one
 * thing to do next.
 *
 * It is fixed in the thumb zone because the app is operated one-handed, and it
 * carries the outstanding semantic issues because a long Step 1 otherwise
 * leaves the user hunting for the field that is blocking `Accept`. Each issue
 * is a jump: it switches to the right step and focuses the offending control.
 *
 * This is the one place glass appears, over the colour bloom DESIGN.md puts at
 * the bottom edge of every screen — the only place a blur has anything to do.
 */

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { SemanticIssue } from '@/domain/routine-file';
import { stepOfIssue } from '@/features/import/issues';
import type { WizardStep } from '@/features/import/state';
import { FOCUS_RING, ICON_STROKE, alert, button } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

interface ActionBarProps {
  readonly step: WizardStep;
  readonly onCancel: () => void;
  readonly issues: readonly SemanticIssue[];
  readonly accepting: boolean;
  readonly failure: string | null;
  readonly onStep: (step: WizardStep) => void;
  readonly onAccept: () => void;
  readonly onJump: (issue: SemanticIssue) => void;
}

export function ActionBar({
  step,
  issues,
  accepting,
  failure,
  onCancel,
  onStep,
  onAccept,
  onJump,
}: ActionBarProps) {
  const [listOpen, setListOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const blocked = issues.length > 0;

  // Leaving mid-import throws away every edit and nothing is stored yet, so the
  // question is asked before it happens — and it takes over the bar rather than
  // hiding in a corner of it.
  if (cancelling) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-10">
        <div aria-hidden="true" className="bloom pointer-events-none absolute inset-x-0 bottom-0 h-40" />
        <div className="glass relative border-t border-rule">
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-3">
            <div className="flex flex-col gap-1">
              <p className="type-title">Discard this import?</p>
              <p className="type-body-sm text-ink-2">
                Nothing has been stored yet, so every correction you made here goes with it.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={button('quiet', 'compact')}
                onClick={() => setCancelling(false)}
                type="button"
              >
                Keep editing
              </button>
              <button
                className={button('danger', 'compact', 'ml-auto')}
                onClick={() => {
                  setCancelling(false);
                  onCancel();
                }}
                type="button"
              >
                <X aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
                Discard it
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-10">
      <div aria-hidden="true" className="bloom pointer-events-none absolute inset-x-0 bottom-0 h-40" />

      <div className="glass relative border-t border-rule">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2 px-4 py-3">
          {failure !== null && (
            <div className={alert('missed')}>
              <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={18} strokeWidth={ICON_STROKE} />
              <div className="flex flex-col gap-0.5">
                <p className="type-title">Nothing was stored</p>
                <p className="type-body-sm">{failure}. Your edits are still here — try again.</p>
              </div>
            </div>
          )}

          {blocked && (
            <>
              <p className="sr-only" role="status">
                {issues.length === 1
                  ? '1 problem still blocks this import.'
                  : `${issues.length} problems still block this import.`}
              </p>
              <button
                aria-controls="import-issues"
                aria-expanded={listOpen}
                className={alert('missed', 'w-full items-center text-left')}
                onClick={() => setListOpen(!listOpen)}
                type="button"
              >
                <TriangleAlert aria-hidden="true" className="shrink-0" size={18} strokeWidth={ICON_STROKE} />
                <span className="flex-1 type-title">
                  {issues.length} {issues.length === 1 ? 'problem' : 'problems'} to fix
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn('shrink-0 transition-transform duration-[110ms] ease-snap', listOpen && 'rotate-180')}
                  size={18}
                  strokeWidth={ICON_STROKE}
                />
              </button>

              {listOpen && (
                <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto" id="import-issues">
                  {issues.map((issue, index) => (
                    <li key={`${issue.code}-${index}`}>
                      <button
                        className={cn(
                          'flex min-h-12 w-full items-center gap-2 rounded-control bg-card px-3 py-2 text-left',
                          'shadow-dome hover:shadow-dome-lift',
                          FOCUS_RING,
                        )}
                        onClick={() => {
                          setListOpen(false);
                          onJump(issue);
                        }}
                        type="button"
                      >
                        <span className="flex-1 type-body-sm text-ink">{issue.message}</span>
                        <span className="type-label text-ink-3">step {stepOfIssue(issue)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="flex items-center gap-2">
            <button
              aria-label="Discard this import"
              className={button('quiet', 'icon')}
              onClick={() => setCancelling(true)}
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
            </button>

            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="flex gap-1">
                <span className="h-1.5 w-6 rounded-line bg-planned-ink" />
                <span className={cn('h-1.5 w-6 rounded-line', step === 2 ? 'bg-planned-ink' : 'bg-well')} />
              </span>
              <span className="type-label text-ink-3">{step} of 2</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {step === 2 && (
                <button
                  className={button('secondary', 'control')}
                  onClick={() => onStep(1)}
                  type="button"
                >
                  <ArrowLeft aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
                  Back
                </button>
              )}
              {step === 1 ? (
                <button
                  className={button('primary', 'control')}
                  onClick={() => onStep(2)}
                  type="button"
                >
                  Next
                  <ArrowRight aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
                </button>
              ) : (
                <button
                  className={button('primary', 'control')}
                  disabled={blocked || accepting}
                  onClick={onAccept}
                  type="button"
                >
                  {accepting ? (
                    <LoaderCircle aria-hidden="true" className="animate-spin" size={18} strokeWidth={ICON_STROKE} />
                  ) : (
                    <Check aria-hidden="true" size={18} strokeWidth={ICON_STROKE} />
                  )}
                  {accepting ? 'Importing' : 'Accept'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
