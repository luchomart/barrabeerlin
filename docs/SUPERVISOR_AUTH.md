# Supervisor Auth

## Objetivo

Cerrar el acceso del panel supervisor con una sesion real, sin romper el flujo actual de stock.

## Que ya quedo implementado en la app

- `supervisor.html` arranca bloqueado por defecto.
- El panel solo se habilita cuando existe una sesion valida de Supabase Auth.
- El acceso oculto desde `index.html` ya no usa password hardcodeado en frontend.
- Hay login y logout dentro del propio supervisor.
- El flujo esta cubierto por smoke tests de navegador.

## Setup minimo recomendado

1. Crear una cuenta dedicada de supervisor en Supabase Auth.
2. Usar esa cuenta para entrar al panel.
3. Evitar reutilizar cuentas de uso general para este acceso.

## Limitacion importante

Esto ya mejora de verdad el acceso a la UI del supervisor, pero no cierra por si solo todo el backend.

Motivo:

- la app principal sigue usando el rol `anon` para operar stock
- parte del inventario sigue estando disponible para flujos operativos del frontend
- por eso, el cierre total requiere aplicar el endurecimiento de Supabase con criterio por flujo

## Hardening backend recomendado

### 1. Definir la cuenta de supervisor

Usar una cuenta de Supabase Auth dedicada para supervisor.

Si queres una politica mas escalable, agregar en `app_metadata`:

```json
{
  "role": "supervisor"
}
```

### 2. Helper SQL para politicas

Crear un helper comun:

```sql
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
```

### 3. Cerrar lectura sensible de snapshots

La lectura de `stock_snapshots` ya es claramente de supervisor. Se puede endurecer sin romper el flujo actual de stock:

```sql
alter table public.stock_snapshots enable row level security;

drop policy if exists "supervisor select stock_snapshots" on public.stock_snapshots;

create policy "supervisor select stock_snapshots"
on public.stock_snapshots
for select
to authenticated
using (public.is_supervisor());
```

Nota:

- mantener la politica de `insert` que hoy necesite el flujo de snapshots desde stock

### 4. No cerrar `inventario` a ciegas

`inventario` hoy alimenta tanto el flujo operativo de empleados como varias lecturas del supervisor.

Antes de endurecer `select` sobre `inventario`, conviene mover las lecturas del supervisor a RPCs o endpoints dedicados. Si se cierra `inventario` sin esa separacion, se puede romper:

- carga por sector
- stock total para compartir
- snapshots desde stock

### 5. Paso siguiente recomendado

Mover estas lecturas a funciones dedicadas de Supabase:

- `get_supervisor_conteos_desde(...)`
- `get_supervisor_inventario_con_sectores()`
- cualquier otra lectura agregada solo para panel supervisor

Esas funciones deberian validarse con `public.is_supervisor()` y recien entonces leer `inventario`.

## Criterio final

La estrategia correcta para esta app es en dos capas:

1. sesion real en frontend para bloquear el panel y quitar secretos del cliente
2. politicas/RPCs en Supabase para que la seguridad no dependa del navegador

La capa 1 ya quedo aplicada.
La capa 2 es el siguiente paso recomendado en produccion.
