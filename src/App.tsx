/**
 * Routes. Two of them, and both are the truth about what this app can do today:
 * the import wizard of §11.1, and the harness that drives the execution flow
 * until its own screens exist. The §10 areas — Today, Calendar, Progress, More —
 * and the navigation between them arrive with the screens themselves.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Harness } from '@/features/harness/Harness';
import { ImportWizard } from '@/features/import/ImportWizard';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ImportWizard />} path="/import" />
        <Route element={<Harness />} path="/harness" />
        <Route element={<Navigate replace to="/import" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}
