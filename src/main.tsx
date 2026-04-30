import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found in DOM');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter basename="/ff-e-builder">
      <App />
    </BrowserRouter>
  </StrictMode>,
);
