-- Stock Barra - Revertir la prueba del boton "Mover" (2026-11-17)
-- Ejecutar en Supabase SQL Editor. Solo cambia 4 filas de `productos`.
--
-- Que hace:
-- Al probar "Mover" se pasaron a Vinos 4 productos duplicados que no tenian categoria
-- (quedaron con orden 362-365, al final de Vinos). Este script los devuelve a
-- "sin categoria" (categoria_id null), como estaban antes:
--   19 Altos del Plata Chardonay   (duplicado de 69 "Altos del Plata Chardonnay")
--   34 Cosecha Tardia Blanco       (duplicado de 75 "Cosecha tardía blanco")
--   33 Cosecha Tardia Rosado       (duplicado de 76 "Cosecha tardía rosado")
--   32 Santa Julia Chennin Dulce   (duplicado de 80 "Santa Julia Chenin Dulce")
-- `orden` queda en null: el valor que tenian antes no quedo registrado, y un producto sin
-- categoria no aparece en ningun sector, asi que no se usa.
-- No toca inventario, snapshots ni ventas.
--
-- Seguridad: si alguno de los 4 no esta exactamente como lo dejo la prueba (Vinos, orden
-- 362-365), no cambia nada y muestra un error.

begin;

do $$
begin
  if (
    select count(*)
    from public.productos p
    where (p.id, p.categoria_id, p.orden) in ((19, 7, 362), (34, 7, 363), (33, 7, 364), (32, 7, 365))
  ) <> 4 then
    raise exception 'Los 4 productos no estan como se esperaba: no se cambio nada.';
  end if;
end;
$$;

update public.productos
set categoria_id = null,
    orden = null
where id in (19, 34, 33, 32);

commit;

-- =====================================================
-- Verificacion: deberian salir las 4 filas con categoria_id y orden vacios (null)
-- =====================================================

select id, nombre, categoria_id, orden
from public.productos
where id in (19, 32, 33, 34)
order by id;

-- =====================================================
-- ROLLBACK (solo si hace falta): vuelve a dejarlos en Vinos como quedaron tras la prueba.
-- =====================================================
-- update public.productos set categoria_id = 7, orden = 362 where id = 19;
-- update public.productos set categoria_id = 7, orden = 363 where id = 34;
-- update public.productos set categoria_id = 7, orden = 364 where id = 33;
-- update public.productos set categoria_id = 7, orden = 365 where id = 32;
