/**
 * Routes.
 *
 * The three daily screens sit inside the shell, which owns the frame and the
 * bottom navigation (§10). The import wizard and gym mode render their own
 * frames and stay outside it: the wizard is a task you finish and leave, and
 * gym mode carries no navigation at all, because §21 says nothing may compete
 * with the set in front of you.
 *
 * One Session sits inside the shell too, under `/sessions/:sessionId` — plural,
 * and a different thing from `/session`, which is the one being trained right
 * now. There is no list at `/sessions`: the calendar already answers "what did
 * I do", month by month, with the plan drawn beside it, and a second flat list
 * of the same Sessions was one screen doing a screen's job twice.
 *
 * Settings sits below the shell's sections as well, at `/settings`, reached
 * from the top bar rather than from a tab. It carries what the app is for once
 * — the backup — and what it is for day to day, which is everything else.
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
import { ImportWizard } from '@/features/import/ImportWizard';
import { MoreScreen } from '@/features/more/MoreScreen';
import { ProgressScreen } from '@/features/progress/ProgressScreen';
import { RoutineDetailScreen } from '@/features/routines/RoutineDetailScreen';
import { RoutinesScreen } from '@/features/routines/RoutinesScreen';
import { SessionScreen } from '@/features/session/SessionScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
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
