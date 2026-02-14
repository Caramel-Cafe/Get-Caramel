create table if not exists order_carts (
  customer_id text primary key,
  vendor_id text null,
  subtotal_cents integer not null,
  delivery_fee_cents integer not null,
  total_cents integer not null,
  updated_at_iso text not null
);

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

create table if not exists payouts (
  payout_id text primary key,
  vendor_id text not null,
  amount_cents integer not null,
  orders_count integer not null,
  created_at_iso text not null
);

create table if not exists vendor_balances (
  vendor_id text primary key,
  amount_cents integer not null,
  order_ids_json text not null
);

create table if not exists customer_payment_index (
  customer_id text primary key,
  payment_ids_json text not null
);

create table if not exists service_kv (
  service text not null,
  key text not null,
  value text not null,
  primary key(service, key)
);
