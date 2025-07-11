import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Box, Alert } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
}) => {
  const location = useLocation();
  const isAuthenticated = useSelector((state: RootState) => state.auth?.isAuthenticated) || false;
  const user = useSelector((state: RootState) => state.auth?.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles.length > 0 && user && !requiredRoles.includes(user.role)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Access Denied - You don't have permission to access this page. Required roles: {requiredRoles.join(', ')}
        </Alert>
      </Box>
    );
  }

  return <>{children}</>;
};