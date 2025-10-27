describe('Customer Journey - Auto Service Flow', () => {
  beforeEach(() => {
    // Visit the application
    cy.visit('/')

    // Mock Firebase Auth and Firestore
    cy.window().then((win: any) => {
      // Mock Firebase Auth
      win.firebase = {
        auth: () => ({
          signInWithPhoneNumber: cy.stub().resolves({
            confirm: cy.stub().resolves({
              user: { uid: 'test-user-id', phoneNumber: '+573001234567' }
            })
          })
        })
      }

      // Mock Firestore
      win.firebase.firestore = () => ({
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
    })
  })

  it('should complete full customer journey from QR scan to queue ticket', () => {
    // Step 1: Navigate to queue join with QR scan parameter
    cy.visit('/queue/join?source=qr-main-entrance')

    // Verify QR scan step is displayed
    cy.contains('Escanea el código QR').should('be.visible')

    // Simulate QR scan completion
    cy.window().then((win: any) => {
      win.history.pushState({}, '', '/queue/join?source=qr-main-entrance&scanned=true')
    })

    // Step 2: User detection - should detect new user
    cy.contains('Usuario Nuevo').should('be.visible')

    // Step 3: Enter motorcycle plate
    cy.get('[data-cy="plate-input"]').type('ABC123')
    cy.get('[data-cy="plate-submit"]').click()

    // Should show motorcycle registration form
    cy.contains('Registrar Motocicleta').should('be.visible')

    // Fill motorcycle details
    cy.get('[data-cy="brand-select"]').select('Yamaha')
    cy.get('[data-cy="model-input"]').type('FZ150')
    cy.get('[data-cy="year-input"]').type('2022')
    cy.get('[data-cy="mileage-input"]').type('50000')
    cy.get('[data-cy="motorcycle-submit"]').click()

    // Step 4: Phone verification
    cy.contains('Verificación de Teléfono').should('be.visible')
    cy.get('[data-cy="phone-input"]').type('3001234567')
    cy.get('[data-cy="send-code"]').click()

    // Enter OTP
    cy.get('[data-cy="otp-input"]').each(($input, index) => {
      cy.wrap($input).type('1')
    })
    cy.get('[data-cy="verify-code"]').click()

    // Step 5: Service selection
    cy.contains('Selecciona los Servicios').should('be.visible')
    cy.get('[data-cy="service-oil-change"]').check()
    cy.get('[data-cy="service-maintenance"]').check()
    cy.get('[data-cy="services-submit"]').click()

    // Step 6: Confirmation
    cy.contains('Confirmar Solicitud').should('be.visible')
    cy.get('[data-cy="confirm-submit"]').click()

    // Step 7: Success - Queue ticket
    cy.contains('¡Estás en la Cola!').should('be.visible')
    cy.contains('Posición:').should('be.visible')
    cy.get('[data-cy="qr-code"]').should('be.visible')
  })

  it('should handle existing user flow', () => {
    // Mock existing user
    cy.window().then((win: any) => {
      win.localStorage.setItem('user', JSON.stringify({
        uid: 'existing-user-id',
        phoneNumber: '+573001234567'
      }))
    })

    cy.visit('/queue/join?source=qr-main-entrance')

    // Should skip phone verification and go directly to motorcycle selection
    cy.contains('Selecciona tu Motocicleta').should('be.visible')
  })

  it('should validate plate format', () => {
    cy.visit('/queue/join?source=qr-main-entrance')

    // Invalid plate format
    cy.get('[data-cy="plate-input"]').type('INVALID')
    cy.get('[data-cy="plate-submit"]').should('be.disabled')

    // Valid plate format
    cy.get('[data-cy="plate-input"]').clear().type('ABC123')
    cy.get('[data-cy="plate-submit"]').should('not.be.disabled')
  })

  it('should handle service selection and pricing', () => {
    // Navigate to service selection step
    cy.visit('/queue/join?source=qr-main-entrance')

    // Skip to service selection (mocking previous steps)
    cy.window().then((win: any) => {
      win.localStorage.setItem('queue-flow', JSON.stringify({
        step: 'services',
        plate: 'ABC123',
        motorcycle: { id: 'test-id', brand: 'Yamaha', model: 'FZ150' },
        phone: '+573001234567'
      }))
    })

    cy.reload()

    // Select services
    cy.get('[data-cy="service-oil-change"]').check()
    cy.get('[data-cy="service-brake-check"]').check()

    // Verify total calculation
    cy.get('[data-cy="total-price"]').should('contain', '$75,000')
    cy.get('[data-cy="total-time"]').should('contain', '75 minutos')
  })

  it('should generate and display QR code', () => {
    // Mock completed queue entry
    cy.window().then((win: any) => {
      win.localStorage.setItem('queue-ticket', JSON.stringify({
        id: 'Q001',
        position: 3,
        estimatedWait: 45,
        qrCode: 'data:image/png;base64,test-qr-code'
      }))
    })

    cy.visit('/queue/ticket')

    cy.get('[data-cy="qr-code"]').should('be.visible')
    cy.contains('Posición: #3').should('be.visible')
    cy.contains('45 minutos').should('be.visible')
  })

  it('should handle queue status tracking', () => {
    cy.visit('/queue/status?id=Q001')

    cy.contains('Estado de Cola').should('be.visible')
    cy.get('[data-cy="queue-position"]').should('be.visible')
    cy.get('[data-cy="estimated-wait"]').should('be.visible')
  })

  it('should allow feedback submission', () => {
    // Mock completed service
    cy.window().then((win: any) => {
      win.localStorage.setItem('completed-service', JSON.stringify({
        id: 'WO001',
        services: ['Cambio de Aceite', 'Revisión de Frenos'],
        completedAt: new Date().toISOString()
      }))
    })

    cy.visit('/queue/feedback?id=WO001')

    // Rate service
    cy.get('[data-cy="rating-5"]').click()
    cy.get('[data-cy="feedback-text"]').type('Excelente servicio!')
    cy.get('[data-cy="submit-feedback"]').click()

    cy.contains('Gracias por tu feedback').should('be.visible')
  })
})