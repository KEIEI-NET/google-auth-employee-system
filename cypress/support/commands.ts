// ***********************************************
// Custom commands for E2E testing
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string): Chainable<void>;
      logout(): Chainable<void>;
      checkAuth(): Chainable<void>;
      mockGoogleAuth(code: string, state: string): Chainable<void>;
    }
  }
}

// Command to mock login
Cypress.Commands.add('login', (email = 'test@example.com') => {
  // Set auth cookies
  cy.setCookie('accessToken', 'mock-access-token');
  cy.setCookie('refreshToken', 'mock-refresh-token');
  
  // Mock /api/auth/me endpoint
  cy.intercept('GET', '**/api/auth/me', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        id: 'test-user-id',
        email: email,
        name: 'Test User',
        profilePicture: null,
        roles: ['EMPLOYEE'],
        permissions: ['employee:read'],
      },
    },
  }).as('getMe');
});

// Command to logout
Cypress.Commands.add('logout', () => {
  cy.clearCookies();
  cy.visit('/login');
});

// Command to check authentication
Cypress.Commands.add('checkAuth', () => {
  cy.getCookie('accessToken').should('exist');
  cy.getCookie('refreshToken').should('exist');
});

// Command to mock Google OAuth callback
Cypress.Commands.add('mockGoogleAuth', (code: string, state: string) => {
  cy.intercept('POST', '**/api/auth/google/callback', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        employee: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          profilePicture: null,
          roles: ['EMPLOYEE'],
        },
      },
    },
    headers: {
      'set-cookie': [
        'accessToken=mock-access-token; Path=/; HttpOnly; SameSite=Strict',
        'refreshToken=mock-refresh-token; Path=/; HttpOnly; SameSite=Strict',
      ],
    },
  }).as('googleCallback');
});

export {};