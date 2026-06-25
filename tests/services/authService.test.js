import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const onAuthStateChangeMock = vi.fn();
const unsubscribeMock = vi.fn();

vi.mock("../../js/services/supabaseClient.js", () => ({
  supabase: {
    auth: {
      getUser: getUserMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

const {
  getSupervisorUser,
  onSupervisorAuthChange,
  signInSupervisor,
  signOutSupervisor,
} = await import("../../js/services/authService.js");

describe("authService", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    onAuthStateChangeMock.mockReset();
    unsubscribeMock.mockReset();
  });

  it("devuelve el usuario supervisor actual cuando existe sesion", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "sup-1",
          email: "supervisor@beerlin.online",
        },
      },
      error: null,
    });

    await expect(getSupervisorUser()).resolves.toEqual({
      id: "sup-1",
      email: "supervisor@beerlin.online",
    });
  });

  it("devuelve null cuando no hay usuario autenticado", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(getSupervisorUser()).resolves.toBeNull();
  });

  it("trata la ausencia de sesion como estado esperado", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("Auth session missing!"),
    });

    await expect(getSupervisorUser()).resolves.toBeNull();
  });

  it("propaga errores al consultar usuario actual", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: new Error("auth getUser error"),
    });

    await expect(getSupervisorUser()).rejects.toThrow("auth getUser error");
  });

  it("trimmea email al iniciar sesion", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: {
          id: "sup-1",
          email: "supervisor@beerlin.online",
        },
      },
      error: null,
    });

    const user = await signInSupervisor({
      email: "  supervisor@beerlin.online  ",
      password: "1234",
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "supervisor@beerlin.online",
      password: "1234",
    });
    expect(user).toEqual({
      id: "sup-1",
      email: "supervisor@beerlin.online",
    });
  });

  it("propaga errores de login", async () => {
    signInWithPasswordMock.mockResolvedValue({
      data: {
        user: null,
        session: null,
      },
      error: new Error("Invalid login credentials"),
    });

    await expect(
      signInSupervisor({
        email: "supervisor@beerlin.online",
        password: "wrong",
      }),
    ).rejects.toThrow("Invalid login credentials");
  });

  it("lanza error si signOut falla", async () => {
    signOutMock.mockResolvedValue({
      error: new Error("sign out error"),
    });

    await expect(signOutSupervisor()).rejects.toThrow("sign out error");
  });

  it("permite escuchar y limpiar cambios de autenticacion", () => {
    const callback = vi.fn();
    let internalCallback = null;

    onAuthStateChangeMock.mockImplementation((handler) => {
      internalCallback = handler;

      return {
        data: {
          subscription: {
            unsubscribe: unsubscribeMock,
          },
        },
      };
    });

    const cleanup = onSupervisorAuthChange(callback);

    internalCallback?.("SIGNED_IN", { user: { id: "sup-1" } });

    expect(callback).toHaveBeenCalledWith("SIGNED_IN", {
      user: { id: "sup-1" },
    });

    cleanup();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
