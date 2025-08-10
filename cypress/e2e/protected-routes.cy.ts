describe('Protected Routes', () => {
  it('should redirect to login when not authenticated', () => {
    // Visit dashboard without authentication
    cy.visit('/');
    
    // Should redirect to login
    cy.url().should('include', '/login');
  });

  it('should show unauthorized page for insufficient permissions', () => {
    // Login as regular employee
    cy.login('employee@example.com');
    
    // Try to access admin page
    cy.visit('/admin');
    
    // Should redirect to unauthorized page
    cy.url().should('include', '/unauthorized');
    cy.contains('Access Denied').should('be.visible');
    cy.contains("You don't have permission to access this page").should('be.visible');
  });

  it('should allow navigation back from unauthorized page', () => {
    // Login as regular employee
    cy.login('employee@example.com');
    
    // Visit unauthorized page
    cy.visit('/unauthorized');
    
    // Click go to dashboard
    cy.get('button').contains('Go to Dashboard').click();
    
    // Should navigate to dashboard
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should protect admin routes', () => {
    // Login as regular employee
    cy.login('employee@example.com');
    
    // Mock employee endpoint for non-admin
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 403,
      body: {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
        },
      },
    }).as('getEmployeesForbidden');
    
    // Try to access admin page directly
    cy.visit('/admin');
    
    // Should redirect to unauthorized
    cy.url().should('include', '/unauthorized');
  });

  it('should allow admin users to access admin routes', () => {
    // Login as admin
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          name: 'Admin User',
          roles: ['ADMIN'],
          permissions: ['employee:read', 'employee:write'],
        },
      },
    }).as('getAdminMe');
    
    // Mock employees endpoint
    cy.intercept('GET', '**/api/employees*', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          employees: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        },
      },
    }).as('getEmployees');
    
    cy.login('admin@example.com');
    cy.visit('/admin');
    
    cy.wait('@getAdminMe');
    cy.wait('@getEmployees');
    
    // Should stay on admin page
    cy.url().should('include', '/admin');
    cy.contains('Admin Dashboard').should('be.visible');
  });

  it('should handle 404 routes', () => {
    cy.login();
    
    // Visit non-existent route
    cy.visit('/non-existent-page', { failOnStatusCode: false });
    
    // Should redirect to home
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
});