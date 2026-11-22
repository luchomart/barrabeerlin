-- Stock Barra v0.6.0 - Productos que se cuentan con decimales (2026-11-22)
-- Ejecutar en Supabase SQL Editor DESPUES de admin-v0.4.3.sql. Todo junto: si algo falla,
-- no se aplica nada (begin/commit).
--
-- Que hace:
-- 1. `inventario.cantidad` y `stock_snapshots.cantidad` pasan de integer a numeric(10,2)
--    (hasta 2 decimales). Los valores actuales quedan iguales (3 -> 3.00).
--    Reescribe las dos tablas (son chicas: es instantaneo). Si alguna politica o vista usa la
--    columna, Postgres frena con un error y no se cambia nada: pasarle el error a Claude.
-- 2. Agrega `productos.permite_decimales` (boolean, por defecto false). Con false todo sigue
--    como hoy (enteros). anon/authenticated la pueden LEER (ya tienen select en productos);
--    no la pueden escribir.
-- 3. Agrega la RPC admin_permitir_decimales(producto_id, permitir):
--    SECURITY DEFINER, solo `authenticated` (se revoca anon) y exige is_supervisor(),
--    igual que las demas admin_*. Solo modifica `productos.permite_decimales` de ese producto.
-- 4. Reemplaza las RPCs que convertian la cantidad a entero:
--    - save_stock_snapshot(jsonb): guarda con 2 decimales en vez de redondear para abajo.
--      Mismos permisos (anon y authenticated, como hoy: la usa la pantalla de conteo).
--    - get_supervisor_inventario_con_sectores() y get_supervisor_diferencias_stock():
--      devuelven numeric. Como cambia el tipo de lo que devuelven hay que borrarlas y crearlas.
--      Quedan solo para `authenticated` (hoy anon tambien puede llamarlas, pero sin
--      is_supervisor() devuelven vacio: no se pierde nada).
--
-- No toca: registrar_venta (ventas, sin UI todavia) ni los datos de ventas.

begin;

alter table public.inventario
  alter column cantidad type numeric(10,2) using cantidad::numeric(10,2);

alter table public.stock_snapshots
  alter column cantidad type numeric(10,2) using cantidad::numeric(10,2);

alter table public.productos
  add column if not exists permite_decimales boolean not null default false;

-- ---------- RPC del admin ----------

create or replace function public.admin_permitir_decimales(producto_id integer, permitir boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  producto public.productos;
begin
  perform public.admin_exigir_supervisor();

  if permitir is null then
    raise exception 'Falta indicar si se permiten decimales o no.' using errcode = '22023';
  end if;

  update public.productos p
  set permite_decimales = admin_permitir_decimales.permitir
  where p.id = admin_permitir_decimales.producto_id
  returning * into producto;

  if not found then
    raise exception 'El producto ya no existe.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', producto.id,
    'nombre', producto.nombre,
    'permite_decimales', producto.permite_decimales
  );
end;
$$;

revoke all on function public.admin_permitir_decimales(integer, boolean) from public, anon;
grant execute on function public.admin_permitir_decimales(integer, boolean) to authenticated;

-- ---------- Snapshot (pantalla de conteo -> WhatsApp) ----------

create or replace function public.save_stock_snapshot(
  stock_por_producto jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora timestamptz := now();
  nuevo_snapshot_id uuid := gen_random_uuid();
  ultimo_snapshot_id uuid;
  ultima_fecha timestamptz;
  fingerprint_nuevo text;
  fingerprint_ultimo text;
  total_productos integer;
  total_unidades numeric;
  registros jsonb;
begin
  if stock_por_producto is null or jsonb_typeof(stock_por_producto) <> 'object' then
    return jsonb_build_object(
      'status', 'invalid',
      'fecha', null,
      'snapshot_id', null,
      'registros', '[]'::jsonb,
      'resumen', null
    );
  end if;

  create temp table if not exists pg_temp.tmp_stock_snapshot (
    producto_id integer,
    cantidad numeric(10,2)
  ) on commit drop;

  truncate table pg_temp.tmp_stock_snapshot;

  insert into pg_temp.tmp_stock_snapshot (producto_id, cantidad)
  select
    key::integer as producto_id,
    least(
      1000,
      greatest(0, round(coalesce(nullif(value #>> '{}', '')::numeric, 0), 2))
    )::numeric(10,2) as cantidad
  from jsonb_each(stock_por_producto)
  where key ~ '^[0-9]+$'
    and key::integer > 0
    and jsonb_typeof(value) in ('number', 'string')
    and (value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$';

  -- El fingerprint usa trim_scale para que 3.00 y 3 den igual (compara con snapshots viejos).
  select
    count(*)::integer,
    coalesce(sum(cantidad), 0),
    coalesce(string_agg(producto_id || ':' || trim_scale(cantidad), '|' order by producto_id), '')
  into total_productos, total_unidades, fingerprint_nuevo
  from pg_temp.tmp_stock_snapshot;

  if total_productos = 0 then
    return jsonb_build_object(
      'status', 'empty',
      'fecha', null,
      'snapshot_id', null,
      'registros', '[]'::jsonb,
      'resumen', jsonb_build_object(
        'fecha', null,
        'snapshot_id', null,
        'totalProductos', 0,
        'totalUnidades', 0,
        'fingerprint', ''
      )
    );
  end if;

  select
    grupo.snapshot_id,
    grupo.fecha
  into ultimo_snapshot_id, ultima_fecha
  from (
    select
      coalesce(snapshot_id, md5(fecha::text)::uuid) as snapshot_id,
      max(fecha) as fecha
    from public.stock_snapshots
    group by coalesce(snapshot_id, md5(fecha::text)::uuid)
    order by max(fecha) desc
    limit 1
  ) grupo;

  if ultimo_snapshot_id is not null and ahora - ultima_fecha <= interval '10 seconds' then
    select coalesce(string_agg(producto_id || ':' || trim_scale(cantidad), '|' order by producto_id), '')
    into fingerprint_ultimo
    from (
      select
        producto_id::integer as producto_id,
        greatest(0, coalesce(cantidad, 0))::numeric(10,2) as cantidad
      from public.stock_snapshots
      where coalesce(snapshot_id, md5(fecha::text)::uuid) = ultimo_snapshot_id
    ) rows_ultimo;

    if fingerprint_ultimo = fingerprint_nuevo then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'producto_id', ss.producto_id,
            'cantidad', ss.cantidad,
            'fecha', ss.fecha,
            'snapshot_id', ss.snapshot_id
          )
          order by ss.producto_id
        ),
        '[]'::jsonb
      )
      into registros
      from public.stock_snapshots ss
      where coalesce(ss.snapshot_id, md5(ss.fecha::text)::uuid) = ultimo_snapshot_id;

      return jsonb_build_object(
        'status', 'deduplicated',
        'fecha', ultima_fecha,
        'snapshot_id', ultimo_snapshot_id,
        'registros', registros,
        'resumen', jsonb_build_object(
          'fecha', ultima_fecha,
          'snapshot_id', ultimo_snapshot_id,
          'totalProductos', total_productos,
          'totalUnidades', total_unidades,
          'fingerprint', fingerprint_nuevo
        )
      );
    end if;
  end if;

  insert into public.stock_snapshots (
    producto_id,
    cantidad,
    fecha,
    snapshot_id
  )
  select
    producto_id,
    cantidad,
    ahora,
    nuevo_snapshot_id
  from pg_temp.tmp_stock_snapshot
  order by producto_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', ss.producto_id,
        'cantidad', ss.cantidad,
        'fecha', ss.fecha,
        'snapshot_id', ss.snapshot_id
      )
      order by ss.producto_id
    ),
    '[]'::jsonb
  )
  into registros
  from public.stock_snapshots ss
  where ss.snapshot_id = nuevo_snapshot_id;

  return jsonb_build_object(
    'status', 'created',
    'fecha', ahora,
    'snapshot_id', nuevo_snapshot_id,
    'registros', registros,
    'resumen', jsonb_build_object(
      'fecha', ahora,
      'snapshot_id', nuevo_snapshot_id,
      'totalProductos', total_productos,
      'totalUnidades', total_unidades,
      'fingerprint', fingerprint_nuevo
    )
  );
end;
$$;

revoke all on function public.save_stock_snapshot(jsonb) from public;
grant execute on function public.save_stock_snapshot(jsonb) to anon;
grant execute on function public.save_stock_snapshot(jsonb) to authenticated;

-- ---------- RPCs del supervisor (cambian el tipo que devuelven) ----------

drop function if exists public.get_supervisor_inventario_con_sectores();

create function public.get_supervisor_inventario_con_sectores()
returns table (
  cantidad numeric,
  producto_id integer,
  sector_nombre text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(i.cantidad, 0)::numeric as cantidad,
    i.producto_id::integer as producto_id,
    s.nombre::text as sector_nombre
  from public.inventario i
  left join public.sectores s on s.id = i.sector_id
  where public.is_supervisor();
$$;

revoke all on function public.get_supervisor_inventario_con_sectores() from public, anon;
grant execute on function public.get_supervisor_inventario_con_sectores() to authenticated;

drop function if exists public.get_supervisor_diferencias_stock();

create function public.get_supervisor_diferencias_stock()
returns table (
  producto_id integer,
  actual numeric,
  anterior numeric,
  diferencia numeric,
  magnitud numeric,
  tipo text,
  snapshot_actual_fecha timestamptz,
  snapshot_anterior_fecha timestamptz
)
language sql
security definer
set search_path = public
as $$
  with grupos_snapshot as (
    select
      coalesce(snapshot_id, md5(fecha::text)::uuid) as snapshot_key,
      max(fecha) as fecha
    from public.stock_snapshots
    group by coalesce(snapshot_id, md5(fecha::text)::uuid)
  ),
  ultimos_grupos as (
    select
      snapshot_key,
      fecha,
      row_number() over (order by fecha desc) as posicion
    from grupos_snapshot
    order by fecha desc
    limit 2
  ),
  actual_snapshot as (
    select
      ss.producto_id::integer as producto_id,
      sum(coalesce(ss.cantidad, 0))::numeric as cantidad
    from public.stock_snapshots ss
    join ultimos_grupos g
      on coalesce(ss.snapshot_id, md5(ss.fecha::text)::uuid) = g.snapshot_key
    where g.posicion = 1
    group by ss.producto_id
  ),
  anterior_snapshot as (
    select
      ss.producto_id::integer as producto_id,
      sum(coalesce(ss.cantidad, 0))::numeric as cantidad
    from public.stock_snapshots ss
    join ultimos_grupos g
      on coalesce(ss.snapshot_id, md5(ss.fecha::text)::uuid) = g.snapshot_key
    where g.posicion = 2
    group by ss.producto_id
  ),
  fechas_snapshot as (
    select
      max(fecha) filter (where posicion = 1) as actual_fecha,
      max(fecha) filter (where posicion = 2) as anterior_fecha,
      count(*) as total_grupos
    from ultimos_grupos
  ),
  productos as (
    select producto_id from actual_snapshot
    union
    select producto_id from anterior_snapshot
  ),
  diferencias as (
    select
      p.producto_id,
      coalesce(a.cantidad, 0) as actual,
      coalesce(an.cantidad, 0) as anterior,
      coalesce(a.cantidad, 0) - coalesce(an.cantidad, 0) as diferencia,
      abs(coalesce(a.cantidad, 0) - coalesce(an.cantidad, 0)) as magnitud,
      case
        when coalesce(a.cantidad, 0) - coalesce(an.cantidad, 0) > 0 then 'entrada'
        when coalesce(a.cantidad, 0) - coalesce(an.cantidad, 0) < 0 then 'salida'
        else 'sin_cambio'
      end as tipo
    from productos p
    left join actual_snapshot a on a.producto_id = p.producto_id
    left join anterior_snapshot an on an.producto_id = p.producto_id
  )
  select
    d.producto_id,
    d.actual,
    d.anterior,
    d.diferencia,
    d.magnitud,
    d.tipo,
    f.actual_fecha as snapshot_actual_fecha,
    f.anterior_fecha as snapshot_anterior_fecha
  from diferencias d
  cross join fechas_snapshot f
  where public.is_supervisor()
    and f.total_grupos = 2
  order by d.magnitud desc, d.producto_id asc;
$$;

revoke all on function public.get_supervisor_diferencias_stock() from public, anon;
grant execute on function public.get_supervisor_diferencias_stock() to authenticated;

commit;

-- =====================================================
-- Verificacion: deberia mostrar todo en true y productos_con_decimales = 0
-- =====================================================

select
  (
    select data_type = 'numeric' and numeric_scale = 2
    from information_schema.columns
    where table_schema = 'public' and table_name = 'inventario' and column_name = 'cantidad'
  ) as inventario_numeric,
  (
    select data_type = 'numeric' and numeric_scale = 2
    from information_schema.columns
    where table_schema = 'public' and table_name = 'stock_snapshots' and column_name = 'cantidad'
  ) as snapshots_numeric,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'productos'
      and column_name = 'permite_decimales' and column_default = 'false' and is_nullable = 'NO'
  ) as columna_ok,
  (select count(*) from public.productos where permite_decimales) as productos_con_decimales,
  (
    select bool_and(p.proacl::text not like '%anon=%')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_permitir_decimales',
        'get_supervisor_inventario_con_sectores',
        'get_supervisor_diferencias_stock'
      )
  ) as rpcs_sin_anon,
  (
    select p.proacl::text like '%anon=X%'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'save_stock_snapshot'
  ) as snapshot_sigue_para_anon;

-- =====================================================
-- ROLLBACK (solo si hace falta). Antes, en el admin, sacar todos los productos de
-- "Se cuentan con decimales" y guardar de nuevo esos sectores: si queda alguna cantidad con
-- decimales, el paso a integer la redondea (2,5 -> 3). Despues correr esto y volver a pegar
-- las RPCs de snapshot-rpc-v0.3.3.sql (save_stock_snapshot y get_supervisor_diferencias_stock)
-- y la de supervisor-hardening-v0.3.2.sql (get_supervisor_inventario_con_sectores).
-- =====================================================
-- begin;
-- drop function if exists public.admin_permitir_decimales(integer, boolean);
-- drop function if exists public.get_supervisor_inventario_con_sectores();
-- drop function if exists public.get_supervisor_diferencias_stock();
-- alter table public.productos drop column if exists permite_decimales;
-- alter table public.inventario alter column cantidad type integer using round(cantidad)::integer;
-- alter table public.stock_snapshots alter column cantidad type integer using round(cantidad)::integer;
-- commit;
