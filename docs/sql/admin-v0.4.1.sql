-- Stock Barra v0.4.1 - Ajustes de administracion (revision 2026-11-17)
-- Ejecutar en Supabase SQL Editor DESPUES de admin-v0.4.0.sql.
-- No cambia tablas, datos ni permisos: solo reemplaza 4 RPCs (create or replace
-- conserva los GRANT de v0.4.0: solo authenticated, y adentro exigen is_supervisor()).
--
-- Que cambia:
-- 1. admin_eliminar_producto rechaza el borrado si el producto tiene ventas
--    (ventas_detalle / ventas_descuentos guardan producto_id sin FK: borrarlo las
--    dejaba apuntando a un producto inexistente).
-- 2. admin_agregar_empleado / _categoria / _producto toman un candado sobre su tabla
--    antes de chequear el nombre repetido. Antes, dos altas simultaneas con el mismo
--    nombre podian pasar las dos. El candado (share row exclusive) solo frena otras
--    escrituras sobre esa tabla durante la RPC (milisegundos); las lecturas de la app
--    no se bloquean.

-- =====================================================
-- 1. Borrar producto: bloqueado si tiene ventas
-- =====================================================

create or replace function public.admin_eliminar_producto(producto_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  unidades integer;
  filas_snapshot integer;
  ventas integer;
  borrado public.productos;
begin
  perform public.admin_exigir_supervisor();

  -- Frena altas de ventas mientras se chequea y se borra (milisegundos), asi no
  -- se cuela una venta del producto entre el chequeo y el borrado.
  lock table public.ventas_detalle, public.ventas_descuentos in share mode;

  select
    (select count(*) from public.ventas_detalle d
     where d.producto_id = admin_eliminar_producto.producto_id)
    + (select count(*) from public.ventas_descuentos v
       where v.producto_id = admin_eliminar_producto.producto_id)
  into ventas;

  if ventas > 0 then
    raise exception 'El producto tiene ventas registradas: no se puede borrar.'
      using errcode = '23503';
  end if;

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
-- 2. Altas sin duplicados por concurrencia
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

  lock table public.empleados in share row exclusive mode;

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

  lock table public.categorias in share row exclusive mode;

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

  lock table public.productos in share row exclusive mode;

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

-- =====================================================
-- Verificacion: las 4 RPCs con los cambios y los permisos sin anon
-- (cada fila deberia tener los dos "true" y en permisos solo authenticated/postgres)
-- =====================================================

select
  p.proname as rpc,
  case p.proname
    when 'admin_eliminar_producto' then p.prosrc like '%ventas_detalle%'
    else p.prosrc like '%lock table%'
  end as cambio_aplicado,
  p.proacl::text not like '%anon=%' as sin_anon,
  p.proacl::text as permisos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'admin_eliminar_producto',
    'admin_agregar_empleado',
    'admin_agregar_categoria',
    'admin_agregar_producto'
  )
order by p.proname;

-- =====================================================
-- ROLLBACK (solo si algo se rompe): descomentar y pegar. Son las 4 funciones
-- exactamente como estan en admin-v0.4.0.sql. No hay datos que deshacer.
-- =====================================================
-- create or replace function public.admin_agregar_empleado(nombre text)
-- returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   limpio text;
--   nuevo public.empleados;
-- begin
--   perform public.admin_exigir_supervisor();
--   limpio := public.admin_nombre_limpio(nombre, 40);
--
--   if exists (
--     select 1 from public.empleados e
--     where public.normalizar_texto_stock(e.nombre) = public.normalizar_texto_stock(limpio)
--   ) then
--     raise exception 'Ya existe un empleado llamado %.', limpio using errcode = '23505';
--   end if;
--
--   insert into public.empleados (nombre) values (limpio) returning * into nuevo;
--
--   return jsonb_build_object('id', nuevo.id, 'nombre', nuevo.nombre);
-- end;
-- $$;
--
-- create or replace function public.admin_agregar_categoria(nombre text)
-- returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   limpio text;
--   nueva public.categorias;
-- begin
--   perform public.admin_exigir_supervisor();
--   limpio := public.admin_nombre_limpio(nombre, 60);
--
--   if exists (
--     select 1 from public.categorias c
--     where public.normalizar_texto_stock(c.nombre) = public.normalizar_texto_stock(limpio)
--   ) then
--     raise exception 'Ya existe una categoria llamada %.', limpio using errcode = '23505';
--   end if;
--
--   insert into public.categorias (nombre) values (limpio) returning * into nueva;
--
--   return jsonb_build_object('id', nueva.id, 'nombre', nueva.nombre);
-- end;
-- $$;
--
-- create or replace function public.admin_agregar_producto(nombre text, categoria_id integer)
-- returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   limpio text;
--   nuevo_orden integer;
--   nuevo public.productos;
-- begin
--   perform public.admin_exigir_supervisor();
--   limpio := public.admin_nombre_limpio(nombre, 80);
--
--   if not exists (
--     select 1 from public.categorias c where c.id = admin_agregar_producto.categoria_id
--   ) then
--     raise exception 'La categoria elegida no existe.' using errcode = '23503';
--   end if;
--
--   if exists (
--     select 1 from public.productos p
--     where public.normalizar_texto_stock(p.nombre) = public.normalizar_texto_stock(limpio)
--   ) then
--     raise exception 'Ya existe un producto llamado %.', limpio using errcode = '23505';
--   end if;
--
--   -- Al final de su categoria. Si la categoria no usa `orden` (todo null), queda null.
--   select max(p.orden) + 1 into nuevo_orden
--   from public.productos p
--   where p.categoria_id = admin_agregar_producto.categoria_id;
--
--   insert into public.productos (nombre, categoria_id, orden)
--   values (limpio, admin_agregar_producto.categoria_id, nuevo_orden)
--   returning * into nuevo;
--
--   return jsonb_build_object(
--     'id', nuevo.id,
--     'nombre', nuevo.nombre,
--     'categoria_id', nuevo.categoria_id,
--     'orden', nuevo.orden
--   );
-- end;
-- $$;
--
-- create or replace function public.admin_eliminar_producto(producto_id integer)
-- returns jsonb
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- declare
--   unidades integer;
--   filas_snapshot integer;
--   borrado public.productos;
-- begin
--   perform public.admin_exigir_supervisor();
--
--   select coalesce(sum(i.cantidad), 0) into unidades
--   from public.inventario i
--   where i.producto_id = admin_eliminar_producto.producto_id;
--
--   select count(*) into filas_snapshot
--   from public.stock_snapshots s
--   where s.producto_id = admin_eliminar_producto.producto_id;
--
--   -- ON DELETE CASCADE borra inventario y stock_snapshots del producto.
--   delete from public.productos p
--   where p.id = admin_eliminar_producto.producto_id
--   returning * into borrado;
--
--   if borrado.id is null then
--     raise exception 'El producto ya no existe.' using errcode = 'P0002';
--   end if;
--
--   return jsonb_build_object(
--     'id', borrado.id,
--     'nombre', borrado.nombre,
--     'unidades_borradas', unidades,
--     'filas_snapshot_borradas', filas_snapshot
--   );
-- end;
-- $$;
