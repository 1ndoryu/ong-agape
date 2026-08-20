import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AgapeAdminPanel from './features/admin/AgapeAdminPanel';
import AdminAuthGate from './features/admin/AdminAuthGate';
import AgapeLanding from './features/landing/AgapeLanding';
import BlogPostPage from './features/landing/BlogPostPage';
import TransparencyPage from './features/landing/TransparencyPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const blogSlug = window.location.pathname.startsWith('/blog/')
    ? window.location.pathname.slice('/blog/'.length)
    : null;
  const isTransparencyPath = window.location.pathname === '/transparency' || window.location.pathname === '/transparency/';

  return (
    <QueryClientProvider client={queryClient}>
      {isAdminPath ? <AdminAuthGate>{(profile, token) => <AgapeAdminPanel profile={profile} token={token} />}</AdminAuthGate> : blogSlug ? <BlogPostPage slug={blogSlug} /> : isTransparencyPath ? <TransparencyPage /> : <AgapeLanding />}
    </QueryClientProvider>
  );
}

export default App;
