import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import React from "react";
import UsernameSetup from "@/components/dashboard/username-setup";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const showUsernameSetup = !profile?.username;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-sans">
      {showUsernameSetup && <UsernameSetup userId={user.id} />}
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">
              Player <span className="text-blue-500 underline">Dashboard</span>
            </h1>
            <p className="text-gray-500 text-xs mt-1">Boroz Arcade OS v1.0.4</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-500 uppercase">Estado</p>
            <p className="text-green-400 text-sm animate-pulse">● En Línea</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tarjeta de Perfil */}
          <div className="md:col-span-1 bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm shadow-xl">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 mx-auto flex items-center justify-center text-4xl font-black shadow-lg shadow-blue-500/20">
              {profile?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <h2 className="text-xl font-bold text-center mb-1">
              {profile?.username || "Sin Nombre"}
            </h2>
            <p className="text-gray-500 text-xs text-center mb-6">{user.email}</p>
            
            <div className="space-y-4">
               <div>
                  <div className="flex justify-between text-xs font-bold mb-1 uppercase text-gray-400">
                    <span>Nivel {profile?.level || 1}</span>
                    <span>{profile?.xp || 0} XP</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-1000" 
                      style={{ width: `${Math.min((profile?.xp || 0) % 100, 100)}%` }}
                    />
                  </div>
               </div>
            </div>
          </div>

          {/* Estadísticas / Acciones */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 border border-white/10 p-8 rounded-2xl">
              <h3 className="text-lg font-black uppercase mb-4 tracking-tight">Misiones Disponibles</h3>
              <div className="space-y-4 text-sm text-gray-400 italic">
                <p>No hay misiones activas. ¡Elige un juego en el Lobby para empezar!</p>
              </div>
            </div>

            <div className="flex gap-4">
              <a 
                href="/lobby"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-center"
              >
                ENTRAR AL LOBBY
              </a>
              <form action="/auth/signout" method="post" className="flex-none">
                <button 
                  type="submit"
                  className="px-6 py-4 border border-white/10 hover:bg-red-500/10 hover:text-red-400 text-gray-500 rounded-xl transition-all"
                >
                  Cerrar Sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
