import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const config = [
  {
    ignores: [".next/**", "node_modules/**", "supabase/**", "build_output.txt"],
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // This rule is noisy for marketing/content-heavy pages and doesn't impact runtime safety.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;

