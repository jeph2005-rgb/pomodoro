import type { Config } from "jest";
import nextJest from "next/jest.js";

// Load next.config + .env into the test environment.
const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // `@/*` -> project root (mirrors tsconfig paths).
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

// Exported as a function call so next/jest can load the async Next.js config.
export default createJestConfig(config);
