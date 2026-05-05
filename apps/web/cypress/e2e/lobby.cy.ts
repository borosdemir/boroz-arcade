describe('Lobby Requirements', () => {
  it('Debería cargar el lobby y mostrar estado de conexión', () => {
    // Nota: Este test requiere sesión activa. 
    // En un entorno CI usaríamos un comando personalizado cy.login()
    cy.visit('/lobby')
    
    // Requisito: El título del Lobby debe ser visible
    cy.contains('GLOBAL LOBBY').should('be.visible')
    
    // Requisito: El buscador de combate debe estar presente
    cy.contains('BUSCADOR DE COMBATE').should('be.visible')
    cy.contains('BUSCAR PARTIDA').should('be.visible')
  })
})
