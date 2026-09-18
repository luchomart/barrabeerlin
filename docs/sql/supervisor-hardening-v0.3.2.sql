-- Stock Barra v0.3.2 - Hardening compatible de supervisor
-- Ejecutar en Supabase SQL Editor.
--
-- Objetivo:
-- - centralizar lecturas sensibles del supervisor en RPCs
-- - validar rol `supervisor` desde JWT
-- - mantener funcionando el flujo actual de stock y snapshots
--
-- Requisito:
-- El usuario supervisor debe tener app_metadata.role = "supervisor".

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

revoke all on function public.is_supervisor() from public;
grant execute on function public.is_supervisor() to authenticated;

create or replace function public.get_supervisor_conteos_desde(
  fecha_desde timestamptz
)
returns table (
  empleado text,
  sector_id text,
  ultima_actualizacion timestamptz,
  sector_nombre text
)
language sql
security definer
set search_path = public
as $$
  select
    i.empleado::text as empleado,
    i.sector_id::text as sector_id,
    i.ultima_actualizacion as ultima_actualizacion,
    s.nombre::text as sector_nombre
  from public.inventario i
  left join public.sectores s on s.id = i.sector_id
  where public.is_supervisor()
    and i.ultima_actualizacion >= fecha_desde
  order by i.ultima_actualizacion desc;
$$;

revoke all on function public.get_supervisor_conteos_desde(timestamptz) from public;
grant execute on function public.get_supervisor_conteos_desde(timestamptz) to authenticated;

create or replace function public.get_supervisor_inventario_con_sectores()
returns table (
  cantidad integer,
  producto_id integer,
  sector_nombre text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(i.cantidad, 0)::integer as cantidad,
    i.producto_id::integer as producto_id,
    s.nombre::text as sector_nombre
  from public.inventario i
  left join public.sectores s on s.id = i.sector_id
  where public.is_supervisor();
$$;

revoke all on function public.get_supervisor_inventario_con_sectores() from public;
grant execute on function public.get_supervisor_inventario_con_sectores() to authenticated;

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
  with ultimas_fechas as (
    select distinct fecha
    from public.stock_snapshots
    order by fecha desc
    limit 2
  ),
  fechas_ordenadas as (
    select
      fecha,
      row_number() over (order by fecha desc) as posicion
    from ultimas_fechas
  ),
  actual_snapshot as (
    select
      ss.producto_id::integer as producto_id,
      sum(coalesce(ss.cantidad, 0))::integer as cantidad
    from public.stock_snapshots ss
    join fechas_ordenadas f on f.fecha = ss.fecha
    where f.posicion = 1
    group by ss.producto_id
  ),
  anterior_snapshot as (
    select
      ss.producto_id::integer as producto_id,
      sum(coalesce(ss.cantidad, 0))::integer as cantidad
    from public.stock_snapshots ss
    join fechas_ordenadas f on f.fecha = ss.fecha
    where f.posicion = 2
    group by ss.producto_id
  ),
  fechas_snapshot as (
    select
      max(fecha) filter (where posicion = 1) as actual_fecha,
      max(fecha) filter (where posicion = 2) as anterior_fecha,
      count(*) as total_fechas
    from fechas_ordenadas
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
    and f.total_fechas = 2
  order by d.magnitud desc, d.producto_id asc;
$$;

revoke all on function public.get_supervisor_diferencias_stock() from public;
grant execute on function public.get_supervisor_diferencias_stock() to authenticated;

-- Importante:
-- No cerrar todavia SELECT de stock_snapshots para anon si el flujo de WhatsApp
-- sigue usando saveStockSnapshot() con deduplicacion desde frontend.
-- Ese cierre queda para el siguiente paso, cuando el guardado de snapshots
-- tambien pase a una RPC transaccional.
