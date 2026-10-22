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
      Component: (await import('./routes/CheckInPage')).CheckInPage,
    }),
    path: '/salons/:slug/check-in',
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
  {
    lazy: async () => ({
      Component: (await import('./routes/AccountPage')).AccountPage,
    }),
    path: '/account',
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
      // The SMS link code is a bearer credential (ADR-006): never sent to Sentry.
      const redact = (text: string) =>
        text.replace(/\/t\/[A-Za-z0-9]{8}/g, '/t/[link]');
      init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request?.url) event.request.url = redact(event.request.url);
          return event;
        },
        beforeBreadcrumb(breadcrumb) {
          const url = breadcrumb.data?.url;
          if (typeof url === 'string' && breadcrumb.data) {
            breadcrumb.data.url = redact(url);
          }
          if (breadcrumb.message)
            breadcrumb.message = redact(breadcrumb.message);
          if (breadcrumb.data && typeof breadcrumb.data.to === 'string') {
            breadcrumb.data.to = redact(breadcrumb.data.to);
          }
          if (breadcrumb.data && typeof breadcrumb.data.from === 'string') {
            breadcrumb.data.from = redact(breadcrumb.data.from);
          }
          return breadcrumb;
        },
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
