/**
 * Routes.
 *
 * The three daily screens sit inside the shell, which owns the frame and the
 * bottom navigation (§10). The import wizard and gym mode render their own
 * frames and stay outside it: the wizard is a task you finish and leave, and
 * gym mode carries no navigation at all, because §21 says nothing may compete
 * with the set in front of you.
 *
 * Progress and Exercises arrive with the screens behind them; the navigation
 * shows only what exists.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { ExerciseHistoryScreen } from '@/features/history/ExerciseHistoryScreen';
import { ImportWizard } from '@/features/import/ImportWizard';
import { MoreScreen } from '@/features/more/MoreScreen';
import { RoutineDetailScreen } from '@/features/routines/RoutineDetailScreen';
import { RoutinesScreen } from '@/features/routines/RoutinesScreen';
import { SessionScreen } from '@/features/session/SessionScreen';
import { AppShell } from '@/features/shell/AppShell';
import { TodayScreen } from '@/features/today/TodayScreen';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route element={<TodayScreen />} path="/today" />
          <Route element={<CalendarScreen />} path="/calendar" />
          <Route element={<RoutinesScreen />} path="/routines" />
          <Route element={<MoreScreen />} path="/more" />
          <Route element={<RoutineDetailScreen />} path="/routines/:routineId" />
          <Route element={<ExerciseHistoryScreen />} path="/exercises/:exerciseId" />
        </Route>
        <Route element={<ImportWizard />} path="/import" />
        <Route element={<SessionScreen />} path="/session" />
        <Route element={<Navigate replace to="/today" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
