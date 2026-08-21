/**
 * The screens the product has, in the order the navigation shows them.
 *
 * One table, read twice: the bottom navigation builds its tabs from it and the
 * top bar takes its name and icon from it. The tab you pressed and the bar you
 * land under then say the same word with the same drawing, because they are
 * the same entry — not two lists that have to be kept in step by hand.
 *
 * **Four, and only four** (DESIGN.md §Navigation). A fifth tab is not a design
 * question with a right answer; it is refused. Everything else the app can show
 * is reached from one of these — Routines and History from More, an exercise's
 * history from a routine or from gym mode.
 *
 * Membership is read by value, never by position. `AppShell` used to take the
 * third and fourth entries by index, which meant this array could not be
 * reordered without silently repointing a back button; it names the paths it
 * needs instead.
 */

import { CalendarDays, Dumbbell, Ellipsis, TrendingUp } from 'lucide-react';

export const SECTIONS = [
  { to: '/today', label: 'Today', Icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
  { to: '/more', label: 'More', Icon: Ellipsis },
] as const;
