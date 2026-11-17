-- Stock Barra v0.4.2 - Mover un producto a otra categoria (2026-11-17)
-- Ejecutar en Supabase SQL Editor DESPUES de admin-v0.4.0.sql (no depende de v0.4.1).
-- No cambia tablas, datos ni politicas: solo agrega una RPC.
--
-- Que hace:
-- admin_mover_producto(producto_id, categoria_id) cambia la categoria de un producto.
--   - SECURITY DEFINER, ejecutable solo por `authenticated` (se revoca anon) y exige
--     is_supervisor(), igual que las demas admin_*.
--   - Solo modifica `productos.categoria_id` y `productos.orden` de ESE producto.
--     No toca inventario, snapshots ni ventas (todos apuntan al producto, no a la categoria).
--   - El producto queda al final de la categoria nueva (si esa categoria no usa `orden`,
--     queda en null, igual que admin_agregar_producto).
--   - Sirve tambien para darle categoria a los productos que hoy no tienen ninguna.
--   - Rechaza: producto o categoria inexistentes.

create or replace function public.admin_mover_producto(producto_id integer, categoria_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  producto public.productos;
  nuevo_orden integer;
begin
  perform public.admin_exigir_supervisor();

  select * into producto
  from public.productos p
  where p.id = admin_mover_producto.producto_id
  for update;

  if not found then
    raise exception 'El producto ya no existe.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.categorias c where c.id = admin_mover_producto.categoria_id
  ) then
    raise exception 'La categoria elegida no existe.' using errcode = '23503';
  end if;

  -- Ya esta en esa categoria: no se toca nada.
  if producto.categoria_id is not distinct from admin_mover_producto.categoria_id then
    return jsonb_build_object(
      'id', producto.id,
      'nombre', producto.nombre,
      'categoria_id', producto.categoria_id,
      'orden', producto.orden,
      'movido', false
    );
  end if;

  select max(p.orden) + 1 into nuevo_orden
  from public.productos p
  where p.categoria_id = admin_mover_producto.categoria_id;

  update public.productos p
  set categoria_id = admin_mover_producto.categoria_id,
      orden = nuevo_orden
  where p.id = admin_mover_producto.producto_id
  returning * into producto;

  return jsonb_build_object(
    'id', producto.id,
    'nombre', producto.nombre,
    'categoria_id', producto.categoria_id,
    'orden', producto.orden,
    'movido', true
  );
end;
$$;

revoke all on function public.admin_mover_producto(integer, integer) from public, anon;
grant execute on function public.admin_mover_producto(integer, integer) to authenticated;

-- =====================================================
-- Verificacion: deberia mostrar una fila con sin_anon = true
-- y en permisos solo authenticated y postgres.
-- =====================================================

select
  p.proname as rpc,
  p.prosecdef as security_definer,
  p.proacl::text not like '%anon=%' as sin_anon,
  p.proacl::text as permisos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'admin_mover_producto';

-- =====================================================
-- ROLLBACK (solo si hace falta): borra la RPC. Los productos ya movidos quedan en su
-- categoria nueva; para volver uno atras, moverlo de nuevo antes de borrar la RPC.
-- =====================================================
-- drop function if exists public.admin_mover_producto(integer, integer);
