import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../components/LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>{component}</AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login page elements', () => {
    renderWithRouter(<LoginPage />);
    
    expect(screen.getByText('Employee Portal')).toBeInTheDocument();
    expect(screen.getByText('Sign in with your company Google account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
  });

  it('should handle Google login button click', async () => {
    const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';
    mockedAxios.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          authUrl: mockAuthUrl,
          state: 'test-state',
        },
      },
    });

    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;

    renderWithRouter(<LoginPage />);
    
    const signInButton = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/google')
      );
    });

    expect(window.location.href).toBe(mockAuthUrl);
  });

  it('should show loading state during sign in', async () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithRouter(<LoginPage />);
    
    const signInButton = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(signInButton).toBeDisabled();
    });
  });

  it('should display error message on login failure', async () => {
    mockedAxios.get.mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Failed to initialize login',
          },
        },
      },
    });

    renderWithRouter(<LoginPage />);
    
    const signInButton = screen.getByRole('button', { name: /sign in with google/i });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to initialize login')).toBeInTheDocument();
    });
  });

  it('should handle OAuth callback with code and state', async () => {
    const mockLogin = jest.fn();
    jest.spyOn(React, 'useContext').mockReturnValue({
      user: null,
      isLoading: false,
      login: mockLogin,
      logout: jest.fn(),
      refreshToken: jest.fn(),
    });

    // Mock location with callback params
    delete (window as any).location;
    window.location = {
      search: '?code=test-code&state=test-state',
    } as any;

    renderWithRouter(<LoginPage />);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-code', 'test-state');
    });
  });

  it('should display OAuth error from URL params', () => {
    // Mock location with error param
    delete (window as any).location;
    window.location = {
      search: '?error=access_denied',
    } as any;

    renderWithRouter(<LoginPage />);

    expect(screen.getByText('Authentication failed: access_denied')).toBeInTheDocument();
  });
});