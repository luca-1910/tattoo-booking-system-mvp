import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Load .env, .env.local, etc. — same resolution order as Next.js/Vite
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [tsconfigPaths()],
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.integration.test.ts"],
      env,
      // Each integration test file runs in its own worker so cleanup is isolated
      pool: "forks",
    },
  };
});
