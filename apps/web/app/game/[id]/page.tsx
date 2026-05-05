"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

// Renderer functions
function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, tick: number) {
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 60; i++) {
    const x = (i * 137 + tick * 0.05 * (i % 3 + 1)) % w;
    const y = (i * 243 + tick * 0.025 * (i % 2 + 1)) % h;
    const size = i % 4 === 0 ? 1.5 : 0.5;
    ctx.globalAlpha = 0.2 + (Math.sin(tick * 0.01 + i) * 0.1);
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx: CanvasRenderingContext2D, ship: Ship, isLocal: boolean) {
  if (!ship.isAlive) return;

  ctx.save();
  ctx.translate(ship.pos.x, ship.pos.y);
  ctx.rotate(ship.rotation);

  // Ship body
  ctx.strokeStyle = isLocal ? "#00d4ff" : "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(10, 10);
  ctx.lineTo(0, 5);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.stroke();

  // Fill
  ctx.fillStyle = isLocal ? "#00d4ff15" : "#ef444415";
  ctx.fill();

  // Engine glow for local
  if (isLocal) {
    ctx.fillStyle = "#00d4ff";
    ctx.beginPath();
    ctx.moveTo(-3, 10);
    ctx.lineTo(0, 14 + Math.random() * 4);
    ctx.lineTo(3, 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  // Name tag
  ctx.fillStyle = "#ffffff60";
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(ship.id.substring(0, 6), ship.pos.x, ship.pos.y - 18);
}

function drawBullet(ctx: CanvasRenderingContext2D, bullet: Bullet, isLocal: boolean) {
  if (!bullet.isActive) return;

  ctx.save();
  ctx.fillStyle = isLocal ? "#00d4ff" : "#ef4444";
  ctx.beginPath();
  ctx.arc(bullet.pos.x, bullet.pos.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
  const maxAge = 15;
  if (age > maxAge) return;

  const progress = age / maxAge;
  const radius = 5 + progress * 25;

  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2 - progress * 1.5;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

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

export default function GamePage() {
  const { id: roomId } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const localShipRef = useRef<Ship | null>(null);
  const remoteShipsRef = useRef<Map<string, Ship>>(new Map());
  const bulletsRef = useRef<Bullet[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const killsRef = useRef(0);
  const tickRef = useRef(0);
  const channelRef = useRef<any>(null);
  const userIdRef = useRef<string>("");

  const [hudHealth, setHudHealth] = useState(100);
  const [hudEnergy, setHudEnergy] = useState(100);
  const [hudScore, setHudScore] = useState(0);
  const [hudKills, setHudKills] = useState(0);
  const [playerName, setPlayerName] = useState("...");
  const [isAlive, setIsAlive] = useState(true);

  useEffect(() => {
    let animationFrameId: number;
    let broadcastInterval: NodeJS.Timeout;

    const initGame = async () => {
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

      const localShip = createShip(
        user.id,
        200 + Math.random() * 400,
        150 + Math.random() * 300,
        "#00d4ff"
      );
      localShipRef.current = localShip;

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

        if (input.shoot && localShipRef.current!.isAlive) {
          const bullet = tryShoot(localShipRef.current!, now);
          if (bullet) {
            localShipRef.current!.lastShotTime = now;
            localShipRef.current!.energy -= ENERGY_PER_SHOT;
            bulletsRef.current.push(bullet);

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

        bulletsRef.current = updateBullets(bulletsRef.current, now, canvas.width, canvas.height);

        const allShips = new Map(remoteShipsRef.current);
        allShips.set(user.id, localShipRef.current!);

        const hits = detectCollisions(bulletsRef.current, allShips);
        for (const hit of hits) {
          const hitShip = allShips.get(hit.shipId);
          if (hitShip) {
            explosionsRef.current.push({ x: hitShip.pos.x, y: hitShip.pos.y, age: 0 });

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
            localShipRef.current = applyDamage(localShipRef.current!, hit.damage);
            if (!localShipRef.current!.isAlive) {
              setIsAlive(false);
              setTimeout(() => {
                localShipRef.current = respawnShip(localShipRef.current!, canvas.width, canvas.height);
                setIsAlive(true);
              }, RESPAWN_DELAY_MS);
            }
          } else {
            const remote = remoteShipsRef.current.get(hit.shipId);
            if (remote) {
              remoteShipsRef.current.set(hit.shipId, applyDamage(remote, hit.damage));
              localShipRef.current!.score += 10;
              if (!remoteShipsRef.current.get(hit.shipId)!.isAlive) {
                killsRef.current += 1;
                setHudKills(killsRef.current);
                localShipRef.current!.score += 50;
              }
            }
          }
        }

        explosionsRef.current = explosionsRef.current
          .map((e) => ({ ...e, age: e.age + 1 }))
          .filter((e) => e.age < 15);

        setHudHealth(localShipRef.current!.health);
        setHudEnergy(localShipRef.current!.energy);
        setHudScore(localShipRef.current!.score);

        // Render
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawStars(ctx, canvas.width, canvas.height, tickRef.current);

        // Grid
        ctx.strokeStyle = "#ffffff08";
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }

        for (const [, remote] of remoteShipsRef.current) {
          drawShip(ctx, remote, false);
        }

        drawShip(ctx, localShipRef.current!, true);

        for (const bullet of bulletsRef.current) {
          const isLocal = bullet.ownerId === user.id;
          drawBullet(ctx, bullet, isLocal);
        }

        for (const exp of explosionsRef.current) {
          drawExplosion(ctx, exp.x, exp.y, exp.age);
        }

        animationFrameId = requestAnimationFrame(gameLoop);
      };

      gameLoop();
    };

    initGame();

    const onKeyDown = async (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.key === "Escape") {
        if (localShipRef.current && localShipRef.current.score > 0) {
          await supabase.from("match_history").insert({
            player_id: userIdRef.current,
            room_id: roomId as string,
            score: localShipRef.current.score,
            kills: killsRef.current,
            xp_earned: localShipRef.current.score
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

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <Link href="/lobby" className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            <span className="text-sm">Salir</span>
          </Link>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm text-foreground-muted font-mono">{roomId}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-foreground-muted">Score</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{hudScore}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-right">
            <p className="text-xs text-foreground-muted">Kills</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{hudKills}</p>
          </div>
        </div>
      </header>

      {/* Game Area */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {/* HUD Left */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 space-y-3 z-10">
          <div className="bg-surface/80 backdrop-blur border border-border rounded-lg p-3 w-32">
            <p className="text-xs text-foreground-muted mb-1">HP</p>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${hudHealth}%`,
                  backgroundColor: hudHealth > 50 ? "#00d4ff" : hudHealth > 25 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <p className="text-xs text-foreground-muted mt-1 tabular-nums">{hudHealth}%</p>
          </div>
          <div className="bg-surface/80 backdrop-blur border border-border rounded-lg p-3 w-32">
            <p className="text-xs text-foreground-muted mb-1">Energy</p>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-150"
                style={{ width: `${hudEnergy}%` }}
              />
            </div>
            <p className="text-xs text-foreground-muted mt-1 tabular-nums">{Math.round(hudEnergy)}%</p>
          </div>
        </div>

        {/* Death Screen */}
        {!isAlive && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-destructive mb-2">Destruido</h2>
              <p className="text-foreground-muted">Respawning...</p>
            </div>
          </div>
        )}

        {/* Canvas */}
        <canvas
          id="game-canvas"
          ref={canvasRef}
          width={800}
          height={500}
          className="border border-border rounded-xl cursor-crosshair"
        />
      </div>

      {/* Footer Controls */}
      <footer className="px-4 py-3 border-t border-border">
        <div className="flex items-center justify-center gap-6 text-xs text-foreground-muted">
          <span><kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono mr-1">WASD</kbd> Move</span>
          <span><kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono mr-1">SPACE</kbd> Shoot</span>
          <span><kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono mr-1">ESC</kbd> Exit</span>
        </div>
      </footer>
    </div>
  );
}
