-- Stock Barra v0.4.0 - Administracion de empleados, categorias y productos
-- Ejecutar en Supabase SQL Editor DESPUES de hardening-v0.3.4.sql
-- y ANTES de publicar el frontend v0.4.0 (el desplegable de empleados lee la tabla nueva).
--
-- Que hace:
-- 1. Crea la tabla `empleados` (antes estaban fijos en js/config.js) con los 5 actuales.
--    anon/authenticated solo pueden leerla.
-- 2. Crea RPCs de administracion SECURITY DEFINER:
--    - Las puede ejecutar solo `authenticated`; anon no (se revoca explicitamente,
--      porque Supabase le da EXECUTE a anon por defecto).
--    - Cada una exige is_supervisor() (app_metadata.role = "supervisor"). Hoy: 1 cuenta.
--    - Pueden modificar: empleados, categorias, productos. Al borrar un producto,
--      las FK existentes (ON DELETE CASCADE, verificado 2026-11-16) borran tambien
--      sus filas de inventario y stock_snapshots.
--    - No se puede borrar una categoria con productos (la FK productos_categoria_id_fkey
--      no tiene cascade; ademas la RPC lo valida con un mensaje claro).
-- 3. Alinea las secuencias de ids con el maximo actual (por si hubo inserts con id manual).

-- =====================================================
-- 1. Tabla empleados
-- =====================================================

create table if not exists public.empleados (
  id serial primary key,
  nombre text not null unique check (char_length(trim(nombre)) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.empleados enable row level security;

drop policy if exists "app select empleados" on public.empleados;
create policy "app select empleados"
on public.empleados
for select
to anon, authenticated
using (true);

revoke insert, update, delete, truncate on public.empleados from anon, authenticated;

insert into public.empleados (nombre)
values ('Karen'), ('Eve'), ('Nicolas'), ('Luciano'), ('Fiorella')
on conflict (nombre) do nothing;

-- =====================================================
-- 2. Secuencias alineadas
-- =====================================================

select setval(pg_get_serial_sequence('public.categorias', 'id'), coalesce((select max(id) from public.categorias), 1));
select setval(pg_get_serial_sequence('public.productos', 'id'), coalesce((select max(id) from public.productos), 1));

-- =====================================================
-- 3. Helpers internos
-- =====================================================

create or replace function public.admin_exigir_supervisor()
returns void
language plpgsql
stable
as $$
begin
  if not public.is_supervisor() then
    raise exception 'Solo el supervisor puede hacer cambios de administracion.'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.admin_nombre_limpio(valor text, maximo integer)
returns text
language plpgsql
immutable
as $$
declare
  limpio text := regexp_replace(trim(coalesce(valor, '')), '\s+', ' ', 'g');
begin
  if limpio = '' then
    raise exception 'El nombre no puede estar vacio.' using errcode = '22023';
  end if;

  if char_length(limpio) > maximo then
    raise exception 'El nombre no puede superar % caracteres.', maximo using errcode = '22023';
  end if;

  return limpio;
end;
$$;

revoke all on function public.admin_exigir_supervisor() from public, anon, authenticated;
revoke all on function public.admin_nombre_limpio(text, integer) from public, anon, authenticated;

-- =====================================================
-- 4. Empleados
-- =====================================================

create or replace function public.admin_agregar_empleado(nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limpio text;
  nuevo public.empleados;
begin
  perform public.admin_exigir_supervisor();
  limpio := public.admin_nombre_limpio(nombre, 40);

  if exists (
    select 1 from public.empleados e
    where public.normalizar_texto_stock(e.nombre) = public.normalizar_texto_stock(limpio)
  ) then
    raise exception 'Ya existe un empleado llamado %.', limpio using errcode = '23505';
  end if;

  insert into public.empleados (nombre) values (limpio) returning * into nuevo;

  return jsonb_build_object('id', nuevo.id, 'nombre', nuevo.nombre);
end;
$$;

create or replace function public.admin_eliminar_empleado(empleado_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  borrado public.empleados;
begin
  perform public.admin_exigir_supervisor();

  delete from public.empleados where id = empleado_id returning * into borrado;

  if borrado.id is null then
    raise exception 'El empleado ya no existe.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', borrado.id, 'nombre', borrado.nombre);
end;
$$;

-- =====================================================
-- 5. Categorias
-- =====================================================

create or replace function public.admin_agregar_categoria(nombre text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limpio text;
  nueva public.categorias;
begin
  perform public.admin_exigir_supervisor();
  limpio := public.admin_nombre_limpio(nombre, 60);

  if exists (
    select 1 from public.categorias c
    where public.normalizar_texto_stock(c.nombre) = public.normalizar_texto_stock(limpio)
  ) then
    raise exception 'Ya existe una categoria llamada %.', limpio using errcode = '23505';
  end if;

  insert into public.categorias (nombre) values (limpio) returning * into nueva;

  return jsonb_build_object('id', nueva.id, 'nombre', nueva.nombre);
end;
$$;

create or replace function public.admin_eliminar_categoria(categoria_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cantidad_productos integer;
  borrada public.categorias;
begin
  perform public.admin_exigir_supervisor();

  select count(*) into cantidad_productos
  from public.productos p
  where p.categoria_id = admin_eliminar_categoria.categoria_id;

  if cantidad_productos > 0 then
    raise exception 'La categoria tiene % producto(s). Borralos primero.', cantidad_productos
      using errcode = '23503';
  end if;

  delete from public.categorias c
  where c.id = admin_eliminar_categoria.categoria_id
  returning * into borrada;

  if borrada.id is null then
    raise exception 'La categoria ya no existe.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', borrada.id, 'nombre', borrada.nombre);
end;
$$;

-- =====================================================
-- 6. Productos
-- =====================================================

create or replace function public.admin_agregar_producto(nombre text, categoria_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  limpio text;
  nuevo_orden integer;
  nuevo public.productos;
begin
  perform public.admin_exigir_supervisor();
  limpio := public.admin_nombre_limpio(nombre, 80);

  if not exists (
    select 1 from public.categorias c where c.id = admin_agregar_producto.categoria_id
  ) then
    raise exception 'La categoria elegida no existe.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.productos p
    where public.normalizar_texto_stock(p.nombre) = public.normalizar_texto_stock(limpio)
  ) then
    raise exception 'Ya existe un producto llamado %.', limpio using errcode = '23505';
  end if;

  -- Al final de su categoria. Si la categoria no usa `orden` (todo null), queda null.
  select max(p.orden) + 1 into nuevo_orden
  from public.productos p
  where p.categoria_id = admin_agregar_producto.categoria_id;

  insert into public.productos (nombre, categoria_id, orden)
  values (limpio, admin_agregar_producto.categoria_id, nuevo_orden)
  returning * into nuevo;

  return jsonb_build_object(
    'id', nuevo.id,
    'nombre', nuevo.nombre,
    'categoria_id', nuevo.categoria_id,
    'orden', nuevo.orden
  );
end;
$$;

create or replace function public.admin_eliminar_producto(producto_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  unidades integer;
  filas_snapshot integer;
  borrado public.productos;
begin
  perform public.admin_exigir_supervisor();

  select coalesce(sum(i.cantidad), 0) into unidades
  from public.inventario i
  where i.producto_id = admin_eliminar_producto.producto_id;

  select count(*) into filas_snapshot
  from public.stock_snapshots s
  where s.producto_id = admin_eliminar_producto.producto_id;

  -- ON DELETE CASCADE borra inventario y stock_snapshots del producto.
  delete from public.productos p
  where p.id = admin_eliminar_producto.producto_id
  returning * into borrado;

  if borrado.id is null then
    raise exception 'El producto ya no existe.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', borrado.id,
    'nombre', borrado.nombre,
    'unidades_borradas', unidades,
    'filas_snapshot_borradas', filas_snapshot
  );
end;
$$;

-- =====================================================
-- 7. Permisos: solo authenticated (y adentro, solo supervisor)
-- =====================================================

revoke all on function public.admin_agregar_empleado(text) from public, anon;
revoke all on function public.admin_eliminar_empleado(integer) from public, anon;
revoke all on function public.admin_agregar_categoria(text) from public, anon;
revoke all on function public.admin_eliminar_categoria(integer) from public, anon;
revoke all on function public.admin_agregar_producto(text, integer) from public, anon;
revoke all on function public.admin_eliminar_producto(integer) from public, anon;

grant execute on function public.admin_agregar_empleado(text) to authenticated;
grant execute on function public.admin_eliminar_empleado(integer) to authenticated;
grant execute on function public.admin_agregar_categoria(text) to authenticated;
grant execute on function public.admin_eliminar_categoria(integer) to authenticated;
grant execute on function public.admin_agregar_producto(text, integer) to authenticated;
grant execute on function public.admin_eliminar_producto(integer) to authenticated;

-- Los helpers se llaman desde funciones SECURITY DEFINER (corren como postgres),
-- asi que no necesitan EXECUTE para nadie mas.

-- =====================================================
-- Verificacion (deberia mostrar los 5 empleados y las 6 RPCs sin anon)
-- =====================================================

select jsonb_pretty(jsonb_build_object(
  'empleados', (select jsonb_agg(e.nombre order by e.id) from public.empleados e),
  'rpcs', (select jsonb_agg(jsonb_build_object('nombre', p.proname, 'permisos', p.proacl::text) order by p.proname)
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'admin_%')
)) as verificacion;

-- =====================================================
-- ROLLBACK (solo si hace falta; el frontend v0.4.0 deja de cargar empleados sin la tabla)
-- =====================================================
-- drop function if exists public.admin_agregar_empleado(text);
-- drop function if exists public.admin_eliminar_empleado(integer);
-- drop function if exists public.admin_agregar_categoria(text);
-- drop function if exists public.admin_eliminar_categoria(integer);
-- drop function if exists public.admin_agregar_producto(text, integer);
-- drop function if exists public.admin_eliminar_producto(integer);
-- drop function if exists public.admin_exigir_supervisor();
-- drop function if exists public.admin_nombre_limpio(text, integer);
-- drop table if exists public.empleados;
