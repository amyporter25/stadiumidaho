import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    inspectAttr(),
    react(),
    {
      name: "allow-iframe-preview",
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.removeHeader("X-Frame-Options");
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  // GitHub Pages hosts this repo at /stadiumidaho/. Local/dev stays at /.
  base: process.env.GITHUB_PAGES === "true" ? "/stadiumidaho/" : "/",
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    // Cursor Desktop maps this VM to the user's localhost. Pin HMR to the
    // same port so the client does not try a hostname the laptop cannot reach.
    hmr: {
      clientPort: 3000,
    },
    // Cursor Simple Browser and some preview iframes refuse SAMEORIGIN.
    headers: {
      "Content-Security-Policy": "frame-ancestors *",
    },
  },
});
