import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { queryClient } from './lib/queryClient';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in DOM');

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename}>
        <RootErrorBoundary>
          <AuthProvider>
            <App />
          </AuthProvider>
        </RootErrorBoundary>
      </BrowserRouter>
      <Toaster richColors />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
