describe('Dashboard', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/');
  });

  it('should display user information', () => {
    cy.wait('@getMe');
    
    // Check user profile card
    cy.contains('Test User').should('be.visible');
    cy.contains('test@example.com').should('be.visible');
    cy.contains('EMPLOYEE').should('be.visible');
  });

  it('should display dashboard components', () => {
    // Check header
    cy.contains('Employee Dashboard').should('be.visible');
    cy.get('button').contains('Logout').should('be.visible');
    
    // Check quick actions
    cy.contains('Quick Actions').should('be.visible');
    cy.get('button').contains('View Profile').should('be.visible');
    
    // Check statistics cards
    cy.contains('Department').should('be.visible');
    cy.contains('Team Size').should('be.visible');
    cy.contains('Projects').should('be.visible');
    cy.contains('Status').should('be.visible');
  });

  it('should show admin panel button for admin users', () => {
    // Mock admin user
    cy.intercept('GET', '**/api/auth/me', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: 'admin-user-id',
          email: 'admin@example.com',
          name: 'Admin User',
          profilePicture: null,
          roles: ['ADMIN'],
          permissions: ['employee:read', 'employee:write'],
        },
      },
    }).as('getAdminMe');
    
    cy.visit('/');
    cy.wait('@getAdminMe');
    
    // Admin panel button should be visible
    cy.get('button').contains('Admin Panel').should('be.visible');
  });

  it('should navigate to admin page', () => {
    // Mock admin user
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
          employees: [
            {
              id: 'emp-1',
              email: 'employee1@example.com',
              name: 'Employee One',
              department: 'Engineering',
              position: 'Developer',
              isActive: true,
              roles: ['EMPLOYEE'],
              lastLoginAt: '2025-01-01T00:00:00Z',
              createdAt: '2025-01-01T00:00:00Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        },
      },
    }).as('getEmployees');
    
    cy.visit('/');
    cy.wait('@getAdminMe');
    
    // Click admin panel button
    cy.get('button').contains('Admin Panel').click();
    
    // Should navigate to admin page
    cy.url().should('include', '/admin');
    cy.wait('@getEmployees');
    
    // Admin dashboard should be visible
    cy.contains('Admin Dashboard').should('be.visible');
    cy.contains('Employee Management').should('be.visible');
  });

  it('should not show admin features for regular users', () => {
    cy.wait('@getMe');
    
    // Admin panel button should not be visible
    cy.get('button').contains('Admin Panel').should('not.exist');
    
    // Manage Team button should not be visible for regular employees
    cy.get('button').contains('Manage Team').should('not.exist');
  });
});