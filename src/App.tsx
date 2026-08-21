/**
 * Routes.
 *
 * The three daily screens sit inside the shell, which owns the frame and the
 * bottom navigation (§10). The import wizard and gym mode render their own
 * frames and stay outside it: the wizard is a task you finish and leave, and
 * gym mode carries no navigation at all, because §21 says nothing may compete
 * with the set in front of you.
 *
 * Session history sits inside the shell too, under `/sessions` — plural, and a
 * different thing from `/session`, which is the one being trained right now.
 *
 * Routines sits inside the shell as well, but below a section rather than
 * beside one: the navigation caps at four tabs (DESIGN.md §Navigation) and
 * Progress took the third, so Routines is reached from More.
 *
 * Exercises (§11.12) sits below More for the same reason, at `/exercises` —
 * plural, and a different thing from `/exercises/:exerciseId`, which is one
 * exercise's history rather than the list of them all.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { CalendarScreen } from '@/features/calendar/CalendarScreen';
import { ExerciseCatalogScreen } from '@/features/exercises/ExerciseCatalogScreen';
import { ExerciseHistoryScreen } from '@/features/history/ExerciseHistoryScreen';
import { SessionDetailScreen } from '@/features/history/SessionDetailScreen';
import { SessionHistoryScreen } from '@/features/history/SessionHistoryScreen';
import { ImportWizard } from '@/features/import/ImportWizard';
import { MoreScreen } from '@/features/more/MoreScreen';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
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
          <Route element={<ProgressScreen />} path="/progress" />
          <Route element={<MoreScreen />} path="/more" />
          <Route element={<RoutinesScreen />} path="/routines" />
          <Route element={<RoutineDetailScreen />} path="/routines/:routineId" />
          <Route element={<ExerciseCatalogScreen />} path="/exercises" />
          <Route element={<ExerciseHistoryScreen />} path="/exercises/:exerciseId" />
          <Route element={<SessionHistoryScreen />} path="/sessions" />
          <Route element={<SessionDetailScreen />} path="/sessions/:sessionId" />
        </Route>
        <Route element={<ImportWizard />} path="/import" />
        <Route element={<SessionScreen />} path="/session" />
        <Route element={<Navigate replace to="/today" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
