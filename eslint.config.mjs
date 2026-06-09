import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // IODP workspace uses loose `any` types intentionally — data shapes
    // come from a dynamic Supabase schema and are typed via runtime transforms.
    files: ["src/components/iodp/**", "src/lib/iodp/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-compiler/react-compiler": "off",
    },
  },
  {
    rules: {
      // Thai text in JSX contains quotes that would break readability if escaped
      "react/no-unescaped-entities": "off",
      // React Compiler lint rule flags async state patterns — disabled; these are pre-existing patterns
      "react-compiler/react-compiler": "off",
      // Supabase query results use dynamic shapes in several service files
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
