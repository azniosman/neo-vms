import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authAPI } from '../../services/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'receptionist' | 'host' | 'security';
  department?: string;
  phone?: string;
  profilePicture?: string;
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    language: string;
    timezone: string;
  };
  mfaEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  mfaRequired: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  mfaRequired: false,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string; mfaToken?: string }) => {
    const response = await authAPI.login(credentials);
    return response.data;
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await authAPI.logout();
  }
);

export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async () => {
    const response = await authAPI.getCurrentUser();
    return response.data;
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async () => {
    const response = await authAPI.refreshToken();
    return response.data;
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (email: string) => {
    const response = await authAPI.forgotPassword(email);
    return response.data;
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData: Partial<User>) => {
    const response = await authAPI.updateProfile(profileData);
    return response.data;
  }
);

export const setupMFA = createAsyncThunk(
  'auth/setupMFA',
  async () => {
    const response = await authAPI.setupMFA();
    return response.data;
  }
);

export const verifyMFA = createAsyncThunk(
  'auth/verifyMFA',
  async (token: string) => {
    const response = await authAPI.verifyMFA(token);
    return response.data;
  }
);

export const disableMFA = createAsyncThunk(
  'auth/disableMFA',
  async (password: string) => {
    const response = await authAPI.disableMFA(password);
    return response.data;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMfaRequired: (state) => {
      state.mfaRequired = false;
    },
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
    },
    clearAuth: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.mfaRequired = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.mfaRequired) {
          state.mfaRequired = true;
        } else {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.isAuthenticated = true;
          state.mfaRequired = false;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
        state.mfaRequired = false;
        state.error = null;
      })
      
      // Check auth status
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.loading = false;
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
      })
      
      // Refresh token
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.accessToken;
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null;
        state.accessToken = null;
        state.isAuthenticated = false;
      })
      
      // Reset password
      .addCase(resetPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Password reset failed';
      })
      
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Profile update failed';
      })
      
      // Setup MFA
      .addCase(setupMFA.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(setupMFA.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(setupMFA.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'MFA setup failed';
      })
      
      // Verify MFA
      .addCase(verifyMFA.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyMFA.fulfilled, (state) => {
        state.loading = false;
        if (state.user) {
          state.user.mfaEnabled = true;
        }
      })
      .addCase(verifyMFA.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'MFA verification failed';
      })
      
      // Disable MFA
      .addCase(disableMFA.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(disableMFA.fulfilled, (state) => {
        state.loading = false;
        if (state.user) {
          state.user.mfaEnabled = false;
        }
      })
      .addCase(disableMFA.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'MFA disable failed';
      });
  },
});

export const { clearError, clearMfaRequired, setAccessToken, clearAuth } = authSlice.actions;
export default authSlice.reducer;