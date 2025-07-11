import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Typography, Container, Alert } from '@mui/material';

import { RootState } from './store';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoadingScreen } from './components/LoadingScreen';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2">
              Please refresh the page or contact support if the problem persists.
            </Typography>
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}

// Lazy load components for better performance
const Login = React.lazy(() => import('./components/Login'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));

// Fallback component for lazy loading
const LazyFallback = () => (
  <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
    <LoadingScreen />
  </Container>
);

// Layout component with proper error handling
const Layout = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Suspense fallback={<LazyFallback />}>
          {children}
        </Suspense>
      </Box>
    </Box>
  </ErrorBoundary>
);

const App: React.FC = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth?.isAuthenticated) || false;
  const loading = useSelector((state: RootState) => state.auth?.loading) || false;
  const error = useSelector((state: RootState) => state.auth?.error);

  // Handle authentication errors
  useEffect(() => {
    if (error) {
      console.error('Authentication error:', error);
    }
  }, [error]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          {error && (
            <Alert severity="error" sx={{ position: 'fixed', top: 16, right: 16, zIndex: 9999 }}>
              {error}
            </Alert>
          )}
          
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            } />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Default route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Box>
      </Router>
    </ErrorBoundary>
  );
};

export default App;