describe('Smoke Test - Boroz Arcade', () => {
  it('Debería cargar la página de inicio y navegar al login', () => {
    // 1. Requisito: La landing page debe cargar correctamente
    cy.visit('/')
    
    // Verificar título principal
    cy.contains('BOROZ ARCADE').should('be.visible')
    
    // 2. Requisito: El botón de entrar debe llevar al login
    cy.contains('ENTRAR AL JUEGO').click()
    
    // Verificar que estamos en la página de login
    cy.url().should('include', '/login')
    
    // 3. Requisito: El formulario de login debe estar disponible
    cy.contains('BIENVENIDO PILOTO').should('be.visible')
    cy.get('input[type="email"]').should('be.visible')
    cy.get('input[type="password"]').should('be.visible')
  })
})
