import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { ExerciseCatalogScreen } from '@/features/exercises/ExerciseCatalogScreen';
import { ExerciseHistoryScreen } from '@/features/history/ExerciseHistoryScreen';
import { SessionDetailScreen } from '@/features/history/SessionDetailScreen';
import { ImportWizard } from '@/features/import/ImportWizard';
import { MoreScreen } from '@/features/more/MoreScreen';
import { RoutineDetailScreen } from '@/features/routines/RoutineDetailScreen';
import { RoutinesScreen } from '@/features/routines/RoutinesScreen';
import { SessionScreen } from '@/features/session/SessionScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { AppShell } from '@/features/shell/AppShell';
import { TodayScreen } from '@/features/today/TodayScreen';
import { Reading } from '@/features/ui/Reading';
import { UpdatePrompt } from '@/pwa/UpdatePrompt';

// Keeps recharts out of the entry chunk; the service worker still precaches it.
const ProgressScreen = lazy(() =>
  import('@/features/progress/ProgressScreen').then((m) => ({ default: m.ProgressScreen })),
);

export function App() {
  return (
    <BrowserRouter>
      <UpdatePrompt />
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<TodayScreen />} path="/today" />
          <Route element={<CalendarScreen />} path="/calendar" />
          <Route
            element={
              <Suspense fallback={<Reading>progress</Reading>}>
                <ProgressScreen />
              </Suspense>
            }
            path="/progress"
          />
          <Route element={<MoreScreen />} path="/more" />
          <Route element={<RoutinesScreen />} path="/routines" />
          <Route element={<RoutineDetailScreen />} path="/routines/:routineId" />
          <Route element={<ExerciseCatalogScreen />} path="/exercises" />
          <Route element={<ExerciseHistoryScreen />} path="/exercises/:exerciseId" />
          <Route element={<SessionDetailScreen />} path="/sessions/:sessionId" />
          <Route element={<SettingsScreen />} path="/settings" />
        </Route>
        <Route element={<ImportWizard />} path="/import" />
        <Route element={<SessionScreen />} path="/session" />
        <Route element={<Navigate replace to="/today" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
