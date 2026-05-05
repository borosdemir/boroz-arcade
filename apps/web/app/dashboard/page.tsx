import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import React from "react";
import UsernameSetup from "@/components/dashboard/username-setup";
import Link from "next/link";

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

  const xpForNextLevel = 100;
  const currentXp = profile?.xp || 0;
  const xpProgress = (currentXp % xpForNextLevel) / xpForNextLevel * 100;

  return (
    <div className="min-h-screen bg-background">
      {showUsernameSetup && <UsernameSetup userId={user.id} />}
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-foreground">Boroz Arcade</span>
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full" />
            <span className="text-sm text-foreground-muted">Online</span>
          </div>
          <form action="/auth/signout" method="post">
            <button 
              type="submit"
              className="px-4 py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              Cerrar sesion
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Card */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center text-2xl font-bold text-primary-foreground shrink-0">
              {profile?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">
                {profile?.username || "Sin nombre"}
              </h1>
              <p className="text-sm text-foreground-muted truncate">{user.email}</p>
              
              {/* Level Progress */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">Nivel {profile?.level || 1}</span>
                  <span className="text-foreground-muted">{currentXp} XP</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${xpProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{profile?.level || 1}</p>
            <p className="text-sm text-foreground-muted">Nivel</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{currentXp}</p>
            <p className="text-sm text-foreground-muted">XP Total</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">0</p>
            <p className="text-sm text-foreground-muted">Partidas</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link 
            href="/lobby"
            className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Jugar ahora
          </Link>
          
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="font-medium text-foreground mb-2">Proximos pasos</h3>
            <p className="text-sm text-foreground-muted">
              Entra al lobby para buscar una partida o unirte a una sala existente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
