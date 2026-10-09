import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import fs from "node:fs";

let connectionString = process.env.DATABASE_URL;
const certificatePath = process.env.DATABASE_SSL_CA_PATH;
if (certificatePath && connectionString) {
  const url = new URL(connectionString);
  // pg's URL SSL options override the explicit certificate configuration.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
  connectionString = url.toString();
}

export const pool = new Pool({
  connectionString,
  ...(certificatePath ? { ssl: { rejectUnauthorized: true, ca: fs.readFileSync(certificatePath, "utf8") } } : {}),
});

export const db = drizzle(pool, { schema });
