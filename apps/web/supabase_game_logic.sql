-- 1. Tabla de Salas para Matchmaking (RF-005)
create table public.rooms (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  max_players integer default 4,
  current_players integer default 0
);

-- 2. Tabla de Historial de Partidas y XP (RF-004)
create table public.match_history (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.profiles(id) on delete cascade not null,
  room_id uuid references public.rooms(id) on delete set null,
  score integer default 0,
  kills integer default 0,
  xp_earned integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Habilitar RLS
alter table public.rooms enable row level security;
alter table public.match_history enable row level security;

-- 4. Políticas para Rooms (Cualquiera puede ver y crear salas para el matchmaking)
create policy "Rooms are viewable by everyone." on public.rooms for select using (true);
create policy "Authenticated users can create rooms." on public.rooms for insert with check (auth.role() = 'authenticated');
create policy "Update room player count." on public.rooms for update using (true);

-- 5. Políticas para Match History
create policy "Users can view their own match history." on public.match_history for select using (auth.uid() = player_id);
create policy "Service role can insert match history." on public.match_history for insert with check (true); -- En producción esto debería ser más restrictivo o vía RPC

-- 6. Función para actualizar XP en el perfil automáticamente (RF-004)
create function public.update_profile_xp()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.profiles
  set 
    xp = xp + new.xp_earned,
    level = floor((xp + new.xp_earned) / 1000) + 1 -- Subida de nivel cada 1000 XP
  where id = new.player_id;
  return new;
end;
$$;

create trigger on_match_finished
  after insert on public.match_history
  for each row execute procedure public.update_profile_xp();
