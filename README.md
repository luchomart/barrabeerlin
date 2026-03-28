# Stock Barra

App web de control de stock para barra, pensada para uso mobile-first y operacion rapida en contexto real.

## Funcionalidades

- Carga de stock por sector.
- Seleccion de empleado y sector.
- Buscador de productos.
- Categorias colapsables.
- Guardado de inventario en Supabase.
- Copiar stock total o enviarlo por WhatsApp.
- Supervisor con estado de sectores, ultimos conteos y cambios de stock.
- Snapshots de stock total para comparaciones futuras.

## Produccion

https://beerlin.online

## Tecnologias

- HTML
- CSS
- JavaScript
- Supabase
- GitHub Pages

## Arquitectura

- `js/services/`: acceso a datos y consultas a Supabase.
- `js/modules/stock/`: flujo principal de carga de stock.
- `js/modules/supervisor/`: logica del panel supervisor.
- `js/ui/renderer.js`: render de interfaz.
- `js/core/appState.js`: estado global.

## Versionado

La version de la app se define en una sola fuente de verdad:

- `js/config.js` -> `APP_VERSION`

Reglas de versionado:

- `PATCH` (`0.0.x`): fixes, hardening y pequenos ajustes sin features nuevas.
- `MINOR` (`0.x.0`): funcionalidades importantes nuevas o hitos visibles del producto.
- `MAJOR` (`1.0.0`): sistema estable y considerado completo.

Flujo recomendado al sacar una version:

1. Actualizar `APP_VERSION` en `js/config.js`.
2. Agregar o completar la entrada correspondiente en `CHANGELOG.md`.
3. Reflejar el estado futuro en `docs/ROADMAP.md` si cambia el plan.
4. Verificar en la UI que la version visible coincida con `APP_VERSION`.

## Roadmap

Ver `docs/ROADMAP.md`.

## Licencia

Uso interno.
