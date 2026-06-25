-- Plantilla base para endurecer el acceso de supervisor en Supabase.
-- Revisar y adaptar antes de ejecutar en produccion.

create or replace function public.is_supervisor()
returns boolean
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role' = 'supervisor',
    false
  );
$$;

alter table public.stock_snapshots enable row level security;

drop policy if exists "supervisor select stock_snapshots" on public.stock_snapshots;

create policy "supervisor select stock_snapshots"
on public.stock_snapshots
for select
to authenticated
using (public.is_supervisor());

-- IMPORTANTE:
-- `inventario` sigue siendo usado por el flujo operativo anon.
-- No cerrar `select` ni `update` aca hasta mover las lecturas del supervisor
-- a RPCs o endpoints dedicados.

-- Siguiente paso sugerido:
-- crear funciones dedicadas para supervisor y validarlas con `public.is_supervisor()`.
