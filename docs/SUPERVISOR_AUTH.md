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

SQL aplicado:

- `docs/sql/supervisor-hardening-v0.3.2.sql`

Ese archivo crea RPCs protegidas para las lecturas del supervisor y mantiene compatible el flujo actual de stock.

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

### 3. Centralizar lecturas del supervisor

El panel supervisor debe leer datos sensibles mediante funciones RPC dedicadas:

- `get_supervisor_conteos_desde(...)`
- `get_supervisor_inventario_con_sectores()`
- `get_supervisor_diferencias_stock()`

Nota:

- estas funciones ya estan preparadas en `docs/sql/supervisor-hardening-v0.3.2.sql`
- el frontend intenta usarlas y conserva fallback temporal si todavia no existen en Supabase

### 4. No cerrar `inventario` a ciegas

`inventario` hoy alimenta tanto el flujo operativo de empleados como varias lecturas del supervisor.

Antes de endurecer `select` sobre `inventario`, conviene mover las lecturas del supervisor a RPCs o endpoints dedicados. Si se cierra `inventario` sin esa separacion, se puede romper:

- carga por sector
- stock total para compartir
- snapshots desde stock

### 5. No cerrar `stock_snapshots` todavia

Aunque los cambios de stock son de supervisor, el flujo actual de WhatsApp usa `saveStockSnapshot()` y necesita leer snapshots recientes para deduplicar.

Por eso:

- no cerrar `select` de `stock_snapshots` para `anon` todavia
- mover el guardado/deduplicacion de snapshots a RPC transaccional en el siguiente paso
- recien despues endurecer completamente `stock_snapshots`

## Criterio final

La estrategia correcta para esta app es en dos capas:

1. sesion real en frontend para bloquear el panel y quitar secretos del cliente
2. politicas/RPCs en Supabase para que la seguridad no dependa del navegador

La capa 1 ya quedo aplicada.
La capa 2 es el siguiente paso recomendado en produccion.
