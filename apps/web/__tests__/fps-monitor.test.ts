/**
 * RNF-003: Frame rate estable 60 FPS
 * 
 * Test que valida que el game loop no introduce overhead excesivo.
 * Simula N ticks del motor y mide el tiempo de ejecución.
 * 
 * Umbral: Cada tick del motor puro debe completarse en < 2ms
 * (para dejar margen al rendering y networking dentro del frame de 16.67ms).
 */
import {
  createShip,
  createGameState,
  applyInput,
  tryShoot,
  updateBullets,
  detectCollisions,
  applyDamage,
  type InputState,
  type GameState,
  type Ship,
  type Bullet,
} from '@/lib/game/engine'

describe('RNF-003: Performance del Game Loop', () => {
  test('Un tick completo del motor ejecuta en menos de 2ms (con 4 naves y 50 proyectiles)', () => {
    // Preparar estado de juego denso
    const state = createGameState(800, 600)
    
    // 4 naves (RF-005: máximo 4 jugadores por sala)
    const ships = new Map<string, Ship>()
    ships.set('p1', createShip('p1', 100, 100, '#3b82f6'))
    ships.set('p2', createShip('p2', 700, 100, '#ef4444'))
    ships.set('p3', createShip('p3', 100, 500, '#22c55e'))
    ships.set('p4', createShip('p4', 700, 500, '#a855f7'))
    
    // 50 proyectiles activos
    const bullets: Bullet[] = []
    const now = Date.now()
    for (let i = 0; i < 50; i++) {
      bullets.push({
        id: `b-${i}`,
        ownerId: `p${(i % 4) + 1}`,
        pos: { x: Math.random() * 800, y: Math.random() * 600 },
        velocity: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 8 },
        damage: 10,
        createdAt: now,
        isActive: true,
      })
    }

    const input: InputState = { up: true, down: false, left: false, right: true, shoot: true }

    // Medir tiempo de un tick completo
    const start = performance.now()

    // Fase 1: Actualizar todas las naves
    for (const [id, ship] of ships) {
      ships.set(id, applyInput(ship, input, 800, 600))
    }

    // Fase 2: Procesar disparos
    for (const [id, ship] of ships) {
      const bullet = tryShoot(ship, now)
      if (bullet) {
        bullets.push(bullet)
        ship.lastShotTime = now
      }
    }

    // Fase 3: Actualizar proyectiles
    const updatedBullets = updateBullets(bullets, now, 800, 600)

    // Fase 4: Detectar colisiones
    const hits = detectCollisions(updatedBullets, ships)

    // Fase 5: Aplicar daño
    for (const hit of hits) {
      const ship = ships.get(hit.shipId)
      if (ship) {
        ships.set(hit.shipId, applyDamage(ship, hit.damage))
      }
    }

    const elapsed = performance.now() - start

    // Umbral: < 2ms por tick para dejar margen al renderer
    expect(elapsed).toBeLessThan(2)
  })

  test('100 ticks consecutivos mantienen rendimiento estable', () => {
    const ships = new Map<string, Ship>()
    ships.set('p1', createShip('p1', 400, 300))
    ships.set('p2', createShip('p2', 200, 200))

    let bullets: Bullet[] = []
    const input: InputState = { up: true, down: false, left: true, right: false, shoot: true }

    const times: number[] = []

    for (let tick = 0; tick < 100; tick++) {
      const now = Date.now() + tick * 16 // Simular 60fps
      const start = performance.now()

      for (const [id, ship] of ships) {
        ships.set(id, applyInput(ship, input, 800, 600))
      }

      for (const [id, ship] of ships) {
        const bullet = tryShoot(ship, now)
        if (bullet) {
          bullets.push(bullet)
          ship.lastShotTime = now
        }
      }

      bullets = updateBullets(bullets, now, 800, 600)
      const hits = detectCollisions(bullets, ships)

      for (const hit of hits) {
        const ship = ships.get(hit.shipId)
        if (ship) ships.set(hit.shipId, applyDamage(ship, hit.damage))
      }

      times.push(performance.now() - start)
    }

    // p95 < 2ms
    times.sort((a, b) => a - b)
    const p95 = times[Math.floor(times.length * 0.95)]
    expect(p95).toBeLessThan(2)
  })
})
