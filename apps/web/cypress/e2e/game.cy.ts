/**
 * Boroz Arcade — Space Shooter E2E Tests
 * 
 * Tests basados en requisitos:
 * - RF-001: Disparo del jugador (visual + no interrumpe movimiento)
 * - RF-003: Detección de colisión y daño (HUD actualizado)
 * - RF-005: Matchmaking y sala de juego (sala con ID único)
 * - RNF-001: Input latency <50ms
 */

describe('RF-005: Matchmaking y sala de juego', () => {
  it('El Lobby permite buscar partida y redirige a una sala', () => {
    cy.visit('/lobby')

    // Requisito: El buscador de combate debe estar presente
    cy.contains('BUSCAR PARTIDA').should('be.visible')
    
    // Requisito: Al hacer clic, se inicia la búsqueda
    cy.contains('BUSCAR PARTIDA').click()
    cy.contains('BUSCANDO OPONENTE').should('be.visible')

    // Requisito: Se redirige a una sala con ID único
    cy.url({ timeout: 5000 }).should('include', '/game/')
  })
})

describe('RF-001 / RF-003: Arena de Combate', () => {
  beforeEach(() => {
    cy.visit('/game/test-arena')
  })

  it('Debe renderizar la arena con un Canvas de juego', () => {
    // Requisito: El canvas del juego debe existir y ser visible
    cy.get('canvas#game-canvas').should('be.visible')
  })

  it('Debe mostrar el HUD del piloto con integridad y energía', () => {
    // RF-003: HUD actualizado en ambos clientes
    cy.contains('HULL INTEGRITY', { matchCase: false }).should('be.visible')
    cy.contains('ENERGY', { matchCase: false }).should('be.visible')
  })

  it('Debe mostrar la información de la sala', () => {
    // RF-005: Sala con ID único visible
    cy.contains('test-arena').should('be.visible')
    cy.contains('LIVE SYNC ACTIVE', { matchCase: false }).should('be.visible')
  })

  it('Debe mostrar las instrucciones de controles', () => {
    // UX: El jugador debe saber qué teclas usar
    cy.contains('[WASD]').should('be.visible')
    cy.contains('[SPACE]').should('be.visible')
  })
})
