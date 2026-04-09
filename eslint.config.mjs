import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Supabase edge functions are not Next.js code
    "supabase/**",
  ]),
  // Downgrade noisy rules to warnings project-wide — fix gradually, don't block builds
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      // React Compiler plugin enforces strict purity rules — downgrade until codebase is fully compliant
      "react-compiler/react-compiler": "warn",
    },
  },
  // Relax strict rules for test files — mocks legitimately use `any`
  {
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);

export default eslintConfig;
