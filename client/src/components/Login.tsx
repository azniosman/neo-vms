import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Link,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../store';
import { login, clearError } from '../store/slices/authSlice';

const loginSchema = yup.object({
  email: yup.string().email('Invalid email address').required('Email is required'),
  password: yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  mfaToken: yup.string().optional()
}).required();

type LoginFormData = yup.InferType<typeof loginSchema>;

const Login: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  const { loading, error, isAuthenticated, mfaRequired } = useSelector((state: RootState) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema)
  });

  const watchedEmail = watch('email');
  const watchedPassword = watch('password');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Handle MFA requirement
  useEffect(() => {
    if (mfaRequired) {
      setActiveStep(1);
    }
  }, [mfaRequired]);

  // Clear error when form changes
  useEffect(() => {
    if (error) {
      dispatch(clearError());
    }
  }, [watchedEmail, watchedPassword, dispatch, error]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await dispatch(login(data)).unwrap();
      
      // If MFA is required, the form will show MFA step
      // If login is successful, user will be redirected to dashboard
      console.log('Login result:', result);
      
    } catch (err) {
      console.error('Login error:', err);
      // Error is handled by the Redux slice
    }
  };

  const handleMFASubmit = async (data: LoginFormData) => {
    try {
      await dispatch(login({
        email: data.email,
        password: data.password,
        mfaToken: data.mfaToken
      })).unwrap();
    } catch (err) {
      console.error('MFA verification error:', err);
    }
  };

  const handleBackToLogin = () => {
    setActiveStep(0);
    dispatch(clearError());
  };

  const steps = ['Login', 'MFA Verification'];

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Neo VMS Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            PDPA Compliant Visitor Management System
          </Typography>
        </Box>

        {mfaRequired && (
          <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {mfaRequired && activeStep === 1 ? (
          // MFA Step
          <form onSubmit={handleSubmit(handleMFASubmit)}>
            <Typography variant="h6" gutterBottom>
              Multi-Factor Authentication Required
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please enter the 6-digit code from your authenticator app.
            </Typography>

            <TextField
              {...register('mfaToken')}
              label="MFA Token"
              type="text"
              fullWidth
              margin="normal"
              error={!!errors.mfaToken}
              helperText={errors.mfaToken?.message}
              disabled={loading}
              inputProps={{ maxLength: 6 }}
            />

            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handleBackToLogin}
                disabled={loading}
                sx={{ flex: 1 }}
              >
                Back to Login
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ flex: 1 }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Verify'
                )}
              </Button>
            </Box>
          </form>
        ) : (
          // Login Step
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              {...register('email')}
              label="Email Address"
              type="email"
              fullWidth
              margin="normal"
              error={!!errors.email}
              helperText={errors.email?.message}
              disabled={loading}
            />

            <TextField
              {...register('password')}
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={loading}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Sign In'
              )}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link href="/forgot-password" variant="body2">
                Forgot your password?
              </Link>
            </Box>
          </form>
        )}

        {/* Demo credentials info */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Demo Credentials:</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Email: admin@neo-vms.local
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Password: AdminPassword123!
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login; 