import dotenv from "dotenv";
import postgres from "postgres";
import path from "path";
import { fileURLToPath } from "url";

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

/**
 * Migration script to add cloakedUrl and targetUrl columns to experiments table
 * Run with: npm run migrate:experiments
 */
async function migrateExperiments() {
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = parseInt(process.env.POSTGRES_PORT || "5432", 10);
  const database = process.env.POSTGRES_DB;
  const username = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;

  console.log("🔍 Checking database connection configuration...");
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   Database: ${database}`);
  console.log(`   User: ${username}`);
  console.log("");

  if (!database || !username) {
    console.error("❌ Missing required environment variables!");
    console.error("   Please check your .env file contains:");
    console.error("   - POSTGRES_DB");
    console.error("   - POSTGRES_USER");
    console.error("   - POSTGRES_PASSWORD (optional)");
    console.error("   - POSTGRES_HOST (should be 'localhost' for local dev)");
    process.exit(1);
  }

  // Create postgres connection
  const sql = postgres({
    host,
    port,
    database,
    username,
    password,
    onnotice: () => {},
  });

  try {
    console.log("🔌 Connecting to database...");

    // Test connection
    await sql`SELECT 1 as test`;
    console.log("✓ Connected successfully!");
    console.log("");
    console.log("📝 Starting experiments table migration...");

    // Add cloakedUrl column
    await sql`
      ALTER TABLE experiments
      ADD COLUMN IF NOT EXISTS cloaked_url TEXT;
    `;
    console.log("✓ Added cloaked_url column");

    // Add targetUrl column
    await sql`
      ALTER TABLE experiments
      ADD COLUMN IF NOT EXISTS target_url TEXT;
    `;
    console.log("✓ Added target_url column");

    // Verify columns were added
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'experiments'
      AND column_name IN ('cloaked_url', 'target_url')
      ORDER BY column_name;
    `;

    console.log("");
    console.log("🔍 Verification:");
    columns.forEach((col: any) => {
      console.log(`   ✓ ${col.column_name}: ${col.data_type}`);
    });

    console.log("");
    console.log("✅ Migration completed successfully!");

    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error("");
    console.error("❌ Migration failed!");
    console.error("");

    if (error.code === "ENOTFOUND") {
      console.error("🔧 Connection Error: Cannot resolve hostname '" + error.hostname + "'");
      console.error("");
      console.error("   This usually means your .env file has the wrong POSTGRES_HOST.");
      console.error("   For local development, make sure your .env contains:");
      console.error("");
      console.error("   POSTGRES_HOST=localhost");
      console.error("");
      console.error("   (The value 'postgres' is for Docker containers only)");
    } else if (error.code === "ECONNREFUSED") {
      console.error("🔧 Connection Error: Cannot connect to database");
      console.error("");
      console.error("   Make sure PostgreSQL is running on " + host + ":" + port);
      console.error("   You can check with: pg_isready -h " + host + " -p " + port);
    } else if (error.code === "28P01" || error.code === "28000") {
      console.error("🔧 Authentication Error: Invalid credentials");
      console.error("");
      console.error("   Check your .env file has the correct:");
      console.error("   - POSTGRES_USER");
      console.error("   - POSTGRES_PASSWORD");
    } else {
      console.error("Error details:", error.message);
      console.error("");
      console.error("Full error:", error);
    }

    console.error("");
    await sql.end();
    process.exit(1);
  }
}

migrateExperiments();
