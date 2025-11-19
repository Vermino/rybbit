import { db } from "../db/postgres/postgres.js";
import { sql } from "drizzle-orm";

/**
 * Migration script to add cloakedUrl and targetUrl columns to experiments table
 * Run with: npm run migrate:experiments
 */
async function migrateExperiments() {
  try {
    console.log("Starting experiments table migration...");

    // Add cloakedUrl column
    await db.execute(sql`
      ALTER TABLE experiments
      ADD COLUMN IF NOT EXISTS cloaked_url TEXT;
    `);
    console.log("✓ Added cloaked_url column");

    // Add targetUrl column
    await db.execute(sql`
      ALTER TABLE experiments
      ADD COLUMN IF NOT EXISTS target_url TEXT;
    `);
    console.log("✓ Added target_url column");

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrateExperiments();
