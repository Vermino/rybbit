import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import * as shopifySchema from "./schema-shopify.js";
import * as appsumoSchema from "./schema-appsumo.js";

// Load environment variables
// In Docker: variables are passed via docker-compose.yml
// In local dev: loads from .env file
dotenv.config();

// Create postgres connection
const client = postgres({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  onnotice: () => {},
  max: 20,
});

// Combine all schemas
const combinedSchema = {
  ...schema,
  ...shopifySchema,
  ...appsumoSchema,
};

// Create drizzle ORM instance
export const db = drizzle(client, { schema: combinedSchema });

// For compatibility with raw SQL if needed
export const sql = client;
