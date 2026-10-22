import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { i18next } from '@zelate/i18n';
import { initializeClientI18n } from '@zelate/i18n/client';
import { ToastProvider } from '@zelate/ui';
import '@zelate/ui/fonts.css';
import '@zelate/ui/theme.css';
import { HomePage } from './routes/HomePage';

const queryClient = new QueryClient();
const router = createBrowserRouter([
  {
    element: <HomePage />,
    path: '/',
  },
  {
    lazy: async () => ({
      Component: (await import('./routes/SignInPage')).SignInPage,
    }),
    path: '/signin',
  },
  {
    lazy: async () => ({
      Component: (await import('./routes/SalonPage')).SalonPage,
    }),
    path: '/salons/:slug',
  },
  {
    lazy: async () => ({
      Component: (await import('./routes/JoinPage')).JoinPage,
    }),
    path: '/salons/:slug/join',
  },
  {
    lazy: async () => ({
      Component: (await import('./routes/QrPage')).QrPage,
    }),
    path: '/q/:qrToken',
  },
  {
    lazy: async () => ({
      Component: (await import('./routes/TicketPage')).TicketPage,
    }),
    path: '/ticket',
  },
  {
    lazy: async () => ({
      Component: (await import('./routes/LinkTicketPage')).LinkTicketPage,
    }),
    path: '/t/:shortCode',
  },
]);
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

if (sentryDsn) {
  void import('@sentry/react')
    .then(({ init }) => {
      init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
      });
    })
    .catch((error: unknown) => {
      console.error('Sentry failed to initialize.', error);
    });
}

initializeClientI18n().then(() => {
  document.title = i18next.t('brand.client_name');
  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );

  if (!description) {
    throw new Error('The application description meta tag is missing.');
  }

  description.content = i18next.t('app_metadata.client_description');

  createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label={i18next.t('notifications_region')}>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
});
