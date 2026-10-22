import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ensurePersistentStorage } from './pwa/persistence';
import './styles/theme.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

void ensurePersistentStorage();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
