// ***********************************************************
// This file is processed and loaded automatically before test files.
// ***********************************************************

// Import commands.js
import './commands';

// Alternatively you can use CommonJS syntax:
// require('./commands')

Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  return false;
});