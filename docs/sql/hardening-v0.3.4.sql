-- Stock Barra v0.3.4 - Cerrar politicas "permitir todo"
-- Ejecutar en Supabase SQL Editor.
--
-- Contexto (estado real revisado en Supabase el 2026-11-16):
-- - inventario tenia la politica "inventario libre" (ALL, rol public, using true):
--   cualquiera con la clave anon podia BORRAR inventario.
-- - stock_snapshots tenia "allow all" (ALL, rol public, using true):
--   cualquiera podia modificar o borrar el historial de snapshots.
--
-- Por que no rompe la app:
-- - El frontend solo hace select + upsert (insert/update) sobre inventario,
--   cubiertos por "app select/insert/update inventario".
-- - Sobre stock_snapshots solo hace select + insert (y la RPC save_stock_snapshot),
--   cubiertos por "app dedupe select stock_snapshots" y "app insert stock_snapshots".
--
-- Lo que sigue abierto: anon todavia puede modificar cantidades de inventario.
-- Cerrarlo requiere login de empleados (fase aparte).

drop policy if exists "inventario libre" on public.inventario;
drop policy if exists "allow all" on public.stock_snapshots;

-- Verificacion: no deberia devolver filas.
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname in ('inventario libre', 'allow all');

-- ROLLBACK (solo si algo se rompe):
-- create policy "inventario libre" on public.inventario
--   for all to public using (true) with check (true);
-- create policy "allow all" on public.stock_snapshots
--   for all to public using (true) with check (true);
