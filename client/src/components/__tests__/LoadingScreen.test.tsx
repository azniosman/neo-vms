import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { LoadingScreen } from '../LoadingScreen';
import theme from '../../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('LoadingScreen', () => {
  test('renders with default message', () => {
    renderWithTheme(<LoadingScreen />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders with custom message', () => {
    const customMessage = 'Please wait while we load your data...';
    renderWithTheme(<LoadingScreen message={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('has proper styling', () => {
    renderWithTheme(<LoadingScreen />);
    
    const container = screen.getByText('Loading...').closest('div');
    expect(container).toHaveStyle({
      display: 'flex',
      'flex-direction': 'column',
      'align-items': 'center',
      'justify-content': 'center',
      'min-height': '100vh'
    });
  });

  test('renders CircularProgress component', () => {
    renderWithTheme(<LoadingScreen />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveClass('MuiCircularProgress-root');
  });

  test('message has correct typography variant', () => {
    renderWithTheme(<LoadingScreen />);
    
    const messageElement = screen.getByText('Loading...');
    expect(messageElement).toHaveClass('MuiTypography-h6');
  });

  test('handles empty message', () => {
    renderWithTheme(<LoadingScreen message="" />);
    
    expect(screen.getByText('')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('handles undefined message', () => {
    renderWithTheme(<LoadingScreen message={undefined} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});