"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function LobbyPage() {
  const [user, setUser] = useState<any>(null);
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
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (!profileData?.username) {
        router.push("/dashboard"); // Obligar a tener username
        return;
      }
      setProfile(profileData);
      setLoading(false);

      // --- CONFIGURACIÓN DE SUPABASE REALTIME PRESENCE ---
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
              online_at: new Error().stack, // Just a timestamp trick
            });
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    initLobby();
  }, [supabase, router]);

  const toggleSearch = async () => {
    if (!user) return;
    setIsSearching(true);

    try {
      // RF-005: Buscar sala disponible (status='waiting' y < 4 jugadores)
      const { data: existingRooms, error: searchError } = await supabase
        .from("rooms")
        .select("*")
        .eq("status", "waiting")
        .lt("current_players", 4)
        .limit(1);

      if (searchError) throw searchError;

      if (existingRooms && existingRooms.length > 0) {
        const room = existingRooms[0];
        // Unirse a sala existente
        await supabase
          .from("rooms")
          .update({ current_players: room.current_players + 1 })
          .eq("id", room.id);
        
        router.push(`/game/${room.id}`);
      } else {
        // Crear nueva sala
        const { data: newRoom, error: createError } = await supabase
          .from("rooms")
          .insert({
            name: `Sector-${Math.floor(Math.random() * 1000)}`,
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
      alert("Error al buscar partida. Inténtalo de nuevo.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-blue-500 font-black text-2xl animate-pulse uppercase tracking-tighter">
          Cargando Lobby...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter">
              Global <span className="text-blue-500">Lobby</span>
            </h1>
            <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest">
              Jugadores en línea: {onlinePlayers.length}
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
            <div className="text-right px-4 border-r border-white/10">
               <p className="text-[10px] font-bold text-gray-500 uppercase">Tu Rango</p>
               <p className="text-sm font-black text-blue-400 uppercase">Novato Lvl {profile?.level}</p>
            </div>
            <button 
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 hover:bg-white/5 rounded-xl transition-all text-xs font-bold uppercase text-gray-400"
            >
              Perfil
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lista de Jugadores */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1 mb-4">
              Jugadores en el Servidor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {onlinePlayers.map((player: any, idx) => (
                <div 
                  key={idx}
                  className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between group hover:bg-blue-500/5 hover:border-blue-500/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-lg flex items-center justify-center font-bold text-blue-400 border border-blue-500/20">
                      {player.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{player.username}</p>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-tighter">
                        Lvl {player.level} • {player.status || 'En el lobby'}
                      </p>
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                </div>
              ))}
            </div>
          </div>

          {/* Menú de Acción */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-b from-blue-600/10 to-transparent border border-blue-500/20 p-8 rounded-3xl sticky top-8">
              <h3 className="text-xl font-black uppercase mb-2 tracking-tighter">Buscador de Combate</h3>
              <p className="text-gray-400 text-xs mb-8 uppercase leading-relaxed tracking-widest">
                El sistema te emparejará con un piloto de nivel similar.
              </p>

              <button 
                onClick={toggleSearch}
                className={`w-full py-6 rounded-2xl font-black text-lg transition-all duration-300 transform active:scale-95 flex flex-col items-center justify-center gap-1 ${
                  isSearching 
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                  : 'bg-white text-black hover:bg-blue-500 hover:text-white shadow-xl shadow-blue-500/10'
                }`}
              >
                {isSearching ? (
                  <>
                    <span>CANCELAR BÚSQUEDA</span>
                    <span className="text-[10px] animate-pulse">BUSCANDO OPONENTE...</span>
                  </>
                ) : (
                  <span>BUSCAR PARTIDA</span>
                )}
              </button>

              <div className="mt-8 space-y-4 pt-8 border-t border-white/5">
                 <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                    <span>Ping del Servidor</span>
                    <span className="text-green-400">24ms</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-black uppercase text-gray-500">
                    <span>Región</span>
                    <span className="text-white">Latam-East</span>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
