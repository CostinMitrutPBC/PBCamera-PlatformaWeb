"use strict";

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Eroare API");
  return data;
}

export async function getMeSafe() {
  try {
    const res = await fetch("/api/me", { credentials: "include" });
    return await res.json();
  } catch {
    return { user: null };
  }
}
