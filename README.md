# Stock Barra

App web de control de stock para barra, pensada para uso mobile-first y operacion rapida en contexto real.

## Funcionalidades

- Carga de stock por sector.
- Seleccion de empleado y sector.
- Buscador de productos.
- Categorias colapsables.
- Guardado de inventario en Supabase.
- Conteo de barriles disponibles en Camara dentro del mismo flujo de stock.
- Copiar stock total o enviarlo por WhatsApp.
- Supervisor con inicio de sesion, estado de sectores, ultimos conteos y cambios de stock.
- Snapshots de stock total para comparaciones futuras.

## Produccion

https://beerlin.online

## Tecnologias

- HTML
- CSS
- JavaScript
- Supabase
- Node.js
- Vitest
- jsdom
- Playwright
- GitHub Pages

## Arquitectura

- `js/services/`: acceso a datos y consultas a Supabase.
- `js/modules/stock/`: flujo principal de carga de stock.
- `js/modules/stock/stockCatalog.js`: catalogo renderizable por sector y logica de barriles.
- `js/modules/supervisor/`: logica del panel supervisor.
- `js/ui/renderer.js`: render de interfaz.
- `js/core/appState.js`: estado global.
- `js/services/authService.js`: sesion de supervisor con Supabase Auth.
- `tests/`: base de pruebas automatizadas para logica critica.

## Desarrollo y testing

Prerequisito:

- Node.js LTS

Primer setup:

1. Ejecutar `npm install`.
2. Abrir una terminal nueva si Node se acaba de instalar y todavia no aparece en `PATH`.

Comandos disponibles:

- `npm test`: corre toda la suite una vez.
- `npm run test:watch`: deja Vitest en modo watch.
- `npm run test:coverage`: genera cobertura en `coverage/`.
- `npm run test:smoke`: corre smoke tests de navegador sobre app local con mocks seguros.
- `npm run test:all`: corre unidad + smoke en una sola pasada.

Cobertura inicial:

- logica pura de `appState`
- normalizacion de texto
- formatter y reportes de stock
- snapshots con mocks de Supabase
- catalogo renderizable por sector y barriles
- renderer DOM critico con `jsdom`
- smoke tests de navegador para stock y supervisor con `Playwright`
- smoke tests ampliados para guardado, copiar, cambio de sector, acceso supervisor y estados de error
- smoke tests sobre login, bloqueo directo y cierre de sesion del supervisor

Estado actual de validacion:

- `45` tests unitarios
- `12` smoke tests de navegador
- cobertura unitaria sobre `90%` de statements y `93%` de lines

Notas para smoke tests:

- usan `Microsoft Edge` del sistema en modo headless
- levantan un server local y mockean `catalogoService` / `inventarioService`
- no leen ni escriben stock real

## Seguridad de supervisor

La app ya no usa password hardcodeado en frontend para entrar al supervisor.

Ahora el flujo es:

1. El acceso oculto desde `index.html` abre `supervisor.html`.
2. `supervisor.html` valida una sesion real con Supabase Auth.
3. Si no hay sesion, muestra login y mantiene el panel bloqueado.
4. Si la sesion existe, habilita el panel y permite cerrar sesion.

Setup minimo recomendado:

1. Crear una cuenta dedicada de supervisor en Supabase Auth.
2. Usar email + password para entrar al panel.
3. Revisar `docs/SUPERVISOR_AUTH.md` para el paquete de hardening backend y politicas recomendadas.

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

## Checklist de QA

Antes de publicar cambios, usar la lista corta de validacion en:

- `docs/QA_CHECKLIST.md`

Y, si el entorno tiene Node disponible:

- correr `npm test`

## Licencia

Uso interno.
