import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';
import { ProtectedRoute } from '../ProtectedRoute';
import authSlice from '../../store/slices/authSlice';
import theme from '../../theme';

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    preloadedState: initialState,
  });
};

const renderWithProviders = (
  component: React.ReactElement,
  { initialState = {}, route = '/' } = {}
) => {
  const store = createMockStore(initialState);
  
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <ThemeProvider theme={theme}>
          {component}
        </ThemeProvider>
      </MemoryRouter>
    </Provider>
  );
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'host' as const,
  preferences: {
    notifications: { email: true, sms: false, push: true },
    language: 'en',
    timezone: 'UTC'
  },
  mfaEnabled: false,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z'
};

describe('ProtectedRoute', () => {
  test('renders children when user is authenticated', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  test('redirects to login when user is not authenticated', () => {
    const initialState = {
      auth: {
        isAuthenticated: false,
        user: null,
        accessToken: null,
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  test('renders children when user has required role', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, role: 'admin' as const },
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  test('shows access denied when user lacks required role', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, role: 'host' as const },
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/You don't have permission to access this page/)).toBeInTheDocument();
    expect(screen.getByText(/Required roles: admin/)).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  test('allows access when user has one of multiple required roles', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, role: 'receptionist' as const },
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={['admin', 'receptionist']}>
        <div>Staff Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Staff Content')).toBeInTheDocument();
  });

  test('shows access denied with multiple required roles', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, role: 'host' as const },
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={['admin', 'receptionist']}>
        <div>Staff Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/Required roles: admin, receptionist/)).toBeInTheDocument();
    expect(screen.queryByText('Staff Content')).not.toBeInTheDocument();
  });

  test('renders children when no roles are required', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute>
        <div>General Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('General Content')).toBeInTheDocument();
  });

  test('renders children when empty roles array is provided', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={[]}>
        <div>No Role Required</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('No Role Required')).toBeInTheDocument();
  });

  test('handles missing user object gracefully', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: null,
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });

  test('access denied alert has correct styling', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: { ...mockUser, role: 'host' as const },
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute requiredRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>,
      { initialState }
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-standardError');
    expect(screen.getByText('Access Denied')).toHaveClass('MuiAlertTitle-root');
  });

  test('supports complex nested JSX as children', () => {
    const initialState = {
      auth: {
        isAuthenticated: true,
        user: mockUser,
        accessToken: 'test-token',
        loading: false,
        error: null,
        mfaRequired: false
      }
    };

    renderWithProviders(
      <ProtectedRoute>
        <div>
          <h1>Dashboard</h1>
          <p>Welcome to the dashboard</p>
          <button>Click me</button>
        </div>
      </ProtectedRoute>,
      { initialState }
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the dashboard')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});