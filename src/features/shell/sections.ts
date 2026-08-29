import { CalendarDays, Dumbbell, Ellipsis, TrendingUp } from 'lucide-react';

export const SECTIONS = [
  { to: '/today', label: 'Today', Icon: Dumbbell },
  { to: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { to: '/progress', label: 'Progress', Icon: TrendingUp },
  { to: '/more', label: 'More', Icon: Ellipsis },
] as const;
