import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals"),
  // This rule is very noisy for content-heavy pages in this repo and was not
  // consistently enforced previously. Keeping it off avoids mass churn.
  {
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;

