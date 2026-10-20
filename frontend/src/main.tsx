import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './app';
import { client } from './query-client';
import './styles.css';
import { supabase } from './supabase';

const Router = supabase ? HashRouter : BrowserRouter;

if (supabase)
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') client.clear();
  });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
