import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bridge legacy `.eslintrc.json`-style configs to ESLint v9 flat config.
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...compat.extends("next/core-web-vitals"),
  {
    // Tooling / agent directories are not part of the shipped app.
    ignores: [".claude/**", ".claude-flow/**", ".swarm/**", ".next/**"],
  },
  {
    rules: {
      // This repo contains lots of long-form JSX copy (user guides, etc.).
      // Keeping this as an error creates high churn for content-only edits.
      "react/no-unescaped-entities": "off",
    },
  },
];

