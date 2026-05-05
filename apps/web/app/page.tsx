"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, [supabase]);

  const handleEnter = () => {
    if (user) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">B</span>
          </div>
          <span className="font-semibold text-foreground">Boroz Arcade</span>
        </div>
        
        {!loading && (
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-foreground-muted">{user.email}</span>
                <button 
                  onClick={() => router.push("/dashboard")}
                  className="px-4 py-2 bg-surface text-foreground text-sm font-medium rounded-lg border border-border hover:bg-surface-elevated transition-colors"
                >
                  Dashboard
                </button>
              </>
            ) : (
              <button 
                onClick={() => router.push("/login")}
                className="px-4 py-2 bg-surface text-foreground text-sm font-medium rounded-lg border border-border hover:bg-surface-elevated transition-colors"
              >
                Iniciar sesion
              </button>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground tracking-tight text-balance">
              Juega. Compite. Diviertete.
            </h1>
            <p className="text-lg md:text-xl text-foreground-muted max-w-md mx-auto text-pretty">
              Tu arcade online. Partidas rapidas, multijugador en tiempo real, sin complicaciones.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button 
              onClick={handleEnter}
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              {user ? "Ir al Dashboard" : "Empezar a jugar"}
            </button>
            <button 
              onClick={() => router.push("/lobby")}
              className="w-full sm:w-auto px-8 py-4 bg-surface text-foreground font-semibold rounded-xl border border-border hover:bg-surface-elevated transition-colors"
            >
              Ver partidas
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 pt-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">1v1</p>
              <p className="text-sm text-foreground-muted">Batallas</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">60fps</p>
              <p className="text-sm text-foreground-muted">Suave</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">Real-time</p>
              <p className="text-sm text-foreground-muted">Sync</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-border">
        <div className="flex items-center justify-between text-sm text-foreground-muted">
          <span>Boroz Arcade 2026</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-accent rounded-full" />
            <span>Servidores online</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
