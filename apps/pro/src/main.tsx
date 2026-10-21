import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { i18next } from '@zelate/i18n';
import { initializeProI18n } from '@zelate/i18n/pro';
import { ToastProvider } from '@zelate/ui';
import '@zelate/ui/fonts.css';
import '@zelate/ui/theme.css';
import { HomePage } from './routes/HomePage';

// ADR-007: client data lives in memory only (no persister), and is dropped
// when the tab closes or the user signs out.
const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 5 * 60_000 } },
});
const router = createBrowserRouter(
  [
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
        Component: (await import('./routes/InvitePage')).InvitePage,
      }),
      path: '/invite/:token',
    },
    {
      lazy: async () => ({
        Component: (await import('./routes/SignupPage')).SignupPage,
      }),
      path: '/signup',
    },
    {
      lazy: async () => ({
        Component: (await import('./routes/SignupPendingPage'))
          .SignupPendingPage,
      }),
      path: '/signup/pending',
    },
    {
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import('./routes/DashboardPage')).DashboardPage,
          }),
        },
        {
          lazy: async () => ({
            Component: (await import('./routes/SetupPage')).SetupPage,
          }),
          path: 'setup',
        },
        {
          lazy: async () => ({
            Component: (await import('./routes/AppointmentsPage'))
              .AppointmentsPage,
          }),
          path: 'appointments',
        },
      ],
      lazy: async () => ({
        Component: (await import('./routes/DashboardGuard')).DashboardGuard,
      }),
      path: '/dashboard',
    },
    {
      children: [
        { element: <Navigate replace to="/stylist/queue" />, index: true },
        {
          lazy: async () => ({
            Component: (await import('./routes/stylist/StylistQueuePage'))
              .StylistQueuePage,
          }),
          path: 'queue',
        },
        {
          lazy: async () => ({
            Component: (
              await import('./routes/stylist/StylistAppointmentsPage')
            ).StylistAppointmentsPage,
          }),
          path: 'appointments',
        },
        {
          lazy: async () => ({
            Component: (await import('./routes/stylist/StylistSummaryPage'))
              .StylistSummaryPage,
          }),
          path: 'summary',
        },
      ],
      lazy: async () => ({
        Component: (await import('./routes/stylist/StylistLayout'))
          .StylistLayout,
      }),
      path: '/stylist',
    },
    {
      children: [
        {
          lazy: async () => ({
            Component: (await import('./routes/AdminSalonsPage'))
              .AdminSalonsPage,
          }),
          path: 'salons',
        },
        {
          lazy: async () => ({
            Component: (await import('./routes/AdminSalonPage')).AdminSalonPage,
          }),
          path: 'salons/:salonId',
        },
      ],
      lazy: async () => ({
        Component: (await import('./routes/AdminGuard')).AdminGuard,
      }),
      path: '/admin',
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
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

initializeProI18n().then(() => {
  document.title = i18next.t('brand.pro_name');
  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );

  if (!description) {
    throw new Error('The application description meta tag is missing.');
  }

  description.content = i18next.t('app_metadata.pro_description');

  createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider label={i18next.t('notifications_region')}>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
});
