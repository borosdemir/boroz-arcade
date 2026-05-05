"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function UsernameSetup({ userId }: { userId: string }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from("profiles")
      .update({ username })
      .eq("id", userId);

    if (error) {
      setError(error.message);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border p-6 rounded-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">Elige tu nombre</h2>
          <p className="text-sm text-foreground-muted mt-1">
            Este nombre se mostrara a otros jugadores
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Tu nombre de jugador"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-foreground-subtle focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-xs text-foreground-muted mt-2">
              Entre 3 y 20 caracteres
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 bg-destructive-muted border border-destructive/20 text-destructive text-sm rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || username.length < 3}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
