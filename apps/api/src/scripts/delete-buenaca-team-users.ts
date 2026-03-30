/** Remove default Buenaça staging team accounts so provision can recreate with a known password. */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const emails = ["buenacagaucha+sandro@gmail.com", "buenacagaucha+sendi@gmail.com"];

const sql = postgres(url, { max: 1 });

async function run() {
  for (const e of emails) {
    await sql`DELETE FROM users WHERE email = ${e}`;
    console.log("Deleted (if existed):", e);
  }
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
