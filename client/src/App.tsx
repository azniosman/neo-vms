import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Box } from '@mui/material';

import { RootState } from './store';
import { checkAuthStatus } from './store/slices/authSlice';
import { initializeSocket } from './store/slices/socketSlice';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoadingScreen } from './components/LoadingScreen';

// Pages
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import Visitors from './pages/Visitors';
import Visits from './pages/Visits';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Emergency from './pages/Emergency';
import NotFound from './pages/NotFound';

// Public pages
import VisitorPreRegistration from './pages/public/VisitorPreRegistration';
import VisitorSelfCheckIn from './pages/public/VisitorSelfCheckIn';

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, loading, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(initializeSocket());
    }
  }, [dispatch, isAuthenticated, user]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          } />
          <Route path="/visitor/pre-register" element={<VisitorPreRegistration />} />
          <Route path="/visitor/checkin" element={<VisitorSelfCheckIn />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="visitors" element={<Visitors />} />
            <Route path="visits" element={<Visits />} />
            <Route path="users" element={
              <ProtectedRoute requiredRoles={['admin', 'receptionist']}>
                <Users />
              </ProtectedRoute>
            } />
            <Route path="reports" element={
              <ProtectedRoute requiredRoles={['admin', 'receptionist', 'security']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute requiredRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="profile" element={<Profile />} />
            <Route path="emergency" element={
              <ProtectedRoute requiredRoles={['admin', 'security']}>
                <Emergency />
              </ProtectedRoute>
            } />
          </Route>
          
          {/* 404 route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Box>
    </Router>
  );
};

export default App;