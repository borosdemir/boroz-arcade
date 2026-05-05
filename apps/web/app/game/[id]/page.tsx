"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import {
  createShip,
  applyInput,
  tryShoot,
  updateBullets,
  detectCollisions,
  applyDamage,
  respawnShip,
  RESPAWN_DELAY_MS,
  ENERGY_PER_SHOT,
  type Ship,
  type Bullet,
  type InputState,
} from "@/lib/game/engine";

// ─── Renderer ────────────────────────────────────────────

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number) {
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 80; i++) {
    const x = (i * 137 + tick * 0.1 * (i % 3 + 1)) % w;
    const y = (i * 243 + tick * 0.05 * (i % 2 + 1)) % h;
    const size = i % 3 === 0 ? 1.5 : 0.8;
    ctx.globalAlpha = 0.3 + (Math.sin(tick * 0.02 + i) * 0.2);
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx: CanvasRenderingContext2D, ship: Ship, isLocal: boolean) {
  if (!ship.isAlive) return;

  ctx.save();
  ctx.translate(ship.pos.x, ship.pos.y);
  ctx.rotate(ship.rotation);

  // Glow
  ctx.shadowBlur = isLocal ? 15 : 8;
  ctx.shadowColor = ship.color;

  // Nave
  ctx.strokeStyle = ship.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(12, 12);
  ctx.lineTo(0, 6);
  ctx.lineTo(-12, 12);
  ctx.closePath();
  ctx.stroke();

  // Relleno sutil
  ctx.fillStyle = ship.color + "15";
  ctx.fill();

  // Motor (propulsión visual)
  if (isLocal) {
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(0, 18 + Math.random() * 6);
    ctx.lineTo(4, 12);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // Nombre sobre la nave
  ctx.fillStyle = ship.color + "80";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(ship.id.substring(0, 8), ship.pos.x, ship.pos.y - 22);
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet, color: string) {
  if (!bullet.isActive) return;

  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(bullet.pos.x, bullet.pos.y, 3, 0, Math.PI * 2);
  ctx.fill();

  // Estela
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(
    bullet.pos.x - bullet.velocity.x * 0.5,
    bullet.pos.y - bullet.velocity.y * 0.5,
    2, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
  const maxAge = 20;
  if (age > maxAge) return;

  const progress = age / maxAge;
  const radius = 5 + progress * 30;

  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = "#fbbf24";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#ef4444";
  ctx.lineWidth = 2 - progress * 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Fragmentos
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + progress * 2;
    const dist = radius * 0.8;
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(
      x + Math.cos(angle) * dist,
      y + Math.sin(angle) * dist,
      2 - progress * 2, 2 - progress * 2
    );
  }
  ctx.restore();
}

// ─── Tipos de red ────────────────────────────────────────

interface BroadcastPayload {
  type: "position" | "shoot" | "hit" | "respawn";
  playerId: string;
  data: any;
}

interface Explosion {
  x: number;
  y: number;
  age: number;
}

// ─── Componente principal ────────────────────────────────

export default function GamePage() {
  const { id: roomId } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Estado de juego
  const localShipRef = useRef<Ship | null>(null);
  const remoteShipsRef = useRef<Map<string, Ship>>(new Map());
  const bulletsRef = useRef<Bullet[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const killsRef = useRef(0);
  const tickRef = useRef(0);
  const channelRef = useRef<any>(null);
  const userIdRef = useRef<string>("");

  // Estado para el HUD (reactivo)
  const [hudHealth, setHudHealth] = useState(100);
  const [hudEnergy, setHudEnergy] = useState(100);
  const [hudScore, setHudScore] = useState(0);
  const [hudKills, setHudKills] = useState(0);
  const [playerName, setPlayerName] = useState("...");
  const [isAlive, setIsAlive] = useState(true);
  const [respawnTimer, setRespawnTimer] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    let broadcastInterval: NodeJS.Timeout;

    const initGame = async () => {
      // Auth check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      userIdRef.current = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (!profile?.username) { router.push("/dashboard"); return; }
      setPlayerName(profile.username);

      // Crear nave local
      const localShip = createShip(
        user.id,
        200 + Math.random() * 400,
        150 + Math.random() * 300,
        "#3b82f6"
      );
      localShipRef.current = localShip;

      // ─── RF-002 / RF-005: Configurar canal de Supabase Realtime ───
      const channel = supabase.channel(`game-${roomId}`, {
        config: { broadcast: { self: false } },
      });

      channel
        .on("broadcast", { event: "game-state" }, ({ payload }: { payload: BroadcastPayload }) => {
          if (payload.playerId === user.id) return;

          switch (payload.type) {
            case "position": {
              const ships = remoteShipsRef.current;
              const existing = ships.get(payload.playerId);
              if (existing) {
                // Interpolación suave (RF-002: movimiento suave de naves enemigas)
                existing.pos.x += (payload.data.x - existing.pos.x) * 0.3;
                existing.pos.y += (payload.data.y - existing.pos.y) * 0.3;
                existing.rotation += (payload.data.rotation - existing.rotation) * 0.3;
                existing.isAlive = payload.data.isAlive;
                existing.health = payload.data.health;
              } else {
                const remote = createShip(payload.playerId, payload.data.x, payload.data.y, "#ef4444");
                remote.rotation = payload.data.rotation;
                ships.set(payload.playerId, remote);
              }
              break;
            }
            case "shoot": {
              // RF-002: Renderizar proyectil del oponente
              bulletsRef.current.push({
                id: `${payload.playerId}-${Date.now()}`,
                ownerId: payload.playerId,
                pos: { x: payload.data.x, y: payload.data.y },
                velocity: { x: payload.data.vx, y: payload.data.vy },
                damage: payload.data.damage,
                createdAt: Date.now(),
                isActive: true,
              });
              break;
            }
            case "hit": {
              // RF-003: Efecto visual de impacto
              explosionsRef.current.push({
                x: payload.data.x,
                y: payload.data.y,
                age: 0,
              });
              break;
            }
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Broadcast de posición cada 50ms (~20 veces/seg para optimizar red)
      broadcastInterval = setInterval(() => {
        const ship = localShipRef.current;
        if (!ship || !channelRef.current) return;

        channelRef.current.send({
          type: "broadcast",
          event: "game-state",
          payload: {
            type: "position",
            playerId: user.id,
            data: {
              x: ship.pos.x,
              y: ship.pos.y,
              rotation: ship.rotation,
              isAlive: ship.isAlive,
              health: ship.health,
            },
          } satisfies BroadcastPayload,
        });
      }, 50);

      // ─── Game Loop (RNF-001: <50ms input, RNF-003: 60 FPS) ───
      const gameLoop = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const ship = localShipRef.current;
        if (!canvas || !ctx || !ship) {
          animationFrameId = requestAnimationFrame(gameLoop);
          return;
        }

        const now = Date.now();
        tickRef.current++;

        // ─── Input → Movimiento (RF-001: <50ms) ───
        const input: InputState = {
          up: !!keysRef.current["w"],
          down: !!keysRef.current["s"],
          left: !!keysRef.current["a"],
          right: !!keysRef.current["d"],
          shoot: !!keysRef.current[" "],
        };

        if (ship.isAlive) {
          localShipRef.current = applyInput(ship, input, canvas.width, canvas.height);
        }

        // ─── Disparos (RF-001: Client-side prediction) ───
        if (input.shoot && localShipRef.current!.isAlive) {
          const bullet = tryShoot(localShipRef.current!, now);
          if (bullet) {
            localShipRef.current!.lastShotTime = now;
            localShipRef.current!.energy -= ENERGY_PER_SHOT;
            bulletsRef.current.push(bullet);

            // RF-002: Broadcast del disparo
            channelRef.current?.send({
              type: "broadcast",
              event: "game-state",
              payload: {
                type: "shoot",
                playerId: user.id,
                data: {
                  x: bullet.pos.x, y: bullet.pos.y,
                  vx: bullet.velocity.x, vy: bullet.velocity.y,
                  damage: bullet.damage,
                },
              } satisfies BroadcastPayload,
            });
          }
        }

        // ─── Actualizar proyectiles ───
        bulletsRef.current = updateBullets(bulletsRef.current, now, canvas.width, canvas.height);

        // ─── RF-003: Colisiones ───
        const allShips = new Map(remoteShipsRef.current);
        allShips.set(user.id, localShipRef.current!);

        const hits = detectCollisions(bulletsRef.current, allShips);
        for (const hit of hits) {
          // Efecto visual
          const hitShip = allShips.get(hit.shipId);
          if (hitShip) {
            explosionsRef.current.push({ x: hitShip.pos.x, y: hitShip.pos.y, age: 0 });

            // Broadcast del impacto
            channelRef.current?.send({
              type: "broadcast",
              event: "game-state",
              payload: {
                type: "hit",
                playerId: user.id,
                data: { x: hitShip.pos.x, y: hitShip.pos.y, targetId: hit.shipId },
              } satisfies BroadcastPayload,
            });
          }

          if (hit.shipId === user.id) {
            // Daño a la nave local
            localShipRef.current = applyDamage(localShipRef.current!, hit.damage);
            if (!localShipRef.current!.isAlive) {
              setIsAlive(false);
              // Respawn automático
              setTimeout(() => {
                localShipRef.current = respawnShip(localShipRef.current!, canvas.width, canvas.height);
                setIsAlive(true);
              }, RESPAWN_DELAY_MS);
            }
          } else {
            // Daño a nave remota
            const remote = remoteShipsRef.current.get(hit.shipId);
            if (remote) {
              remoteShipsRef.current.set(hit.shipId, applyDamage(remote, hit.damage));
              // Sumar puntos
              localShipRef.current!.score += 10;
              if (!remoteShipsRef.current.get(hit.shipId)!.isAlive) {
                killsRef.current += 1;
                setHudKills(killsRef.current);
                localShipRef.current!.score += 50;
              }
            }
          }
        }

        // Actualizar explosiones
        explosionsRef.current = explosionsRef.current
          .map((e) => ({ ...e, age: e.age + 1 }))
          .filter((e) => e.age < 20);

        // ─── Actualizar HUD (reactivo) ───
        setHudHealth(localShipRef.current!.health);
        setHudEnergy(localShipRef.current!.energy);
        setHudScore(localShipRef.current!.score);

        // ─── RENDERIZADO ───
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fondo
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawStars(ctx, canvas.width, canvas.height, tickRef.current);

        // Grid sutil
        ctx.strokeStyle = "#ffffff08";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvas.width; x += 50) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        // Naves remotas
        for (const [, remote] of remoteShipsRef.current) {
          drawShip(ctx, remote, false);
        }

        // Nave local
        drawShip(ctx, localShipRef.current!, true);

        // Proyectiles
        for (const bullet of bulletsRef.current) {
          const owner = bullet.ownerId === user.id ? localShipRef.current! : remoteShipsRef.current.get(bullet.ownerId);
          drawBullet(ctx, bullet, owner?.color || "#ef4444");
        }

        // Explosiones
        for (const exp of explosionsRef.current) {
          drawExplosion(ctx, exp.x, exp.y, exp.age);
        }

        animationFrameId = requestAnimationFrame(gameLoop);
      };

      gameLoop();
    };

    initGame();

    // Controles
    const onKeyDown = async (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === "Escape") {
        // RF-004: Guardar progreso antes de salir
        if (localShipRef.current && localShipRef.current.score > 0) {
          await supabase.from("match_history").insert({
            player_id: userIdRef.current,
            room_id: roomId as string,
            score: localShipRef.current.score,
            kills: killsRef.current,
            xp_earned: localShipRef.current.score // 1 XP por cada 1 punto por ahora
          });
        }
        router.push("/lobby");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(animationFrameId);
      clearInterval(broadcastInterval);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [supabase, router, roomId]);

  // ─── UI / HUD ───

  return (
    <div className="min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center relative select-none">
      {/* HUD Superior Izquierdo */}
      <div className="absolute top-6 left-6 z-10 space-y-3 font-mono">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 border border-blue-500/30 rounded flex items-center justify-center font-black text-blue-400 text-lg">
            {playerName[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Pilot</p>
            <p className="text-sm font-black text-white tracking-tight uppercase">{playerName}</p>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <div>
            <p className="text-[9px] font-black text-blue-500/50 uppercase tracking-[0.15em]">Hull Integrity</p>
            <div className="w-44 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-150 rounded-full"
                style={{
                  width: `${hudHealth}%`,
                  backgroundColor: hudHealth > 50 ? "#3b82f6" : hudHealth > 25 ? "#f59e0b" : "#ef4444",
                  boxShadow: `0 0 10px ${hudHealth > 50 ? "#3b82f6" : "#ef4444"}`,
                }}
              />
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-purple-500/50 uppercase tracking-[0.15em]">Energy</p>
            <div className="w-44 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-150 rounded-full"
                style={{ width: `${hudEnergy}%`, boxShadow: "0 0 10px #a855f7" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* HUD Superior Derecho */}
      <div className="absolute top-6 right-6 z-10 text-right font-mono">
        <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Sector</p>
        <p className="text-base font-black text-white uppercase tracking-tight">{roomId}</p>
        <p className="text-[9px] font-bold text-green-500 animate-pulse mt-1 uppercase tracking-[0.15em]">Live Sync Active</p>
        
        <div className="mt-4 space-y-1">
          <p className="text-[9px] font-black text-gray-600 uppercase">Score</p>
          <p className="text-2xl font-black text-white">{hudScore.toLocaleString()}</p>
          <p className="text-[9px] text-gray-500">{hudKills} kills</p>
        </div>
      </div>

      {/* Pantalla de muerte */}
      {!isAlive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-900/20 backdrop-blur-sm">
          <div className="text-center">
            <h2 className="text-4xl font-black text-red-500 uppercase animate-pulse">Destruido</h2>
            <p className="text-gray-400 text-sm mt-2 uppercase tracking-widest">Re-spawn en progreso...</p>
          </div>
        </div>
      )}

      {/* Arena */}
      <canvas
        id="game-canvas"
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(59,130,246,0.1)] cursor-none"
      />

      {/* Controles */}
      <div className="absolute bottom-6 text-gray-600 text-[9px] font-black uppercase tracking-[0.2em] flex gap-8 font-mono">
        <span>[WASD] Movimiento</span>
        <span>[SPACE] Disparar</span>
        <span>[ESC] Retirada</span>
      </div>
    </div>
  );
}
