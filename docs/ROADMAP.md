# Roadmap - Stock Barra

Roadmap actualizado segun el estado real del proyecto al 2026-04-16.

## Estado actual

Version base:
- `0.3.0`

Capas ya consolidadas:
- arquitectura modular con `services`, `modules`, `ui` y `core`
- carga de stock por sector con `appState`
- supervisor operativo
- snapshots globales de stock
- comparacion de cambios entre snapshots
- conteo de barriles en `Camara`
- versionado centralizado

Hallazgos del analisis:
- `stockController.js` ya quedo mas liviano, pero todavia concentra demasiado flujo operativo
- el supervisor ya usa sesion real con Supabase Auth, pero el cierre total del backend todavia depende de aplicar el hardening en Supabase
- la deduplicacion de snapshots ya es mas consistente, pero todavia depende de convenciones de frontend y no de una identidad real en DB
- la base de tests ya cubre la mayor parte del flujo critico, pero todavia conviene seguir ampliando casos sobre auth, services y errores raros

## Prioridad inmediata

Lo primero que conviene estabilizar antes de sumar features nuevas:
- aplicar en Supabase el hardening backend preparado para supervisor
- terminar de reforzar el contrato de snapshots desde backend o con identidad propia
- terminar de cerrar ramas raras de services y helpers internos
- ordenar responsabilidades dentro de `stockController.js`

## v0.2.9 - Cierre de huecos de testing (completado)

Objetivo:
- usar la bateria de tests para encontrar y cerrar bugs reales antes de pasar al frente de seguridad

Incluye:
- cobertura ampliada sobre formatter, renderer e inventario
- smoke tests operativos extra sobre copiar, acceso supervisor y errores
- correccion de `producto_id` invalido en comparaciones de snapshots

## v0.2.3 - Hardening operativo (completado)

Objetivo:
- dejar la version actual mas solida, consistente y limpia sin cambiar el flujo de uso

Incluye:
- normalizar codificacion UTF-8 en `style.css`, `renderer.js`, `stockController.js` y textos visibles
- limpiar logs de debug de barriles y mensajes temporales de desarrollo
- revisar y cerrar la UX de errores y estados vacios del supervisor
- alinear `CHANGELOG.md`, `README.md` y roadmap con el estado real del producto
- documentar una checklist manual corta de validacion antes de deploy

## v0.2.4 - Consistencia de snapshots (completado)

Objetivo:
- hacer mas predecible el guardado y la lectura de snapshots sin cambiar la UX ni la base actual

Incluye:
- contrato explicito de resultado al guardar snapshots
- helpers compartidos para resumen, fingerprint y comparacion de snapshots recientes
- integracion mas robusta con el flujo de WhatsApp para no depender de inserciones implicitas
- checklist manual extendida para validar deduplicacion y comparacion

## v0.2.5 - Base de testing (completado)

Objetivo:
- tener una base real de validacion automatizada sin meter una infraestructura pesada

Incluye:
- `Node.js` como runtime de desarrollo
- `Vitest` para pruebas de logica pura
- primera bateria sobre `appState`, formatter, normalizacion y snapshots
- comandos de testing documentados para uso diario

## v0.2.6 - Cobertura de catalogo y DOM (completado)

Objetivo:
- bajar riesgo en el flujo real de stock cubriendo el armado del catalogo y el render DOM mas sensible

Incluye:
- extraccion de la logica de catalogo/barriles a un modulo puro
- pruebas de `stockCatalog` para Camara, sectores normales y categoria virtual
- pruebas `jsdom` para `renderer` y estados criticos del supervisor
- integracion del controller sobre helpers mas faciles de mantener

## v0.2.7 - Smoke tests de navegador (completado)

Objetivo:
- validar los flujos criticos visibles en un navegador real sin tocar produccion

Incluye:
- `Playwright` con `Microsoft Edge` en modo headless
- server estatico local para correr la app durante pruebas
- mocks de servicios para stock y supervisor
- smoke tests sobre Camara, barriles, buscador y panel supervisor

## v0.2.8 - Smoke tests operativos ampliados (completado)

Objetivo:
- cubrir en navegador las interacciones mas delicadas del flujo real sin tocar datos productivos

Incluye:
- guardado con normalizacion de cantidades
- cancelacion de cambio de sector con rollback
- copiado a portapapeles con mock de clipboard
- acceso oculto a supervisor por password
- fallbacks visuales ante errores de servicios

## v0.3.0 - Seguridad de supervisor (completado en app, backend preparado)

Objetivo:
- salir del password hardcodeado de frontend y dejar el panel supervisor protegido por sesion real

Incluye:
- `authService.js` apoyado en Supabase Auth
- login bloqueante dentro de `supervisor.html`
- logout explicito y guard del panel aun con acceso directo por URL
- acceso oculto desde stock convertido en redireccion al panel protegido
- smoke tests nuevos sobre acceso directo, login y cierre de sesion
- documentacion y plantilla de hardening backend para cerrar RLS despues sin rehacer frontend

Siguiente paso recomendado:
- aplicar el paquete de hardening de `docs/SUPERVISOR_AUTH.md` en Supabase para convertir esta mejora en seguridad backend real
- definir mejor el contrato de errores entre `services` y `controllers`

## v0.4.0 - Velocidad de conteo

Objetivo:
- hacer la carga mas rapida en contexto real de barra sin romper la UX actual

Incluye:
- sistema de packs / unidades
- acciones rapidas `+1`, `+6`, `+12`
- mejoras de foco y navegacion para carga intensiva en mobile
- revision de densidad visual para sectores con muchos productos
- optimizacion de tiempos de recarga entre sector y guardado

## v0.5.0 - Inteligencia operativa

Objetivo:
- convertir el supervisor en una herramienta de lectura y decision, no solo de consulta

Incluye:
- dashboard de supervisor con resumen global mas claro
- alertas de stock bajo
- sugerencias de compra
- comparaciones historicas entre snapshots
- deteccion de anomalias o diferencias atipicas

## v0.6.0 - Calidad y release workflow

Objetivo:
- profesionalizar el mantenimiento del proyecto

Incluye:
- smoke tests automatizados para flujos criticos
- estrategia minima de testing para formatter, snapshots y supervisor
- checklist de release versionada
- convenciones de ramas, merge y versionado documentadas
- preparacion para deploys mas seguros y rollback manual claro

## v1.0.0 - Sistema estable de inventario

Objetivo:
- considerar Stock Barra un sistema estable, mantenible y seguro para uso continuo

Condiciones esperadas:
- flujos criticos cubiertos por pruebas o smoke checks repetibles
- seguridad de supervisor resuelta de forma real
- snapshots y comparaciones robustas
- documentacion tecnica y operativa al dia
- roadmap de nuevas features separado del trabajo de estabilizacion
