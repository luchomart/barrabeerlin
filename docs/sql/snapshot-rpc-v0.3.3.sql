-- Stock Barra v0.3.3 - Snapshots confiables
-- Ejecutar en Supabase SQL Editor.
--
-- Objetivo:
-- - agregar identidad real de snapshot con snapshot_id
-- - mover guardado/deduplicacion de snapshots a RPC
-- - mantener compatibilidad con snapshots historicos agrupados por fecha

create extension if not exists pgcrypto;

alter table public.stock_snapshots
add column if not exists snapshot_id uuid;

with grupos as (
  select
    fecha,
    gen_random_uuid() as snapshot_id
  from public.stock_snapshots
  where snapshot_id is null
  group by fecha
)
update public.stock_snapshots ss
set snapshot_id = grupos.snapshot_id
from grupos
where ss.fecha = grupos.fecha
  and ss.snapshot_id is null;

create index if not exists stock_snapshots_snapshot_id_idx
on public.stock_snapshots (snapshot_id);

create index if not exists stock_snapshots_fecha_snapshot_id_idx
on public.stock_snapshots (fecha desc, snapshot_id);

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
  total_unidades integer;
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
    cantidad integer
  ) on commit drop;

  truncate table pg_temp.tmp_stock_snapshot;

  insert into pg_temp.tmp_stock_snapshot (producto_id, cantidad)
  select
    key::integer as producto_id,
    least(
      1000,
      greatest(0, floor(coalesce(nullif(value #>> '{}', '')::numeric, 0)))
    )::integer as cantidad
  from jsonb_each(stock_por_producto)
  where key ~ '^[0-9]+$'
    and key::integer > 0
    and jsonb_typeof(value) in ('number', 'string')
    and (value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$';

  select
    count(*)::integer,
    coalesce(sum(cantidad), 0)::integer,
    coalesce(string_agg(producto_id || ':' || cantidad, '|' order by producto_id), '')
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
    select coalesce(string_agg(producto_id || ':' || cantidad, '|' order by producto_id), '')
    into fingerprint_ultimo
    from (
      select
        producto_id::integer as producto_id,
        greatest(0, coalesce(cantidad, 0))::integer as cantidad
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

create or replace function public.get_supervisor_diferencias_stock()
returns table (
  producto_id integer,
  actual integer,
  anterior integer,
  diferencia integer,
  magnitud integer,
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
      sum(coalesce(ss.cantidad, 0))::integer as cantidad
    from public.stock_snapshots ss
    join ultimos_grupos g
      on coalesce(ss.snapshot_id, md5(ss.fecha::text)::uuid) = g.snapshot_key
    where g.posicion = 1
    group by ss.producto_id
  ),
  anterior_snapshot as (
    select
      ss.producto_id::integer as producto_id,
      sum(coalesce(ss.cantidad, 0))::integer as cantidad
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
      coalesce(a.cantidad, 0)::integer as actual,
      coalesce(an.cantidad, 0)::integer as anterior,
      (coalesce(a.cantidad, 0) - coalesce(an.cantidad, 0))::integer as diferencia,
      abs(coalesce(a.cantidad, 0) - coalesce(an.cantidad, 0))::integer as magnitud,
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

revoke all on function public.get_supervisor_diferencias_stock() from public;
grant execute on function public.get_supervisor_diferencias_stock() to authenticated;

-- Importante:
-- Este paso NO cierra todavia permisos directos sobre stock_snapshots.
-- Primero validar que WhatsApp genera snapshots correctamente usando esta RPC.
