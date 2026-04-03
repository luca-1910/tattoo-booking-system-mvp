export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "Set it in your runtime environment or .env.local (see .env.example).",
    );
  }
  return value;
}

export function getPublicEnvForBrowserClient(name: string): string {
  const value = process.env[name];
  if (value) return value;

  // During Next.js build/prerender, client components can be evaluated on the server.
  // Returning deterministic placeholders here prevents build-time crashes when local
  // env files are absent in CI or ephemeral environments.
  if (typeof window === "undefined") {
    if (name === "NEXT_PUBLIC_SUPABASE_URL") return "https://placeholder.supabase.co";
    if (name === "NEXT_PUBLIC_SUPABASE_ANON_KEY") return "placeholder-anon-key";
  }

  throw new Error(
    `Missing required environment variable: ${name}. ` +
      "Set it in your runtime environment or .env.local (see .env.example).",
  );
}
