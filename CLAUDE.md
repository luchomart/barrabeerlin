# Stock Barra (Beerlin)

App interna de Beerlin (bar) para contar bebidas por sector desde el celular, guardar en Supabase,
compartir el total por WhatsApp y consultar desde el supervisor. Producción: https://beerlin.online

**Antes de trabajar, leé `AGENTS.md` y `docs/AI_CONTEXT.md`** (reglas, arquitectura, límites de Supabase).
El plan y "Dónde quedamos" están en `docs/ROADMAP.md`.

## Stack y comandos
- HTML + CSS + JS vanilla, Supabase (`supabase-js`), GitHub Pages. Tests: Vitest + jsdom + Playwright.
- `npm ci` · `npm test` (unitarios) · `npm run test:smoke` (Playwright; hoy fijado a `msedge`, que en Linux no está).

## Reglas extra (además de AGENTS.md)
- Trabajar en `dev`. Nunca push/merge a `main` sin pedido explícito: `main` es producción.
- Supabase de producción: no ejecutar SQL ni cambiar datos/políticas/Auth sin pedido explícito.
  **Todo cambio en Supabase se le pasa a Luciano como SQL listo para pegar en el SQL Editor**
  (completo, con verificación y rollback), y se versiona en `docs/sql/`.
- Estado real de Supabase: ver la sección "Estado real" de `docs/DATABASE.md` (revisado 2026-11-16).
- El repo es **público**: nada de secretos ni datos personales. Solo la clave `anon` va en el frontend.
- Proyecto independiente de `distribuidora/`: no mezclar código ni arquitectura.
- Al cerrar una tarea: actualizar `docs/ROADMAP.md` y proponer el commit.
