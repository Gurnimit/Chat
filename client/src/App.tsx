import React, { Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ErrorBoundary from './components/ErrorBoundary';

const Login = React.lazy(() => import('./pages/Login'));
const ChatDashboard = React.lazy(() => import('./pages/ChatDashboard'));

const LoadingFallback = () => (
  <div className="min-h-screen bg-dark-bg flex items-center justify-center">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
      <p className="text-xs text-dark-muted font-medium tracking-wider">Loading...</p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return user ? (
    <SocketProvider>
      <Suspense fallback={<LoadingFallback />}>
        <ChatDashboard />
      </Suspense>
    </SocketProvider>
  ) : (
    <Suspense fallback={<LoadingFallback />}>
      <Login />
    </Suspense>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
