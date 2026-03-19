import { config } from "dotenv";
import { resolve } from "path";

// Load test env BEFORE any other import touches process.env
config({ path: resolve(import.meta.dirname, "../../.env.test"), override: true });
