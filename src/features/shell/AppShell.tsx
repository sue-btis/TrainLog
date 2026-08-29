import { Dumbbell, ScrollText, Settings } from 'lucide-react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/features/shell/BottomNav';
import { SECTIONS } from '@/features/shell/sections';
import { TopBar } from '@/features/shell/TopBar';
import { COLUMN, ICON_STROKE, SCREEN } from '@/features/ui/styles';
import { cn } from '@/lib/utils';

const ROUTINES = '/routines';
const MORE = '/more';
const SETTINGS = '/settings';

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = SECTIONS.find((entry) => entry.to === pathname);

  const routines = section === undefined && pathname === ROUTINES;
  const detail = section === undefined && pathname.startsWith(`${ROUTINES}/`);
  const exercise = section === undefined && pathname.startsWith('/exercises/');
  const catalog = section === undefined && pathname === '/exercises';
  const sessionDetail = section === undefined && pathname.startsWith('/sessions/');
  const settings = section === undefined && pathname === SETTINGS;

  const back =
    exercise || sessionDetail || settings
      ? { onBack: () => void navigate(-1) }
      : routines || catalog
        ? { to: MORE }
        : detail
          ? { to: ROUTINES }
          : undefined;

  return (
    <main className={SCREEN}>
      <TopBar
        // The gear is the way in, so the screen it opens does not offer it
        // again: a control that reloads the screen you are already on is a
        // control that has stopped meaning anything.
        action={settings ? undefined : <GearLink />}
        back={back}
        backLabel={backLabel(exercise || sessionDetail || settings, routines || catalog)}
        icon={
          settings
            ? Settings
            : exercise || catalog
              ? Dumbbell
              : (section?.Icon ?? ScrollText)
        }
        title={
          settings
            ? 'Settings'
            : catalog
              ? 'Exercises'
              : sessionDetail
                ? 'Session'
                : exercise
                  ? 'Exercise'
                  : routines
                    ? 'Routines'
                    : (section?.label ?? 'Routine')
        }
      />

      <div className={cn(COLUMN, 'pb-32')}>
        <Outlet />
      </div>

      <BottomNav />
    </main>
  );
}

function GearLink() {
  return (
    <Button aria-label="Settings and backup" asChild size="icon" variant="ghost">
      <Link to={SETTINGS}>
        <Settings aria-hidden="true" size={20} strokeWidth={ICON_STROKE} />
      </Link>
    </Button>
  );
}

function backLabel(retraces: boolean, toMore: boolean): string {
  if (retraces) return 'Back';
  return toMore ? 'Back to More' : 'Back to Routines';
}
