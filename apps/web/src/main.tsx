import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@fourfold/core';
import './styles.css';
import { App } from './App.tsx';
import { Store, StoreContext } from './store.ts';

const store = new Store(createClient());
store.refresh();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext value={store}>
      <App />
    </StoreContext>
  </StrictMode>,
);
