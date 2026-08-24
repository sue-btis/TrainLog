/**
 * A read still in flight, said once.
 *
 * `useLiveQuery` answers `undefined` while it is running, and the screens that
 * handle that had six byte-identical copies of this block between them — one
 * per screen that had remembered to. The ones that had not are why this exists
 * as a component rather than as a convention: Today rendered "No active routine
 * — import a routine file" over a read that was simply not back yet, the
 * calendar said "Nothing planned this month", and Routines rendered nothing at
 * all. A screen must never answer a question the database has not answered.
 *
 * Flat, because there is nothing here to press — `WELL` is the inert surface
 * DESIGN.md gives a readout, and this is the most temporary readout in the app.
 * That surface is also why this never goes inside a `Card`: board → card → well
 * is the nested surface DESIGN.md forbids, so a card waiting on its own read
 * writes the bare sentence instead.
 *
 * The sentence is the component's, the subject is the caller's:
 * `<Reading>this month</Reading>` reads "Reading this month…". One voice for
 * every wait, with no screen free to invent a second spelling of it.
 */

import type { ReactNode } from 'react';
import { WELL } from '@/features/ui/styles';

export function Reading({ children }: { readonly children: ReactNode }) {
  return (
    <section className={WELL}>
      <p className="type-body-sm text-ink-2">Reading {children}…</p>
    </section>
  );
}
