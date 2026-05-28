require('dotenv').config({ quiet: true });

const { createDatabase } = require('./db');

const run = async () => {
  const db = createDatabase();
  await db.migrate();
  await db.close();
  console.log('Database migration completed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
