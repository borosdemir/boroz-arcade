/**
 * Boroz Arcade — Space Shooter Game Engine
 * 
 * Motor de juego puro (sin dependencias de DOM ni Canvas).
 * Toda la lógica de negocio del juego vive aquí para ser testeable con Jest.
 */

// ─── Tipos ───────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Ship {
  id: string;
  pos: Vec2;
  rotation: number; // radianes
  velocity: Vec2;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  score: number;
  isAlive: boolean;
  lastShotTime: number;
  color: string;
}

export interface Bullet {
  id: string;
  ownerId: string;
  pos: Vec2;
  velocity: Vec2;
  damage: number;
  createdAt: number;
  isActive: boolean;
}

export interface GameState {
  ships: Map<string, Ship>;
  bullets: Bullet[];
  arenaWidth: number;
  arenaHeight: number;
  tickCount: number;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

// ─── Constantes del Juego ────────────────────────────────

export const SHIP_SPEED = 4;
export const SHIP_ROTATION_SPEED = 0.06;
export const BULLET_SPEED = 8;
export const BULLET_DAMAGE = 10;
export const BULLET_LIFETIME_MS = 2000;
export const SHOOT_COOLDOWN_MS = 200;
export const SHIP_MAX_HEALTH = 100;
export const SHIP_MAX_ENERGY = 100;
export const ENERGY_PER_SHOT = 5;
export const ENERGY_REGEN_RATE = 0.3;
export const RESPAWN_DELAY_MS = 3000;
export const BULLET_RADIUS = 3;
export const SHIP_HITBOX_RADIUS = 12;

// ─── Funciones del Motor ─────────────────────────────────

/**
 * Crea una nave nueva con valores por defecto.
 */
export function createShip(id: string, x: number, y: number, color = "#3b82f6"): Ship {
  return {
    id,
    pos: { x, y },
    rotation: 0,
    velocity: { x: 0, y: 0 },
    health: SHIP_MAX_HEALTH,
    maxHealth: SHIP_MAX_HEALTH,
    energy: SHIP_MAX_ENERGY,
    maxEnergy: SHIP_MAX_ENERGY,
    score: 0,
    isAlive: true,
    lastShotTime: 0,
    color,
  };
}

/**
 * Crea el estado inicial de una partida.
 */
export function createGameState(width = 800, height = 600): GameState {
  return {
    ships: new Map(),
    bullets: [],
    arenaWidth: width,
    arenaHeight: height,
    tickCount: 0,
  };
}

/**
 * Aplica el input del jugador a su nave (movimiento puro, sin disparo).
 * Retorna la nave actualizada.
 */
export function applyInput(ship: Ship, input: InputState, arenaW: number, arenaH: number): Ship {
  if (!ship.isAlive) return ship;

  const next = { ...ship, pos: { ...ship.pos }, velocity: { ...ship.velocity } };

  // Rotación
  if (input.left) next.rotation -= SHIP_ROTATION_SPEED;
  if (input.right) next.rotation += SHIP_ROTATION_SPEED;

  // Propulsión
  if (input.up) {
    next.velocity.x += Math.sin(next.rotation) * 0.3;
    next.velocity.y -= Math.cos(next.rotation) * 0.3;
  }
  if (input.down) {
    next.velocity.x -= Math.sin(next.rotation) * 0.15;
    next.velocity.y += Math.cos(next.rotation) * 0.15;
  }

  // Fricción
  next.velocity.x *= 0.97;
  next.velocity.y *= 0.97;

  // Limitar velocidad
  const speed = Math.sqrt(next.velocity.x ** 2 + next.velocity.y ** 2);
  if (speed > SHIP_SPEED) {
    next.velocity.x = (next.velocity.x / speed) * SHIP_SPEED;
    next.velocity.y = (next.velocity.y / speed) * SHIP_SPEED;
  }

  // Aplicar velocidad
  next.pos.x += next.velocity.x;
  next.pos.y += next.velocity.y;

  // Wrap-around (efecto pacman)
  if (next.pos.x < 0) next.pos.x = arenaW;
  if (next.pos.x > arenaW) next.pos.x = 0;
  if (next.pos.y < 0) next.pos.y = arenaH;
  if (next.pos.y > arenaH) next.pos.y = 0;

  // Regenerar energía
  next.energy = Math.min(next.maxEnergy, next.energy + ENERGY_REGEN_RATE);

  return next;
}

/**
 * RF-001: Intenta crear un proyectil. Retorna null si está en cooldown o sin energía.
 */
export function tryShoot(ship: Ship, now: number): Bullet | null {
  if (!ship.isAlive) return null;
  if (now - ship.lastShotTime < SHOOT_COOLDOWN_MS) return null;
  if (ship.energy < ENERGY_PER_SHOT) return null;

  const bullet: Bullet = {
    id: `${ship.id}-${now}`,
    ownerId: ship.id,
    pos: {
      x: ship.pos.x + Math.sin(ship.rotation) * 20,
      y: ship.pos.y - Math.cos(ship.rotation) * 20,
    },
    velocity: {
      x: Math.sin(ship.rotation) * BULLET_SPEED + ship.velocity.x * 0.5,
      y: -Math.cos(ship.rotation) * BULLET_SPEED + ship.velocity.y * 0.5,
    },
    damage: BULLET_DAMAGE,
    createdAt: now,
    isActive: true,
  };

  return bullet;
}

/**
 * Actualiza posiciones de todos los proyectiles y elimina los expirados.
 */
export function updateBullets(bullets: Bullet[], now: number, arenaW: number, arenaH: number): Bullet[] {
  return bullets
    .map((b) => {
      if (!b.isActive) return b;
      return {
        ...b,
        pos: {
          x: b.pos.x + b.velocity.x,
          y: b.pos.y + b.velocity.y,
        },
      };
    })
    .filter((b) => {
      // Eliminar si expiró
      if (now - b.createdAt > BULLET_LIFETIME_MS) return false;
      // Eliminar si salió de la arena
      if (b.pos.x < -10 || b.pos.x > arenaW + 10) return false;
      if (b.pos.y < -10 || b.pos.y > arenaH + 10) return false;
      return b.isActive;
    });
}

/**
 * RF-003: Detecta colisiones entre proyectiles y naves.
 * Retorna un array de eventos de impacto { bulletId, shipId, damage }.
 */
export function detectCollisions(
  bullets: Bullet[],
  ships: Map<string, Ship>
): { bulletId: string; shipId: string; damage: number }[] {
  const hits: { bulletId: string; shipId: string; damage: number }[] = [];

  for (const bullet of bullets) {
    if (!bullet.isActive) continue;

    for (const [shipId, ship] of ships) {
      if (!ship.isAlive) continue;
      if (bullet.ownerId === shipId) continue; // No autoimpacto

      const dx = bullet.pos.x - ship.pos.x;
      const dy = bullet.pos.y - ship.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < SHIP_HITBOX_RADIUS + BULLET_RADIUS) {
        hits.push({
          bulletId: bullet.id,
          shipId: ship.id,
          damage: bullet.damage,
        });
        bullet.isActive = false; // Consumir el proyectil
        break;
      }
    }
  }

  return hits;
}

/**
 * RF-003: Aplica daño a una nave. Retorna la nave actualizada.
 */
export function applyDamage(ship: Ship, damage: number): Ship {
  const next = { ...ship };
  next.health = Math.max(0, next.health - damage);
  if (next.health <= 0) {
    next.isAlive = false;
  }
  return next;
}

/**
 * Respawnea una nave en una posición aleatoria.
 */
export function respawnShip(ship: Ship, arenaW: number, arenaH: number): Ship {
  return {
    ...ship,
    pos: {
      x: Math.random() * arenaW,
      y: Math.random() * arenaH,
    },
    velocity: { x: 0, y: 0 },
    rotation: 0,
    health: SHIP_MAX_HEALTH,
    energy: SHIP_MAX_ENERGY,
    isAlive: true,
  };
}
