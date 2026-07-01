#!/usr/bin/env node
/**
 * Campaign Worker Entry Point
 * 
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/start-worker.ts
 * Or in production: npx ts-node scripts/start-worker.ts
 */

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

// Validate required env vars
const required = ["DATABASE_URL", "REDIS_URL"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

console.log("🔧 Environment loaded");
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL?.slice(0, 30)}...`);
console.log(`   REDIS_URL: ${process.env.REDIS_URL}`);

// Start the worker
require("../lib/queue/worker");
