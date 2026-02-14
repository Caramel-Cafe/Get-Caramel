declare const require: (id: string) => any;

type Pool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

type Migration = {
  id: string;
  up: string[];
  down: string[];
};

export interface DatabaseOptions {
  connectionString?: string;
  log?: (message: string) => void;
  autoMigrate?: boolean;
}

export class CoreDatabase {
  private readonly connectionString?: string;
  private readonly log: (message: string) => void;
  private readonly autoMigrate: boolean;
  private pool?: Pool;
  private initialized = false;

  constructor(options: DatabaseOptions) {
    this.connectionString = options.connectionString;
    this.log = options.log || (() => undefined);
    this.autoMigrate = options.autoMigrate ?? true;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.connectionString) return;

    try {
      const pg = require("pg") as { Pool: new (options: { connectionString: string }) => Pool };
      this.pool = new pg.Pool({ connectionString: this.connectionString });
      if (this.autoMigrate) await this.runMigrations();
      this.log("CoreDatabase connected and migrations applied");
    } catch (error) {
      this.pool = undefined;
      this.log(`CoreDatabase unavailable, falling back to in-memory only: ${String(error)}`);
    }
  }

  isReady(): boolean {
    return Boolean(this.pool);
  }

  async query(sql: string, params: unknown[] = []): Promise<Array<Record<string, unknown>>> {
    if (!this.pool) return [];
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async migrateUp(): Promise<string[]> {
    if (!this.pool) return [];
    await this.ensureMigrationTable();

    const appliedRows = await this.pool.query("select migration_id from schema_migrations");
    const applied = new Set(appliedRows.rows.map((row) => String(row.migration_id)));
    const ran: string[] = [];

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue;
      await this.pool.query("begin");
      try {
        for (const statement of migration.up) await this.pool.query(statement);
        await this.pool.query("insert into schema_migrations (migration_id, applied_at) values ($1, now())", [migration.id]);
        await this.pool.query("commit");
        ran.push(migration.id);
      } catch (error) {
        await this.pool.query("rollback");
        throw error;
      }
    }

    return ran;
  }

  async rollbackLastMigration(): Promise<string | null> {
    if (!this.pool) return null;
    await this.ensureMigrationTable();

    const rows = await this.pool.query(
      "select migration_id from schema_migrations order by applied_at desc, migration_id desc limit 1",
    );
    const migrationId = rows.rows[0]?.migration_id ? String(rows.rows[0].migration_id) : null;
    if (!migrationId) return null;

    const migration = MIGRATIONS.find((item) => item.id === migrationId);
    if (!migration) throw new Error(`Unknown migration id ${migrationId}`);

    await this.pool.query("begin");
    try {
      for (const statement of migration.down) await this.pool.query(statement);
      await this.pool.query("delete from schema_migrations where migration_id = $1", [migrationId]);
      await this.pool.query("commit");
      return migrationId;
    } catch (error) {
      await this.pool.query("rollback");
      throw error;
    }
  }

  async migrationStatus(): Promise<Array<{ id: string; applied: boolean }>> {
    if (!this.pool) return MIGRATIONS.map((migration) => ({ id: migration.id, applied: false }));
    await this.ensureMigrationTable();
    const rows = await this.pool.query("select migration_id from schema_migrations");
    const applied = new Set(rows.rows.map((row) => String(row.migration_id)));
    return MIGRATIONS.map((migration) => ({ id: migration.id, applied: applied.has(migration.id) }));
  }

  private async runMigrations(): Promise<void> {
    await this.migrateUp();
  }

  private async ensureMigrationTable(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      create table if not exists schema_migrations (
        migration_id text primary key,
        applied_at timestamptz not null
      );
    `);
  }
}

const MIGRATIONS: Migration[] = [
  {
    id: "001_core_tables",
    up: [
      `
      create table if not exists order_carts (
        customer_id text primary key,
        vendor_id text null,
        subtotal_cents integer not null,
        delivery_fee_cents integer not null,
        total_cents integer not null,
        updated_at_iso text not null
      );
      `,
      `
      create table if not exists order_cart_items (
        customer_id text not null,
        item_id text not null,
        vendor_id text not null,
        name text not null,
        description text not null,
        price_cents integer not null,
        quantity integer not null,
        primary key(customer_id, item_id)
      );
      `,
      `
      create table if not exists orders (
        order_id text primary key,
        customer_id text not null,
        vendor_id text not null,
        rider_id text null,
        subtotal_cents integer not null,
        delivery_fee_cents integer not null,
        total_cents integer not null,
        status text not null,
        address_line text not null,
        created_at_iso text not null,
        updated_at_iso text not null
      );
      `,
      `
      create table if not exists order_items (
        order_id text not null,
        item_id text not null,
        vendor_id text not null,
        name text not null,
        description text not null,
        price_cents integer not null,
        quantity integer not null,
        primary key(order_id, item_id)
      );
      `,
      `
      create table if not exists reviews (
        review_id text primary key,
        order_id text not null,
        vendor_id text not null,
        customer_id text not null,
        rating integer not null,
        comment text not null,
        moderation_status text not null,
        flagged_reason text null,
        created_at_iso text not null
      );
      `,
      `
      create table if not exists support_tickets (
        ticket_id text primary key,
        customer_id text not null,
        order_id text null,
        subject text not null,
        description text not null,
        priority text not null,
        status text not null,
        admin_notes text null,
        created_at_iso text not null,
        updated_at_iso text not null
      );
      `,
      `
      create table if not exists payments (
        payment_id text primary key,
        order_id text not null,
        customer_id text not null,
        vendor_id text not null,
        amount_cents integer not null,
        method text not null,
        status text not null,
        risk_score real not null,
        risk_flagged boolean not null,
        created_at_iso text not null,
        updated_at_iso text not null
      );
      `,
      `
      create table if not exists invoices (
        invoice_id text primary key,
        order_id text not null,
        vendor_id text not null,
        customer_id text not null,
        gross_amount_cents integer not null,
        platform_fee_cents integer not null,
        net_vendor_amount_cents integer not null,
        issued_at_iso text not null
      );
      `,
      `
      create table if not exists payouts (
        payout_id text primary key,
        vendor_id text not null,
        amount_cents integer not null,
        orders_count integer not null,
        created_at_iso text not null
      );
      `,
      `
      create table if not exists vendor_balances (
        vendor_id text primary key,
        amount_cents integer not null,
        order_ids_json text not null
      );
      `,
      `
      create table if not exists customer_payment_index (
        customer_id text primary key,
        payment_ids_json text not null
      );
      `,
      `
      create table if not exists service_kv (
        service text not null,
        key text not null,
        value text not null,
        primary key(service, key)
      );
      `,
    ],
    down: [
      "drop table if exists service_kv",
      "drop table if exists customer_payment_index",
      "drop table if exists vendor_balances",
      "drop table if exists payouts",
      "drop table if exists invoices",
      "drop table if exists payments",
      "drop table if exists support_tickets",
      "drop table if exists reviews",
      "drop table if exists order_items",
      "drop table if exists orders",
      "drop table if exists order_cart_items",
      "drop table if exists order_carts",
    ],
  },
  {
    id: "002_indexes",
    up: [
      "create index if not exists idx_orders_customer_created on orders(customer_id, created_at_iso desc)",
      "create index if not exists idx_orders_vendor_status_created on orders(vendor_id, status, created_at_iso desc)",
      "create index if not exists idx_orders_status_created on orders(status, created_at_iso desc)",
      "create index if not exists idx_reviews_vendor_created on reviews(vendor_id, created_at_iso desc)",
      "create index if not exists idx_reviews_customer_created on reviews(customer_id, created_at_iso desc)",
      "create index if not exists idx_reviews_moderation_created on reviews(moderation_status, created_at_iso desc)",
      "create index if not exists idx_support_customer_created on support_tickets(customer_id, created_at_iso desc)",
      "create index if not exists idx_support_status_priority_created on support_tickets(status, priority, created_at_iso desc)",
      "create index if not exists idx_payments_customer_created on payments(customer_id, created_at_iso desc)",
      "create index if not exists idx_invoices_vendor_issued on invoices(vendor_id, issued_at_iso desc)",
      "create index if not exists idx_payouts_vendor_created on payouts(vendor_id, created_at_iso desc)",
    ],
    down: [
      "drop index if exists idx_payouts_vendor_created",
      "drop index if exists idx_invoices_vendor_issued",
      "drop index if exists idx_payments_customer_created",
      "drop index if exists idx_support_status_priority_created",
      "drop index if exists idx_support_customer_created",
      "drop index if exists idx_reviews_moderation_created",
      "drop index if exists idx_reviews_customer_created",
      "drop index if exists idx_reviews_vendor_created",
      "drop index if exists idx_orders_status_created",
      "drop index if exists idx_orders_vendor_status_created",
      "drop index if exists idx_orders_customer_created",
    ],
  },
  {
    id: "003_durability_and_wallets",
    up: [
      `
      create table if not exists rider_states (
        rider_id text primary key,
        latitude double precision not null,
        longitude double precision not null,
        availability text not null,
        updated_at_iso text not null
      );
      `,
      `
      create table if not exists notifications (
        id text primary key,
        actor_key text not null,
        title text not null,
        body text not null,
        order_id text null,
        created_at_iso text not null,
        is_read boolean not null default false
      );
      `,
      `
      create table if not exists push_tokens (
        actor_key text not null,
        token text not null,
        platform text not null,
        updated_at_iso text not null,
        primary key(actor_key, token)
      );
      `,
      `
      create table if not exists push_logs (
        id text primary key,
        actor_key text not null,
        token text not null,
        title text not null,
        body text not null,
        created_at_iso text not null
      );
      `,
      `
      create table if not exists audit_events (
        id text primary key,
        service text not null,
        actor_key text not null,
        actor_role text not null,
        action text not null,
        resource_type text not null,
        resource_id text null,
        outcome text not null,
        metadata_json text null,
        created_at_iso text not null
      );
      `,
      `
      create table if not exists wallet_balances (
        customer_id text primary key,
        balance_cents integer not null,
        updated_at_iso text not null
      );
      `,
      "alter table payments add column if not exists provider text not null default 'local'",
      "alter table payments add column if not exists provider_ref text null",
      "create index if not exists idx_notifications_actor_created on notifications(actor_key, created_at_iso desc)",
      "create index if not exists idx_push_logs_actor_created on push_logs(actor_key, created_at_iso desc)",
      "create index if not exists idx_audit_service_created on audit_events(service, created_at_iso desc)",
      "create index if not exists idx_audit_actor_created on audit_events(actor_key, created_at_iso desc)",
      "create index if not exists idx_payments_provider_created on payments(provider, created_at_iso desc)",
    ],
    down: [
      "drop index if exists idx_payments_provider_created",
      "drop index if exists idx_audit_actor_created",
      "drop index if exists idx_audit_service_created",
      "drop index if exists idx_push_logs_actor_created",
      "drop index if exists idx_notifications_actor_created",
      "alter table payments drop column if exists provider_ref",
      "alter table payments drop column if exists provider",
      "drop table if exists wallet_balances",
      "drop table if exists audit_events",
      "drop table if exists push_logs",
      "drop table if exists push_tokens",
      "drop table if exists notifications",
      "drop table if exists rider_states",
    ],
  },
];
