describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display login page', () => {
    cy.contains('Employee Portal').should('be.visible');
    cy.contains('Sign in with Google').should('be.visible');
    cy.get('button').contains('Sign in with Google').should('not.be.disabled');
  });

  it('should redirect to Google OAuth when clicking sign in', () => {
    // Mock the OAuth URL response
    cy.intercept('GET', '**/api/auth/google', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          authUrl: 'https://accounts.google.com/oauth/authorize?client_id=test',
          state: 'test-state-123',
        },
      },
    }).as('getAuthUrl');

    // Click sign in button
    cy.get('button').contains('Sign in with Google').click();

    // Verify API call was made
    cy.wait('@getAuthUrl');
  });

  it('should handle OAuth callback successfully', () => {
    // Mock Google OAuth callback
    cy.mockGoogleAuth('test-code', 'test-state');

    // Visit callback URL
    cy.visit('/login?code=test-code&state=test-state');

    // Wait for callback to complete
    cy.wait('@googleCallback');

    // Should redirect to dashboard
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should handle OAuth callback errors', () => {
    // Mock failed callback
    cy.intercept('POST', '**/api/auth/google/callback', {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Invalid or expired state',
        },
      },
    }).as('failedCallback');

    // Visit callback URL with invalid state
    cy.visit('/login?code=test-code&state=invalid-state');

    // Wait for callback
    cy.wait('@failedCallback');

    // Should show error message
    cy.contains('Invalid or expired state').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('should redirect authenticated users from login to dashboard', () => {
    // Login first
    cy.login();
    
    // Try to visit login page
    cy.visit('/login');
    
    // Should redirect to dashboard
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should handle logout', () => {
    // Login first
    cy.login();
    cy.visit('/');
    
    // Mock logout endpoint
    cy.intercept('POST', '**/api/auth/logout', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      },
    }).as('logout');
    
    // Click logout button
    cy.get('button').contains('Logout').click();
    
    // Wait for logout
    cy.wait('@logout');
    
    // Should redirect to login
    cy.url().should('include', '/login');
    
    // Cookies should be cleared
    cy.getCookie('accessToken').should('not.exist');
    cy.getCookie('refreshToken').should('not.exist');
  });

  it('should refresh token automatically', () => {
    // Mock expired token response
    let tokenExpired = true;
    
    cy.intercept('GET', '**/api/auth/me', (req) => {
      if (tokenExpired) {
        tokenExpired = false;
        req.reply({
          statusCode: 401,
          body: {
            success: false,
            error: {
              code: 'TOKEN_EXPIRED',
              message: 'Token expired',
            },
          },
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            success: true,
            data: {
              id: 'test-user-id',
              email: 'test@example.com',
              name: 'Test User',
              roles: ['EMPLOYEE'],
            },
          },
        });
      }
    }).as('getMe');
    
    // Mock refresh endpoint
    cy.intercept('POST', '**/api/auth/refresh', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          message: 'Token refreshed successfully',
        },
      },
      headers: {
        'set-cookie': 'accessToken=new-access-token; Path=/; HttpOnly',
      },
    }).as('refresh');
    
    // Login and visit dashboard
    cy.login();
    cy.visit('/');
    
    // Should handle token refresh automatically
    cy.wait('@getMe');
    cy.wait('@refresh');
    cy.wait('@getMe');
  });
});