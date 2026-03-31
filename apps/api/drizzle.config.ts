import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  config({ path: "../../.env" });
}

export default defineConfig({
  out: "./drizzle",
  schema: ["./src/db/schema/auth.ts", "./src/db/schema/app.ts", "./src/db/schema/relations.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
