describe('Client Flow E2E Tests', () => {
  beforeEach(() => {
    // Visit the application
    cy.visit('/');

    // Mock Firebase Auth
    cy.window().then((win: any) => {
      win.firebase = {
        auth: () => ({
          signInWithPhoneNumber: cy.stub().resolves({
            confirm: cy.stub().resolves({
              user: { uid: 'test-user-id', phoneNumber: '+573001234567' }
            })
          })
        }),
        firestore: () => ({
          collection: () => ({
            doc: () => ({
              set: cy.stub().resolves(),
              get: cy.stub().resolves({ exists: true, data: () => ({}) }),
              update: cy.stub().resolves()
            }),
            where: () => ({
              get: cy.stub().resolves({ docs: [] })
            }),
            add: cy.stub().resolves({ id: 'test-doc-id' })
          })
        })
      };
    });
  });

  describe('Complete Client Journey', () => {
    it('should complete full client flow from QR scan to queue ticket', () => {
      // Step 1: Navigate to client flow
      cy.visit('/client-flow');

      // Step 2: Phone verification step
      cy.contains('Verificación de Teléfono').should('be.visible');
      cy.get('[data-cy="phone-input"]').type('3001234567');
      cy.get('[data-cy="send-code"]').click();

      // Enter OTP
      cy.get('[data-cy="otp-input"]').each(($input, index) => {
        cy.wrap($input).type('1');
      });
      cy.get('[data-cy="verify-code"]').click();

      // Step 3: Motorcycle selection step
      cy.contains('Selección de Motocicleta').should('be.visible');
      cy.get('[data-cy="motorcycle-card"]').first().click();

      // Enter license plate and mileage
      cy.get('[data-cy="plate-input"]').type('ABC123');
      cy.get('[data-cy="mileage-input"]').type('50000');
      cy.get('[data-cy="next-step"]').click();

      // Step 4: Service selection step
      cy.contains('Selección de Servicio').should('be.visible');
      cy.get('[data-cy="service-item"]').first().click();
      cy.get('[data-cy="next-step"]').click();

      // Step 5: Complete flow and join queue
      cy.get('[data-cy="complete-flow"]').click();

      // Verify navigation to wait ticket
      cy.url().should('include', '/wait-ticket');
      cy.contains('¡Estás en la Cola!').should('be.visible');
      cy.get('[data-cy="queue-position"]').should('be.visible');
      cy.get('[data-cy="estimated-time"]').should('be.visible');
      cy.get('[data-cy="qr-code"]').should('be.visible');
    });

    it('should handle existing user flow', () => {
      // Mock existing user
      cy.window().then((win: any) => {
        win.localStorage.setItem('user', JSON.stringify({
          uid: 'existing-user-id',
          phoneNumber: '+573001234567'
        }));
      });

      cy.visit('/client-flow');

      // Should skip phone verification
      cy.contains('Verificación de Teléfono').should('not.exist');
      cy.contains('Selección de Motocicleta').should('be.visible');
    });

    it('should validate required fields', () => {
      cy.visit('/client-flow');

      // Try to proceed without phone
      cy.get('[data-cy="next-step"]').should('be.disabled');

      // Enter invalid phone
      cy.get('[data-cy="phone-input"]').type('invalid');
      cy.get('[data-cy="send-code"]').should('be.disabled');

      // Enter valid phone
      cy.get('[data-cy="phone-input"]').clear().type('3001234567');
      cy.get('[data-cy="send-code"]').should('not.be.disabled');
    });

    it('should prevent skipping steps', () => {
      cy.visit('/client-flow');

      // Try to navigate directly to service step
      cy.window().then((win: any) => {
        win.history.pushState({}, '', '/client-flow?step=service');
      });

      cy.reload();

      // Should redirect to phone step
      cy.contains('Verificación de Teléfono').should('be.visible');
      cy.contains('Selección de Servicio').should('not.exist');
    });

    it('should handle back navigation', () => {
      cy.visit('/client-flow');

      // Complete phone step
      cy.get('[data-cy="phone-input"]').type('3001234567');
      cy.get('[data-cy="send-code"]').click();
      cy.get('[data-cy="otp-input"]').each(($input) => {
        cy.wrap($input).type('1');
      });
      cy.get('[data-cy="verify-code"]').click();

      // Go to motorcycle step
      cy.contains('Selección de Motocicleta').should('be.visible');
      cy.get('[data-cy="motorcycle-card"]').first().click();
      cy.get('[data-cy="plate-input"]').type('ABC123');
      cy.get('[data-cy="mileage-input"]').type('50000');
      cy.get('[data-cy="next-step"]').click();

      // Go back
      cy.get('[data-cy="back-step"]').click();

      // Should be back at motorcycle step
      cy.contains('Selección de Motocicleta').should('be.visible');
    });
  });

  describe('Queue Management Integration', () => {
    it('should update queue position in real-time', () => {
      // Complete client flow
      cy.completeClientFlow();

      // Capture initial position
      cy.get('[data-cy="queue-position"]').invoke('text').then((initialPosition) => {
        const position = parseInt(initialPosition);

        // Simulate technician calling next customer
        cy.task('callNextInQueue');

        // Wait for polling update (5 seconds)
        cy.wait(6000);

        // Position should decrement
        cy.get('[data-cy="queue-position"]').should('contain', (position - 1).toString());
      });
    });

    it('should handle queue entry expiration', () => {
      cy.completeClientFlow();

      // Mock expired entry
      cy.task('expireQueueEntry');

      // Wait for cleanup
      cy.wait(10000);

      // Should show expired message or redirect
      cy.contains('Entrada expirada').should('be.visible');
    });

    it('should display QR code correctly', () => {
      cy.completeClientFlow();

      cy.get('[data-cy="qr-code"]')
        .should('be.visible')
        .and('have.attr', 'src')
        .and('include', 'data:image');
    });
  });

  describe('Error Handling', () => {
    it('should handle network failures gracefully', () => {
      // Mock network failure
      cy.intercept('POST', '**/firestore/**', { forceNetworkError: true });

      cy.visit('/client-flow');

      cy.get('[data-cy="phone-input"]').type('3001234567');
      cy.get('[data-cy="send-code"]').click();

      // Should show error message
      cy.contains('Error de conexión').should('be.visible');
    });

    it('should handle invalid data submission', () => {
      cy.visit('/client-flow');

      // Enter invalid mileage
      cy.get('[data-cy="phone-input"]').type('3001234567');
      cy.get('[data-cy="send-code"]').click();
      cy.get('[data-cy="otp-input"]').each(($input) => {
        cy.wrap($input).type('1');
      });
      cy.get('[data-cy="verify-code"]').click();

      cy.get('[data-cy="mileage-input"]').type('-1000');
      cy.get('[data-cy="next-step"]').should('be.disabled');

      // Error message should appear
      cy.contains('Kilometraje inválido').should('be.visible');
    });

    it('should recover from form errors', () => {
      cy.visit('/client-flow');

      // Cause validation error
      cy.get('[data-cy="phone-input"]').type('invalid');
      cy.get('[data-cy="send-code"]').click();
      cy.contains('Teléfono inválido').should('be.visible');

      // Fix error
      cy.get('[data-cy="phone-input"]').clear().type('3001234567');
      cy.contains('Teléfono inválido').should('not.exist');
      cy.get('[data-cy="send-code"]').should('not.be.disabled');
    });
  });

  describe('Performance and UX', () => {
    it('should load steps quickly', () => {
      const startTime = Date.now();

      cy.visit('/client-flow');

      cy.contains('Verificación de Teléfono').should('be.visible').then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(2000); // Should load within 2 seconds
      });
    });

    it('should provide visual feedback during loading', () => {
      cy.visit('/client-flow');

      cy.get('[data-cy="phone-input"]').type('3001234567');
      cy.get('[data-cy="send-code"]').click();

      // Should show loading state
      cy.get('[data-cy="loading-spinner"]').should('be.visible');

      // Loading should complete
      cy.get('[data-cy="loading-spinner"]').should('not.exist');
    });

    it('should maintain responsive design', () => {
      cy.visit('/client-flow');

      // Test mobile viewport
      cy.viewport('iphone-x');
      cy.contains('Verificación de Teléfono').should('be.visible');

      // Test tablet viewport
      cy.viewport('ipad-2');
      cy.contains('Verificación de Teléfono').should('be.visible');

      // Test desktop viewport
      cy.viewport('macbook-15');
      cy.contains('Verificación de Teléfono').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation', () => {
      cy.visit('/client-flow');

      // Tab through form elements
      cy.get('[data-cy="phone-input"]').focus();
      cy.focused().should('have.attr', 'data-cy', 'phone-input');

      cy.realPress('Tab');
      cy.focused().should('have.attr', 'data-cy', 'send-code');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/client-flow');

      cy.get('[data-cy="phone-input"]').should('have.attr', 'aria-label', 'Número de teléfono');
      cy.get('[data-cy="send-code"]').should('have.attr', 'aria-label', 'Enviar código');
    });

    it('should announce status changes', () => {
      cy.visit('/client-flow');

      // Complete phone verification
      cy.get('[data-cy="phone-input"]').type('3001234567');
      cy.get('[data-cy="send-code"]').click();
      cy.get('[data-cy="otp-input"]').each(($input) => {
        cy.wrap($input).type('1');
      });
      cy.get('[data-cy="verify-code"]').click();

      // Should announce step completion
      cy.get('[aria-live="polite"]').should('contain', 'Paso completado');
    });
  });
});