-- 1. Crear tabla de Perfiles (Metajuego)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  username text unique,
  avatar_url text,
  level integer default 1,
  xp integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Activar Seguridad a Nivel de Fila (Row Level Security - RLS)
alter table public.profiles enable row level security;

-- 3. Crear Políticas de Seguridad
-- Cualquiera puede ver los perfiles (para los Leaderboards)
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

-- Los usuarios solo pueden actualizar su propio perfil
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 4. Crear un Trigger Automático
-- Esta función se dispara cuando alguien se registra en la página de Login
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

-- Vincular el Trigger a la tabla de autenticación de Supabase
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
