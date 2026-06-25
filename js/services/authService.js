import { supabase } from "./supabaseClient.js";

const auth = supabase.auth;

function esSesionAusente(error) {
  const message = String(error?.message || "").toLowerCase();
  const name = String(error?.name || "").toLowerCase();

  return (
    name.includes("authsessionmissing") ||
    message.includes("auth session missing") ||
    message.includes("session missing") ||
    message.includes("missing session")
  );
}

export async function getSupervisorUser() {
  const { data, error } = await auth.getUser();

  if (esSesionAusente(error)) {
    return null;
  }

  if (error) throw error;

  return data?.user || null;
}

export async function signInSupervisor({ email, password }) {
  const credentials = {
    email: String(email || "").trim(),
    password: String(password || ""),
  };

  const { data, error } = await auth.signInWithPassword(credentials);

  if (error) throw error;

  return data?.user || data?.session?.user || null;
}

export async function signOutSupervisor() {
  const { error } = await auth.signOut();

  if (error) throw error;
}

export function onSupervisorAuthChange(callback) {
  const { data } = auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return () => {
    data?.subscription?.unsubscribe?.();
  };
}
