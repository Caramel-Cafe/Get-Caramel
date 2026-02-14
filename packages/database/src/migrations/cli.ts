import { CoreDatabase } from "../index";

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit: (code: number) => never;
};

async function main(): Promise<void> {
  const command = process.argv[2] || "status";
  const connectionString = process.env.DATABASE_URL || process.env.ORDER_DATABASE_URL || process.env.PAYMENT_DATABASE_URL;

  const db = new CoreDatabase({
    connectionString,
    autoMigrate: false,
    log: (message) => console.log(`[db-migrate] ${message}`),
  });
  await db.init();

  if (!db.isReady()) {
    console.error("[db-migrate] Database unavailable; set DATABASE_URL (or service DB URL).");
    process.exit(1);
  }

  if (command === "up") {
    const ran = await db.migrateUp();
    console.log(ran.length === 0 ? "[db-migrate] No pending migrations." : `[db-migrate] Applied: ${ran.join(", ")}`);
    return;
  }

  if (command === "down") {
    const rolledBack = await db.rollbackLastMigration();
    console.log(rolledBack ? `[db-migrate] Rolled back: ${rolledBack}` : "[db-migrate] No applied migrations to roll back.");
    return;
  }

  const status = await db.migrationStatus();
  for (const item of status) {
    console.log(`${item.applied ? "[x]" : "[ ]"} ${item.id}`);
  }
}

void main();
