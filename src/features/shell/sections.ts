/**
 * The screens the product has, in the order the navigation shows them.
 *
 * One table, read twice: the bottom navigation builds its tabs from it and the
 * top bar takes its name and icon from it. The tab you pressed and the bar you
 * land under then say the same word with the same drawing, because they are
 * the same entry — not two lists that have to be kept in step by hand.
 *
 * Progress, Exercises and More arrive with the screens behind them.
 */

import { CalendarDays, Dumbbell, ScrollText } from 'lucide-react';

export const SECTIONS = [
  { to: '/today', label: 'Today', Icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/routines', label: 'Routines', Icon: ScrollText },
] as const;
