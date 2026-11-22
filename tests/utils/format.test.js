import { describe, expect, it } from "vitest";

import {
  formatearCantidad,
  leerCantidad,
  normalizarTexto,
  redondearCantidad,
} from "../../js/utils/format.js";

describe("normalizarTexto", () => {
  it("normaliza mayusculas, espacios y acentos", () => {
    expect(normalizarTexto("  Cámara  ")).toBe("camara");
    expect(normalizarTexto("Red Ipa")).toBe("red ipa");
    expect(normalizarTexto("ENERGÉTICAS")).toBe("energeticas");
  });

  it("devuelve string vacio para valores nulos o indefinidos", () => {
    expect(normalizarTexto()).toBe("");
    expect(normalizarTexto(null)).toBe("");
  });
});

describe("cantidades con decimales", () => {
  it("redondea a 2 decimales y evita restos de coma flotante", () => {
    expect(redondearCantidad(0.1 + 0.2)).toBe(0.3);
    expect(redondearCantidad("2.505")).toBe(2.51);
    // Igual que Postgres numeric(10,2): la mitad se aleja del cero.
    expect(redondearCantidad(1.255)).toBe(1.26);
    expect(redondearCantidad(-0.125)).toBe(-0.13);
    expect(redondearCantidad(1000)).toBe(1000);
    expect(redondearCantidad("abc")).toBe(0);
  });

  it("lee coma o punto", () => {
    expect(leerCantidad("1,5")).toBe(1.5);
    expect(leerCantidad(" 2.25 ")).toBe(2.25);
    expect(leerCantidad("")).toBeNaN();
    expect(leerCantidad("1,2,3")).toBeNaN();
  });

  it("muestra con coma y sin ceros de mas", () => {
    expect(formatearCantidad(2.5)).toBe("2,5");
    expect(formatearCantidad("3.00")).toBe("3");
    expect(formatearCantidad(-0.25)).toBe("-0,25");
  });
});
