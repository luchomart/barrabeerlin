-- Stock Barra v0.4.0 - Ventas automaticas
-- Ejecutar en Supabase SQL Editor cuando avancemos con la Parte 2.
--
-- Objetivo:
-- - registrar ventas del dia
-- - descontar inventario por prioridad de sectores
-- - auditar que sector se desconto
-- - registrar faltantes sin permitir stock negativo
--
-- Importante:
-- - esta RPC modifica inventario.cantidad
-- - no modifica inventario.ultima_actualizacion ni inventario.empleado
--   para no confundir ventas con conteos de sector

create extension if not exists pgcrypto;

create or replace function public.normalizar_texto_stock(valor text)
returns text
language sql
immutable
as $$
  select translate(
    lower(trim(coalesce(valor, ''))),
    'áàäâãéèëêíìïîóòöôõúùüûñ',
    'aaaaaeeeeiiiiooooouuuun'
  );
$$;

create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  empleado text,
  origen text not null default 'manual',
  observacion text,
  created_at timestamptz not null default now()
);

create table if not exists public.ventas_detalle (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id integer not null,
  cantidad integer not null check (cantidad > 0 and cantidad <= 1000),
  descontado integer not null default 0 check (descontado >= 0),
  faltante integer not null default 0 check (faltante >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ventas_descuentos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id integer not null,
  sector_id text not null,
  sector_nombre text,
  cantidad_descontada integer not null check (cantidad_descontada > 0),
  prioridad integer not null,
  created_at timestamptz not null default now()
);

create index if not exists ventas_fecha_idx
on public.ventas (fecha desc);

create index if not exists ventas_detalle_venta_id_idx
on public.ventas_detalle (venta_id);

create index if not exists ventas_detalle_producto_id_idx
on public.ventas_detalle (producto_id);

create index if not exists ventas_descuentos_venta_id_idx
on public.ventas_descuentos (venta_id);

create index if not exists ventas_descuentos_producto_id_idx
on public.ventas_descuentos (producto_id);

alter table public.ventas enable row level security;
alter table public.ventas_detalle enable row level security;
alter table public.ventas_descuentos enable row level security;

drop policy if exists "supervisor select ventas" on public.ventas;
drop policy if exists "supervisor select ventas_detalle" on public.ventas_detalle;
drop policy if exists "supervisor select ventas_descuentos" on public.ventas_descuentos;

create policy "supervisor select ventas"
on public.ventas
for select
to authenticated
using (public.is_supervisor());

create policy "supervisor select ventas_detalle"
on public.ventas_detalle
for select
to authenticated
using (public.is_supervisor());

create policy "supervisor select ventas_descuentos"
on public.ventas_descuentos
for select
to authenticated
using (public.is_supervisor());

create or replace function public.registrar_venta(
  stock_vendido jsonb,
  empleado text default null,
  observacion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  venta_id_generada uuid;
  item record;
  inventario_row record;
  cantidad_restante integer;
  cantidad_a_descontar integer;
  total_descontado integer;
  detalles jsonb;
  descuentos jsonb;
begin
  if stock_vendido is null or jsonb_typeof(stock_vendido) <> 'object' then
    return jsonb_build_object(
      'status', 'invalid',
      'venta_id', null,
      'detalles', '[]'::jsonb,
      'descuentos', '[]'::jsonb
    );
  end if;

  create temp table if not exists pg_temp.tmp_venta_items (
    producto_id integer primary key,
    cantidad integer not null
  ) on commit drop;

  create temp table if not exists pg_temp.tmp_prioridad_sectores (
    sector_nombre_norm text not null,
    prioridad integer not null,
    orden integer not null
  ) on commit drop;

  truncate table pg_temp.tmp_venta_items;
  truncate table pg_temp.tmp_prioridad_sectores;

  insert into pg_temp.tmp_venta_items (producto_id, cantidad)
  select
    key::integer as producto_id,
    least(
      1000,
      greatest(0, floor(coalesce(nullif(value #>> '{}', '')::numeric, 0)))
    )::integer as cantidad
  from jsonb_each(stock_vendido)
  where key ~ '^[0-9]+$'
    and key::integer > 0
    and jsonb_typeof(value) in ('number', 'string')
    and (value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
  on conflict (producto_id) do update
  set cantidad = excluded.cantidad;

  delete from pg_temp.tmp_venta_items
  where cantidad <= 0;

  if not exists (select 1 from pg_temp.tmp_venta_items) then
    return jsonb_build_object(
      'status', 'empty',
      'venta_id', null,
      'detalles', '[]'::jsonb,
      'descuentos', '[]'::jsonb
    );
  end if;

  insert into pg_temp.tmp_prioridad_sectores (
    sector_nombre_norm,
    prioridad,
    orden
  )
  values
    ('exhibidoras', 1, 1),
    ('exibidoras', 1, 1),
    ('estantes barra', 1, 2),
    ('camara', 2, 1),
    ('deposito superior', 3, 1),
    ('deposito cocina', 3, 2),
    ('estante cocina', 3, 2);

  insert into public.ventas (
    empleado,
    origen,
    observacion
  )
  values (
    nullif(trim(coalesce(empleado, '')), ''),
    'manual',
    nullif(trim(coalesce(observacion, '')), '')
  )
  returning id into venta_id_generada;

  for item in
    select producto_id, cantidad
    from pg_temp.tmp_venta_items
    order by producto_id
  loop
    cantidad_restante := item.cantidad;
    total_descontado := 0;

    for inventario_row in
      select
        i.id as inventario_id,
        i.producto_id::integer as producto_id,
        i.sector_id::text as sector_id,
        s.nombre::text as sector_nombre,
        greatest(coalesce(i.cantidad, 0), 0)::integer as cantidad_disponible,
        p.prioridad,
        p.orden
      from pg_temp.tmp_prioridad_sectores p
      join public.sectores s
        on public.normalizar_texto_stock(s.nombre) = p.sector_nombre_norm
      join public.inventario i
        on i.sector_id::text = s.id::text
       and i.producto_id::integer = item.producto_id
      where coalesce(i.cantidad, 0) > 0
      order by p.prioridad, p.orden, s.nombre
      for update of i
    loop
      exit when cantidad_restante <= 0;

      cantidad_a_descontar := least(
        cantidad_restante,
        inventario_row.cantidad_disponible
      );

      if cantidad_a_descontar <= 0 then
        continue;
      end if;

      update public.inventario
      set cantidad = greatest(coalesce(cantidad, 0) - cantidad_a_descontar, 0)
      where id = inventario_row.inventario_id;

      insert into public.ventas_descuentos (
        venta_id,
        producto_id,
        sector_id,
        sector_nombre,
        cantidad_descontada,
        prioridad
      )
      values (
        venta_id_generada,
        item.producto_id,
        inventario_row.sector_id,
        inventario_row.sector_nombre,
        cantidad_a_descontar,
        inventario_row.prioridad
      );

      cantidad_restante := cantidad_restante - cantidad_a_descontar;
      total_descontado := total_descontado + cantidad_a_descontar;
    end loop;

    insert into public.ventas_detalle (
      venta_id,
      producto_id,
      cantidad,
      descontado,
      faltante
    )
    values (
      venta_id_generada,
      item.producto_id,
      item.cantidad,
      total_descontado,
      greatest(cantidad_restante, 0)
    );
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', vd.producto_id,
        'cantidad', vd.cantidad,
        'descontado', vd.descontado,
        'faltante', vd.faltante
      )
      order by vd.producto_id
    ),
    '[]'::jsonb
  )
  into detalles
  from public.ventas_detalle vd
  where vd.venta_id = venta_id_generada;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'producto_id', d.producto_id,
        'sector_id', d.sector_id,
        'sector_nombre', d.sector_nombre,
        'cantidad_descontada', d.cantidad_descontada,
        'prioridad', d.prioridad
      )
      order by d.producto_id, d.prioridad, d.sector_nombre
    ),
    '[]'::jsonb
  )
  into descuentos
  from public.ventas_descuentos d
  where d.venta_id = venta_id_generada;

  return jsonb_build_object(
    'status', 'created',
    'venta_id', venta_id_generada,
    'detalles', detalles,
    'descuentos', descuentos
  );
end;
$$;

revoke all on function public.registrar_venta(jsonb, text, text) from public;
grant execute on function public.registrar_venta(jsonb, text, text) to anon;
grant execute on function public.registrar_venta(jsonb, text, text) to authenticated;

-- Validacion manual sugerida despues de aplicar:
-- 1. cargar una venta chica de un producto con stock en Exhibidoras
-- 2. confirmar que inventario.cantidad bajo solo en sectores prioritarios
-- 3. confirmar que ventas_detalle y ventas_descuentos tienen auditoria
-- 4. confirmar que no cambio inventario.ultima_actualizacion
