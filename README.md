# Drip Check

Fashion outfit analysis with Gemini and a local Express API.

## Development

### Environment

Create `.env.local` in the project root (or add to `.env`) with a Gemini API key. The backend reads either name:

- `GEMINI_API_KEY` (server-only)
- `VITE_GEMINI_API_KEY` (also exposed to the Vite client if you use client-side Gemini calls)

Restart dev processes after changing env files.

### Run locally

**Option A — two terminals (recommended on Windows):**

```bash
npm run server   # Express API on http://localhost:3001
npm run dev      # Vite on http://localhost:5173
```

**Option B — one command (cross-platform):**

```bash
npm run dev:full
```

This uses `concurrently` to start both the API and Vite. The `&` shell background operator does not work reliably in PowerShell.

### Verify the API

```bash
curl http://localhost:3001/api/health
```

Expected response: `{"status":"ok"}`

The Vite dev server proxies `/api/*` to port 3001. If you only run `npm run dev` and the backend is down, browser requests to `/api/...` return **502 Bad Gateway** (proxy could not connect to `http://localhost:3001`).

---

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
