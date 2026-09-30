import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@fourfold/core';
// The handwriting fonts ship with the app: Fourfold needs no internet connection.
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource/caveat/700.css';
import './styles.css';
import { App } from './App.tsx';
import { Store, StoreContext } from './store.ts';

const store = new Store(createClient());
store.refresh();

// Load the fonts before the first render: a late swap would re-wrap Task text under strikes already drawn to fit it.
const FONTS = ['400 19px Kalam', '700 19px Kalam', '700 26px Caveat'];
const giveUp = new Promise((r) => setTimeout(r, 3000));
Promise.race([Promise.all(FONTS.map((f) => document.fonts.load(f))), giveUp]).finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <StoreContext value={store}>
        <App />
      </StoreContext>
    </StrictMode>,
  ),
);
