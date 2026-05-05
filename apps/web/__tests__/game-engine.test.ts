/**
 * Boroz Arcade — Game Engine Unit Tests
 * 
 * Tests basados en los requisitos funcionales RF-001, RF-003.
 * Escritos ANTES de la implementación del componente de juego (Test-First).
 */
import {
  createShip,
  createGameState,
  applyInput,
  tryShoot,
  updateBullets,
  detectCollisions,
  applyDamage,
  respawnShip,
  SHIP_SPEED,
  BULLET_SPEED,
  BULLET_DAMAGE,
  SHOOT_COOLDOWN_MS,
  ENERGY_PER_SHOT,
  SHIP_MAX_HEALTH,
  SHIP_HITBOX_RADIUS,
  BULLET_RADIUS,
  type InputState,
  type Ship,
} from '@/lib/game/engine'

// ─── RF-001: Disparo del jugador ─────────────────────────

describe('RF-001: Disparo del jugador', () => {
  let ship: Ship

  beforeEach(() => {
    ship = createShip('player-1', 400, 300)
  })

  test('El jugador puede disparar y genera un proyectil válido', () => {
    const bullet = tryShoot(ship, Date.now())

    expect(bullet).not.toBeNull()
    expect(bullet!.ownerId).toBe('player-1')
    expect(bullet!.isActive).toBe(true)
    expect(bullet!.damage).toBe(BULLET_DAMAGE)
  })

  test('El proyectil sale desde la posición de la nave (no del origen)', () => {
    ship.pos = { x: 200, y: 150 }
    ship.rotation = 0 // Apuntando arriba

    const bullet = tryShoot(ship, Date.now())

    // El proyectil debe salir cerca de la nave, no en (0,0)
    expect(bullet!.pos.x).toBeCloseTo(200, 0)
    expect(bullet!.pos.y).toBeLessThan(150) // Sale hacia arriba
  })

  test('El proyectil hereda parcialmente la velocidad de la nave', () => {
    ship.velocity = { x: 3, y: -2 }
    const bullet = tryShoot(ship, Date.now())

    // La velocidad del proyectil debe incluir componente de la nave
    expect(Math.abs(bullet!.velocity.x)).toBeGreaterThan(0)
  })

  test('No se puede disparar durante el cooldown (RF-001: no interrumpe movimiento)', () => {
    const now = Date.now()
    const first = tryShoot(ship, now)
    expect(first).not.toBeNull()

    // Actualizar lastShotTime como lo haría el game loop
    ship.lastShotTime = now

    const second = tryShoot(ship, now + 50) // 50ms después (cooldown = 200ms)
    expect(second).toBeNull()
  })

  test('Se puede disparar después del cooldown', () => {
    const now = Date.now()
    ship.lastShotTime = now

    const bullet = tryShoot(ship, now + SHOOT_COOLDOWN_MS + 1)
    expect(bullet).not.toBeNull()
  })

  test('No se puede disparar sin energía suficiente', () => {
    ship.energy = ENERGY_PER_SHOT - 1

    const bullet = tryShoot(ship, Date.now())
    expect(bullet).toBeNull()
  })

  test('No se puede disparar si la nave está destruida', () => {
    ship.isAlive = false

    const bullet = tryShoot(ship, Date.now())
    expect(bullet).toBeNull()
  })
})

// ─── RF-003: Detección de colisión y daño ────────────────

describe('RF-003: Detección de colisión y daño', () => {
  test('Detecta colisión cuando un proyectil impacta una nave enemiga', () => {
    const ships = new Map()
    const targetShip = createShip('enemy-1', 100, 100)
    ships.set('enemy-1', targetShip)

    // Proyectil justo encima del enemigo
    const bullets = [{
      id: 'b1',
      ownerId: 'player-1',
      pos: { x: 100, y: 100 },
      velocity: { x: 0, y: -BULLET_SPEED },
      damage: BULLET_DAMAGE,
      createdAt: Date.now(),
      isActive: true,
    }]

    const hits = detectCollisions(bullets, ships)

    expect(hits.length).toBe(1)
    expect(hits[0].shipId).toBe('enemy-1')
    expect(hits[0].damage).toBe(BULLET_DAMAGE)
  })

  test('NO detecta colisión con la propia nave (anti-autoimpacto)', () => {
    const ships = new Map()
    ships.set('player-1', createShip('player-1', 100, 100))

    const bullets = [{
      id: 'b1',
      ownerId: 'player-1', // mismo dueño
      pos: { x: 100, y: 100 },
      velocity: { x: 0, y: -BULLET_SPEED },
      damage: BULLET_DAMAGE,
      createdAt: Date.now(),
      isActive: true,
    }]

    const hits = detectCollisions(bullets, ships)
    expect(hits.length).toBe(0)
  })

  test('NO detecta colisión si el proyectil está lejos', () => {
    const ships = new Map()
    ships.set('enemy-1', createShip('enemy-1', 100, 100))

    const bullets = [{
      id: 'b1',
      ownerId: 'player-1',
      pos: { x: 500, y: 500 }, // Lejos
      velocity: { x: 0, y: -BULLET_SPEED },
      damage: BULLET_DAMAGE,
      createdAt: Date.now(),
      isActive: true,
    }]

    const hits = detectCollisions(bullets, ships)
    expect(hits.length).toBe(0)
  })

  test('Aplica daño correctamente a la nave', () => {
    const ship = createShip('enemy-1', 100, 100)
    const damaged = applyDamage(ship, BULLET_DAMAGE)

    expect(damaged.health).toBe(SHIP_MAX_HEALTH - BULLET_DAMAGE)
    expect(damaged.isAlive).toBe(true)
  })

  test('La nave muere cuando la vida llega a 0', () => {
    const ship = createShip('enemy-1', 100, 100)
    const killed = applyDamage(ship, SHIP_MAX_HEALTH)

    expect(killed.health).toBe(0)
    expect(killed.isAlive).toBe(false)
  })

  test('La vida nunca baja de 0 (no negativa)', () => {
    const ship = createShip('enemy-1', 100, 100)
    const overkill = applyDamage(ship, SHIP_MAX_HEALTH + 999)

    expect(overkill.health).toBe(0)
  })

  test('NO detecta colisión con nave muerta', () => {
    const ships = new Map()
    const dead = createShip('enemy-1', 100, 100)
    dead.isAlive = false
    ships.set('enemy-1', dead)

    const bullets = [{
      id: 'b1',
      ownerId: 'player-1',
      pos: { x: 100, y: 100 },
      velocity: { x: 0, y: -BULLET_SPEED },
      damage: BULLET_DAMAGE,
      createdAt: Date.now(),
      isActive: true,
    }]

    const hits = detectCollisions(bullets, ships)
    expect(hits.length).toBe(0)
  })
})

// ─── Movimiento y arena ──────────────────────────────────

describe('Movimiento y arena', () => {
  const noInput: InputState = { up: false, down: false, left: false, right: false, shoot: false }

  test('La nave se mueve hacia adelante con W (up)', () => {
    const ship = createShip('p1', 400, 300)
    ship.rotation = 0 // Apuntando arriba

    const moved = applyInput(ship, { ...noInput, up: true }, 800, 600)

    // Con rotación 0, impulso va hacia arriba (Y negativo)
    expect(moved.velocity.y).toBeLessThan(0)
  })

  test('La nave rota a la izquierda con A (left)', () => {
    const ship = createShip('p1', 400, 300)
    const original = ship.rotation

    const rotated = applyInput(ship, { ...noInput, left: true }, 800, 600)

    expect(rotated.rotation).toBeLessThan(original)
  })

  test('La velocidad está limitada a SHIP_SPEED', () => {
    let ship = createShip('p1', 400, 300)
    // Simular muchos ticks de aceleración
    for (let i = 0; i < 100; i++) {
      ship = applyInput(ship, { ...noInput, up: true }, 800, 600)
    }

    const speed = Math.sqrt(ship.velocity.x ** 2 + ship.velocity.y ** 2)
    expect(speed).toBeLessThanOrEqual(SHIP_SPEED + 0.01)
  })

  test('La nave hace wrap-around al salir de la arena (efecto Pacman)', () => {
    const ship = createShip('p1', -1, 300)
    const wrapped = applyInput(ship, noInput, 800, 600)

    expect(wrapped.pos.x).toBe(800)
  })

  test('La nave muerta no se mueve', () => {
    const ship = createShip('p1', 400, 300)
    ship.isAlive = false
    ship.velocity = { x: 0, y: 0 }

    const result = applyInput(ship, { ...noInput, up: true }, 800, 600)

    // No debería cambiar
    expect(result.pos.x).toBe(400)
    expect(result.pos.y).toBe(300)
  })
})

// ─── Proyectiles lifecycle ───────────────────────────────

describe('Ciclo de vida de proyectiles', () => {
  test('Los proyectiles se mueven cada tick', () => {
    const bullets = [{
      id: 'b1',
      ownerId: 'p1',
      pos: { x: 100, y: 100 },
      velocity: { x: 0, y: -BULLET_SPEED },
      damage: BULLET_DAMAGE,
      createdAt: Date.now(),
      isActive: true,
    }]

    const updated = updateBullets(bullets, Date.now(), 800, 600)

    expect(updated[0].pos.y).toBeLessThan(100)
  })

  test('Los proyectiles expirados se eliminan', () => {
    const oldTime = Date.now() - 3000 // 3 segundos atrás
    const bullets = [{
      id: 'b1',
      ownerId: 'p1',
      pos: { x: 100, y: 100 },
      velocity: { x: 0, y: -BULLET_SPEED },
      damage: BULLET_DAMAGE,
      createdAt: oldTime,
      isActive: true,
    }]

    const updated = updateBullets(bullets, Date.now(), 800, 600)

    expect(updated.length).toBe(0)
  })

  test('Los proyectiles fuera de la arena se eliminan', () => {
    const bullets = [{
      id: 'b1',
      ownerId: 'p1',
      pos: { x: -20, y: 100 }, // Fuera por la izquierda
      velocity: { x: -BULLET_SPEED, y: 0 },
      damage: BULLET_DAMAGE,
      createdAt: Date.now(),
      isActive: true,
    }]

    const updated = updateBullets(bullets, Date.now(), 800, 600)

    expect(updated.length).toBe(0)
  })
})

// ─── Respawn ─────────────────────────────────────────────

describe('Respawn', () => {
  test('La nave se restaura con vida completa tras respawn', () => {
    const dead = createShip('p1', 100, 100)
    dead.isAlive = false
    dead.health = 0

    const respawned = respawnShip(dead, 800, 600)

    expect(respawned.isAlive).toBe(true)
    expect(respawned.health).toBe(SHIP_MAX_HEALTH)
    expect(respawned.velocity).toEqual({ x: 0, y: 0 })
  })
})
