import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { ThemeProvider } from './components/theme/ThemeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="light">
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: 'bg-white dark:bg-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800',
            duration: 4000,
            style: {
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            },
          }}
        />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);