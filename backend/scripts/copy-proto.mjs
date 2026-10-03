import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/llm", { recursive: true });

copyFileSync(
  "src/llm/llm.proto",
  "dist/llm/llm.proto",
);