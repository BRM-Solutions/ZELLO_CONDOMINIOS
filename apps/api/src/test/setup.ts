import { Pool } from "pg";
import { assertTestEnvironment } from "./guard";

assertTestEnvironment(process.env);
process.env.NODE_ENV = "test";

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL;
if (adminUrl && process.env.TEST_DATABASE_URL) {
  const pool = new Pool({ connectionString: adminUrl, max: 1 });
  try {
    await pool.query(
      "delete from app.organizations where name like 'test\\_%' and created_at < now() - interval '1 hour'",
    );
  } finally {
    await pool.end();
  }
}
