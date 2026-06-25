import { describe, expect, it } from "vitest";

import { normalizarTexto } from "../../js/utils/format.js";

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
