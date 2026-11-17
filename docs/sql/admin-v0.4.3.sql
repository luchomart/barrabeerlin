-- Stock Barra v0.4.3 - Productos sin aviso de stock en 0 (2026-11-17)
-- Ejecutar en Supabase SQL Editor DESPUES de admin-v0.4.0.sql.
--
-- Que hace:
-- 1. Agrega la columna `productos.avisar_sin_stock` (boolean, por defecto true).
--    true  = si el producto esta en 0, aparece en "SIN STOCK" del mensaje de WhatsApp.
--    false = no aparece en "SIN STOCK" (con stock se sigue enviando normal).
--    Con el default true no cambia nada hasta que el supervisor marque alguno.
--    Agregar una columna con default constante no reescribe la tabla (instantaneo).
--    anon/authenticated la pueden LEER igual que el resto de `productos` (ya tienen select);
--    no la pueden escribir.
-- 2. Agrega la RPC admin_avisar_sin_stock(producto_id, avisar):
--    - SECURITY DEFINER, solo `authenticated` (se revoca anon) y exige is_supervisor(),
--      igual que las demas admin_*.
--    - Solo modifica `productos.avisar_sin_stock` de ese producto.

alter table public.productos
  add column if not exists avisar_sin_stock boolean not null default true;

create or replace function public.admin_avisar_sin_stock(producto_id integer, avisar boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  producto public.productos;
begin
  perform public.admin_exigir_supervisor();

  if avisar is null then
    raise exception 'Falta indicar si se avisa o no.' using errcode = '22023';
  end if;

  update public.productos p
  set avisar_sin_stock = admin_avisar_sin_stock.avisar
  where p.id = admin_avisar_sin_stock.producto_id
  returning * into producto;

  if not found then
    raise exception 'El producto ya no existe.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', producto.id,
    'nombre', producto.nombre,
    'avisar_sin_stock', producto.avisar_sin_stock
  );
end;
$$;

revoke all on function public.admin_avisar_sin_stock(integer, boolean) from public, anon;
grant execute on function public.admin_avisar_sin_stock(integer, boolean) to authenticated;

-- =====================================================
-- Verificacion: deberia mostrar
--   columna_ok = true, productos_sin_aviso = 0 (recien creada, todos avisan),
--   rpc_sin_anon = true
-- =====================================================

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'productos'
      and column_name = 'avisar_sin_stock' and column_default = 'true' and is_nullable = 'NO'
  ) as columna_ok,
  (select count(*) from public.productos where not avisar_sin_stock) as productos_sin_aviso,
  (
    select p.proacl::text not like '%anon=%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_avisar_sin_stock'
  ) as rpc_sin_anon;

-- =====================================================
-- ROLLBACK (solo si hace falta): borra la RPC y la columna (se pierde que productos
-- estaban marcados). El frontend sigue andando: sin la columna, avisa de todos.
-- =====================================================
-- drop function if exists public.admin_avisar_sin_stock(integer, boolean);
-- alter table public.productos drop column if exists avisar_sin_stock;
