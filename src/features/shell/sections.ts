/**
 * The screens the product has, in the order the navigation shows them.
 *
 * One table, read twice: the bottom navigation builds its tabs from it and the
 * top bar takes its name and icon from it. The tab you pressed and the bar you
 * land under then say the same word with the same drawing, because they are
 * the same entry — not two lists that have to be kept in step by hand.
 *
 * Progress and Exercises arrive with the screens behind them.
 *
 * More is appended, never prepended: `AppShell` reads `SECTIONS[2]` as the
 * Routines entry to resolve the routes that sit under it.
 */

import { CalendarDays, Dumbbell, Ellipsis, ScrollText } from 'lucide-react';

export const SECTIONS = [
  { to: '/today', label: 'Today', Icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/routines', label: 'Routines', Icon: ScrollText },
  { to: '/more', label: 'More', Icon: Ellipsis },
] as const;
