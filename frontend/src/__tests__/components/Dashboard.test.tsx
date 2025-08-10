import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../../components/Dashboard';
import { AuthContext } from '../../contexts/AuthContext';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithAuth = (user: any) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          login: jest.fn(),
          logout: jest.fn(),
          refreshToken: jest.fn(),
        }}
      >
        <Dashboard />
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render dashboard for regular employee', () => {
    const user = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: null,
      roles: ['EMPLOYEE'],
    };

    renderWithAuth(user);

    expect(screen.getByText('Employee Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('EMPLOYEE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('should show admin panel button for admin users', () => {
    const user = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
      profilePicture: null,
      roles: ['ADMIN'],
    };

    renderWithAuth(user);

    expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument();
  });

  it('should show manage team button for managers', () => {
    const user = {
      id: 'manager-id',
      email: 'manager@example.com',
      name: 'Manager User',
      profilePicture: null,
      roles: ['MANAGER'],
    };

    renderWithAuth(user);

    expect(screen.getByRole('button', { name: /manage team/i })).toBeInTheDocument();
  });

  it('should navigate to admin page when admin panel clicked', () => {
    const user = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
      profilePicture: null,
      roles: ['ADMIN'],
    };

    renderWithAuth(user);

    const adminButton = screen.getByRole('button', { name: /admin panel/i });
    fireEvent.click(adminButton);

    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('should call logout when logout button clicked', () => {
    const mockLogout = jest.fn();
    const user = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: null,
      roles: ['EMPLOYEE'],
    };

    render(
      <BrowserRouter>
        <AuthContext.Provider
          value={{
            user,
            isLoading: false,
            login: jest.fn(),
            logout: mockLogout,
            refreshToken: jest.fn(),
          }}
        >
          <Dashboard />
        </AuthContext.Provider>
      </BrowserRouter>
    );

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should display user avatar or initial', () => {
    const userWithPicture = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      profilePicture: 'https://example.com/avatar.jpg',
      roles: ['EMPLOYEE'],
    };

    const { rerender } = renderWithAuth(userWithPicture);
    
    // Check avatar image
    const avatar = screen.getByRole('img', { hidden: true });
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');

    // Rerender without picture
    const userWithoutPicture = { ...userWithPicture, profilePicture: null };
    rerender(
      <BrowserRouter>
        <AuthContext.Provider
          value={{
            user: userWithoutPicture,
            isLoading: false,
            login: jest.fn(),
            logout: jest.fn(),
            refreshToken: jest.fn(),
          }}
        >
          <Dashboard />
        </AuthContext.Provider>
      </BrowserRouter>
    );

    // Check initial letter
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should return null when no user', () => {
    const { container } = renderWithAuth(null);
    expect(container.firstChild).toBeNull();
  });
});