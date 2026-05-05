"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function LobbyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const initLobby = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (!profileData?.username) {
        router.push("/dashboard");
        return;
      }
      setProfile(profileData);
      setLoading(false);

      // Supabase Realtime Presence
      const channel = supabase.channel("lobby-players", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const players = Object.values(state).flat();
          setOnlinePlayers(players);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({
              user_id: user.id,
              username: profileData.username,
              level: profileData.level,
              status: "idle",
            });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initLobby();
  }, [supabase, router]);

  const handleSearch = async () => {
    if (isSearching) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const { data: existingRooms, error: searchError } = await supabase
        .from("rooms")
        .select("*")
        .eq("status", "waiting")
        .lt("current_players", 4)
        .limit(1);

      if (searchError) throw searchError;

      if (existingRooms && existingRooms.length > 0) {
        const room = existingRooms[0];
        await supabase
          .from("rooms")
          .update({ current_players: room.current_players + 1 })
          .eq("id", room.id);
        
        router.push(`/game/${room.id}`);
      } else {
        const { data: newRoom, error: createError } = await supabase
          .from("rooms")
          .insert({
            name: `Room-${Math.floor(Math.random() * 1000)}`,
            status: "waiting",
            current_players: 1,
            max_players: 4
          })
          .select()
          .single();

        if (createError) throw createError;
        router.push(`/game/${newRoom.id}`);
      }
    } catch (err) {
      console.error("Matchmaking error:", err);
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground-muted">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-foreground">Boroz Arcade</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg">
            <span className="w-2 h-2 bg-accent rounded-full" />
            <span className="text-sm text-foreground-muted">{onlinePlayers.length} online</span>
          </div>
          <Link 
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-xs font-bold text-primary-foreground">
              {profile?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-foreground">{profile?.username}</span>
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Action */}
          <div className="lg:col-span-2">
            <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2">Buscar partida</h1>
              <p className="text-foreground-muted mb-6">
                El matchmaking te emparejara con jugadores de nivel similar.
              </p>
              
              <button 
                onClick={handleSearch}
                className={`w-full py-4 font-semibold rounded-xl transition-all ${
                  isSearching 
                    ? 'bg-destructive text-white' 
                    : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                {isSearching ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Buscando partida... Clic para cancelar
                  </span>
                ) : (
                  'Buscar partida'
                )}
              </button>
            </div>

            {/* Players Online */}
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h2 className="font-semibold text-foreground mb-4">Jugadores en el lobby</h2>
              
              {onlinePlayers.length === 0 ? (
                <p className="text-foreground-muted text-sm py-4 text-center">
                  No hay otros jugadores en el lobby
                </p>
              ) : (
                <div className="space-y-2">
                  {onlinePlayers.map((player: any, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 bg-background rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center font-semibold text-primary">
                          {player.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{player.username}</p>
                          <p className="text-xs text-foreground-muted">Nivel {player.level || 1}</p>
                        </div>
                      </div>
                      <span className="w-2 h-2 bg-accent rounded-full" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Tu perfil</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-muted">Nivel</span>
                  <span className="text-sm font-medium text-foreground">{profile?.level || 1}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-muted">XP</span>
                  <span className="text-sm font-medium text-foreground">{profile?.xp || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-4">Servidor</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-muted">Region</span>
                  <span className="text-sm font-medium text-foreground">Auto</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground-muted">Estado</span>
                  <span className="text-sm font-medium text-accent">Online</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-2">Controles</h3>
              <div className="space-y-2 text-sm text-foreground-muted">
                <p><kbd className="px-2 py-1 bg-background rounded text-xs font-mono">WASD</kbd> Movimiento</p>
                <p><kbd className="px-2 py-1 bg-background rounded text-xs font-mono">SPACE</kbd> Disparar</p>
                <p><kbd className="px-2 py-1 bg-background rounded text-xs font-mono">ESC</kbd> Salir</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
