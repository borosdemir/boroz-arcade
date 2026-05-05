# 🕹️ Boroz Arcade — Real-Time Multiplayer Platform

Plataforma de juegos multijugador en tiempo real construida con un enfoque de ingeniería de alto rendimiento y escalabilidad. Diseñada para ofrecer una experiencia arcade fluida directamente en el navegador.

---

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router) + TypeScript.
- **Estilos:** Tailwind CSS v4 (Nativo, alto rendimiento).
- **Backend:** Supabase (Auth, Realtime Presence, Broadcast, PostgreSQL).
- **Arquitectura:** Monorepo con Turborepo para gestión de paquetes.
- **Testing:** Jest (Unitario) + Cypress (E2E) con enfoque Test-Driven (TDD).

---

## 🚀 Características Implementadas

### 1. Gestión de Identidad y Sesión
- **Auth Seguro:** Integración completa con Supabase Auth.
- **Middleware de Protección:** Rutas privadas protegidas a nivel de servidor.
- **Perfil de Jugador:** Sistema de "Username obligatorio" con triggers en base de datos para la creación automática de perfiles.

### 2. Global Lobby (Real-Time)
- **Presence:** Visualización en tiempo real de jugadores conectados.
- **Matchmaking Real:** Sistema basado en salas (`rooms`) que empareja jugadores y crea instancias de juego dinámicas.

### 3. Space Shooter (Combat Arena)
- **Motor de Juego Puro:** Lógica de física y colisiones escrita en TypeScript plano, 100% testeable sin dependencias de UI.
- **Sync de Baja Latencia:** Uso de Supabase Broadcast para sincronizar posiciones y disparos a 60 FPS.
- **Client-Side Prediction:** Los disparos son instantáneos en el cliente local para eliminar la sensación de lag.
- **Metajuego:** Persistencia de XP y puntuaciones en el historial de partidas.

---

## ⚙️ Ingeniería de Código

### Enfoque de Calidad (Test-First)
El proyecto cuenta con una suite de **27 tests** que validan el núcleo del simulador de combate antes de renderizar un solo píxel.

```bash
# Ejecutar tests unitarios (Motor de física, colisiones, lógica)
npm run test

# Ejecutar tests E2E (Flujos de usuario, matchmaking, arena)
npm run cypress:run
```

### Arquitectura Realtime
Implementamos una arquitectura de eventos distribuida:
- **Presence:** Para el estado "Online" de los jugadores.
- **Broadcast:** Para el estado efímero del combate (Posiciones, Láseres).
- **DB Changes:** Para el estado persistente (Niveles, Leaderboards).

---

## 🛠️ Instalación y Uso

1. **Clonar y dependencias:**
   ```bash
   git clone https://github.com/tu-usuario/boroz-arcade.git
   npm install
   ```

2. **Variables de Entorno:**
   Configura tu `.env.local` con las credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_key
   ```

3. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

---

## 🗺️ Roadmap

- [x] Fase 1: Identidad y Cimientos.
- [x] Fase 2: Lobby y Presencia Realtime.
- [x] Fase 3: Space Shooter (Arena de combate).
- [ ] Fase 4: Leaderboard Global y Sistema de Logros.
- [ ] Fase 5: Optimización de red (WebWorkers).

---

**Desarrollado con ❤️ para la comunidad arcade por Daniel Cárdenas.**
