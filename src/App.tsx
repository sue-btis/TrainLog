/**
 * Routes.
 *
 * The three daily screens sit inside the shell, which owns the frame and the
 * bottom navigation (§10). The import wizard and the harness render their own
 * frames and stay outside it: the wizard is a task you finish and leave, and
 * the harness is not a screen of the product at all — it is the driver for the
 * execution flow until §11.5 has its own screen.
 *
 * Progress, Exercises and More arrive with the screens behind them; the
 * navigation shows only what exists.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { Harness } from '@/features/harness/Harness';
import { ImportWizard } from '@/features/import/ImportWizard';
import { RoutineDetailScreen } from '@/features/routines/RoutineDetailScreen';
import { RoutinesScreen } from '@/features/routines/RoutinesScreen';
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
          <Route element={<RoutineDetailScreen />} path="/routines/:routineId" />
        </Route>
        <Route element={<ImportWizard />} path="/import" />
        <Route element={<Harness />} path="/harness" />
        <Route element={<Navigate replace to="/today" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
