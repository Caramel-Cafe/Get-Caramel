import { CoreDatabase } from "@get-caramel/database";
import { CartItem, CustomerCart, OrderRecord, ReviewRecord, SupportTicketRecord } from "@get-caramel/types";
import { Injectable, Logger } from "@nestjs/common";

export type OrderState = {
  carts: Array<[string, CustomerCart]>;
  orders: OrderRecord[];
  reviews: ReviewRecord[];
  supportTickets: SupportTicketRecord[];
  riderStates: Array<[string, { riderId: string; latitude: number; longitude: number; availability: "ONLINE" | "BUSY" | "OFFLINE"; updatedAtIso: string }]>;
};

const ACTIVE_ORDER_STATUSES = ["PLACED", "ACCEPTED_BY_VENDOR", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "ON_THE_WAY"];

@Injectable()
export class OrderRepository {
  private readonly logger = new Logger(OrderRepository.name);
  private readonly db = new CoreDatabase({
    connectionString: process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL,
    log: (message: string) => this.logger.log(message),
  });
  private initialized = false;

  async loadState(): Promise<OrderState | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    const cartRows = await this.db.query("select * from order_carts");
    const cartItemRows = await this.db.query("select * from order_cart_items");
    const orderRows = await this.db.query("select * from orders order by created_at_iso desc");
    const orderItemRows = await this.db.query("select * from order_items");
    const reviews = (await this.db.query("select * from reviews order by created_at_iso desc")).map((row) => this.mapReview(row));
    const supportTickets = (await this.db.query("select * from support_tickets order by created_at_iso desc")).map((row) => this.mapSupportTicket(row));
    const riderStateRows = await this.db.query("select * from rider_states");

    const cartItemsByCustomer = new Map<string, CartItem[]>();
    for (const row of cartItemRows) {
      const customerId = String(row.customer_id);
      const current = cartItemsByCustomer.get(customerId) || [];
      current.push(this.mapCartItem(row));
      cartItemsByCustomer.set(customerId, current);
    }

    const carts: Array<[string, CustomerCart]> = cartRows.map((row) => {
      const customerId = String(row.customer_id);
      return [
        customerId,
        {
          customerId,
          vendorId: row.vendor_id ? String(row.vendor_id) : null,
          items: cartItemsByCustomer.get(customerId) || [],
          subtotalCents: Number(row.subtotal_cents),
          deliveryFeeCents: Number(row.delivery_fee_cents),
          totalCents: Number(row.total_cents),
          updatedAtIso: String(row.updated_at_iso),
        },
      ];
    });

    const orderItemsByOrder = new Map<string, CartItem[]>();
    for (const row of orderItemRows) {
      const orderId = String(row.order_id);
      const current = orderItemsByOrder.get(orderId) || [];
      current.push(this.mapCartItem(row));
      orderItemsByOrder.set(orderId, current);
    }

    const orders: OrderRecord[] = orderRows.map((row) => ({
      orderId: String(row.order_id),
      customerId: String(row.customer_id),
      vendorId: String(row.vendor_id),
      riderId: row.rider_id ? String(row.rider_id) : null,
      items: orderItemsByOrder.get(String(row.order_id)) || [],
      subtotalCents: Number(row.subtotal_cents),
      deliveryFeeCents: Number(row.delivery_fee_cents),
      totalCents: Number(row.total_cents),
      status: String(row.status) as OrderRecord["status"],
      addressLine: String(row.address_line),
      createdAtIso: String(row.created_at_iso),
      updatedAtIso: String(row.updated_at_iso),
    }));

    const riderStates: OrderState["riderStates"] = riderStateRows.map((row) => ([
      String(row.rider_id),
      {
        riderId: String(row.rider_id),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        availability: String(row.availability) as "ONLINE" | "BUSY" | "OFFLINE",
        updatedAtIso: String(row.updated_at_iso),
      },
    ]));

    return { carts, orders, reviews, supportTickets, riderStates };
  }

  async upsertCart(cart: CustomerCart): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;

    await this.db.query(
      "insert into order_carts (customer_id, vendor_id, subtotal_cents, delivery_fee_cents, total_cents, updated_at_iso) values ($1,$2,$3,$4,$5,$6) on conflict (customer_id) do update set vendor_id=excluded.vendor_id, subtotal_cents=excluded.subtotal_cents, delivery_fee_cents=excluded.delivery_fee_cents, total_cents=excluded.total_cents, updated_at_iso=excluded.updated_at_iso",
      [cart.customerId, cart.vendorId, cart.subtotalCents, cart.deliveryFeeCents, cart.totalCents, cart.updatedAtIso],
    );

    await this.db.query("delete from order_cart_items where customer_id = $1", [cart.customerId]);
    for (const item of cart.items) {
      await this.db.query(
        "insert into order_cart_items (customer_id, item_id, vendor_id, name, description, price_cents, quantity) values ($1,$2,$3,$4,$5,$6,$7)",
        [cart.customerId, item.itemId, item.vendorId, item.name, "", item.priceCents, item.quantity],
      );
    }
  }

  async deleteCart(customerId: string): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query("delete from order_cart_items where customer_id = $1", [customerId]);
    await this.db.query("delete from order_carts where customer_id = $1", [customerId]);
  }

  async upsertOrder(order: OrderRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;

    await this.db.query(
      "insert into orders (order_id, customer_id, vendor_id, rider_id, subtotal_cents, delivery_fee_cents, total_cents, status, address_line, created_at_iso, updated_at_iso) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (order_id) do update set rider_id=excluded.rider_id, subtotal_cents=excluded.subtotal_cents, delivery_fee_cents=excluded.delivery_fee_cents, total_cents=excluded.total_cents, status=excluded.status, address_line=excluded.address_line, updated_at_iso=excluded.updated_at_iso",
      [order.orderId, order.customerId, order.vendorId, order.riderId, order.subtotalCents, order.deliveryFeeCents, order.totalCents, order.status, order.addressLine, order.createdAtIso, order.updatedAtIso],
    );

    await this.db.query("delete from order_items where order_id = $1", [order.orderId]);
    for (const item of order.items) {
      await this.db.query(
        "insert into order_items (order_id, item_id, vendor_id, name, description, price_cents, quantity) values ($1,$2,$3,$4,$5,$6,$7)",
        [order.orderId, item.itemId, item.vendorId, item.name, "", item.priceCents, item.quantity],
      );
    }
  }

  async upsertReview(review: ReviewRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into reviews (review_id, order_id, vendor_id, customer_id, rating, comment, moderation_status, flagged_reason, created_at_iso) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (review_id) do update set rating=excluded.rating, comment=excluded.comment, moderation_status=excluded.moderation_status, flagged_reason=excluded.flagged_reason",
      [review.reviewId, review.orderId, review.vendorId, review.customerId, review.rating, review.comment, review.moderationStatus, review.flaggedReason || null, review.createdAtIso],
    );
  }

  async upsertSupportTicket(ticket: SupportTicketRecord): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into support_tickets (ticket_id, customer_id, order_id, subject, description, priority, status, admin_notes, created_at_iso, updated_at_iso) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (ticket_id) do update set subject=excluded.subject, description=excluded.description, priority=excluded.priority, status=excluded.status, admin_notes=excluded.admin_notes, updated_at_iso=excluded.updated_at_iso",
      [ticket.ticketId, ticket.customerId, ticket.orderId || null, ticket.subject, ticket.description, ticket.priority, ticket.status, ticket.adminNotes || null, ticket.createdAtIso, ticket.updatedAtIso],
    );
  }

  async upsertRiderState(state: {
    riderId: string;
    latitude: number;
    longitude: number;
    availability: "ONLINE" | "BUSY" | "OFFLINE";
    updatedAtIso: string;
  }): Promise<void> {
    await this.init();
    if (!this.db.isReady()) return;
    await this.db.query(
      "insert into rider_states (rider_id, latitude, longitude, availability, updated_at_iso) values ($1,$2,$3,$4,$5) on conflict (rider_id) do update set latitude=excluded.latitude, longitude=excluded.longitude, availability=excluded.availability, updated_at_iso=excluded.updated_at_iso",
      [state.riderId, state.latitude, state.longitude, state.availability, state.updatedAtIso],
    );
  }

  async getCustomerOrdersPaged(customerId: string, limit: number, offset: number): Promise<OrderRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    const rows = await this.db.query(
      "select * from orders where customer_id = $1 order by created_at_iso desc limit $2 offset $3",
      [customerId, limit, offset],
    );
    return this.mapOrdersWithItems(rows);
  }

  async getVendorQueuePaged(vendorId: string, limit: number, offset: number): Promise<OrderRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    const rows = await this.db.query(
      "select * from orders where vendor_id = $1 and status = any($2::text[]) order by created_at_iso desc limit $3 offset $4",
      [vendorId, ACTIVE_ORDER_STATUSES, limit, offset],
    );
    return this.mapOrdersWithItems(rows);
  }

  async getAdminRecentOrdersPaged(limit: number, offset: number): Promise<OrderRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    const rows = await this.db.query("select * from orders order by created_at_iso desc limit $1 offset $2", [limit, offset]);
    return this.mapOrdersWithItems(rows);
  }

  async getCustomerReviewsPaged(customerId: string, limit: number, offset: number): Promise<ReviewRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    return (await this.db.query(
      "select * from reviews where customer_id = $1 order by created_at_iso desc limit $2 offset $3",
      [customerId, limit, offset],
    )).map((row) => this.mapReview(row));
  }

  async getPendingReviewsPaged(limit: number, offset: number): Promise<ReviewRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    return (await this.db.query(
      "select * from reviews where moderation_status = 'PENDING' order by created_at_iso desc limit $1 offset $2",
      [limit, offset],
    )).map((row) => this.mapReview(row));
  }

  async getCustomerSupportTicketsPaged(customerId: string, limit: number, offset: number): Promise<SupportTicketRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    return (await this.db.query(
      "select * from support_tickets where customer_id = $1 order by created_at_iso desc limit $2 offset $3",
      [customerId, limit, offset],
    )).map((row) => this.mapSupportTicket(row));
  }

  async getAdminSupportTicketsPaged(limit: number, offset: number): Promise<SupportTicketRecord[] | null> {
    await this.init();
    if (!this.db.isReady()) return null;

    return (await this.db.query(
      "select * from support_tickets order by created_at_iso desc limit $1 offset $2",
      [limit, offset],
    )).map((row) => this.mapSupportTicket(row));
  }

  private async mapOrdersWithItems(orderRows: Array<Record<string, unknown>>): Promise<OrderRecord[]> {
    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((row) => String(row.order_id));
    const itemRows = await this.db.query("select * from order_items where order_id = any($1::text[])", [orderIds]);
    const byOrder = new Map<string, CartItem[]>();

    for (const row of itemRows) {
      const orderId = String(row.order_id);
      const current = byOrder.get(orderId) || [];
      current.push(this.mapCartItem(row));
      byOrder.set(orderId, current);
    }

    return orderRows.map((row) => ({
      orderId: String(row.order_id),
      customerId: String(row.customer_id),
      vendorId: String(row.vendor_id),
      riderId: row.rider_id ? String(row.rider_id) : null,
      items: byOrder.get(String(row.order_id)) || [],
      subtotalCents: Number(row.subtotal_cents),
      deliveryFeeCents: Number(row.delivery_fee_cents),
      totalCents: Number(row.total_cents),
      status: String(row.status) as OrderRecord["status"],
      addressLine: String(row.address_line),
      createdAtIso: String(row.created_at_iso),
      updatedAtIso: String(row.updated_at_iso),
    }));
  }

  private mapCartItem(row: Record<string, unknown>): CartItem {
    return {
      itemId: String(row.item_id),
      vendorId: String(row.vendor_id),
      name: String(row.name),
      priceCents: Number(row.price_cents),
      quantity: Number(row.quantity),
    };
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.db.init();
  }

  private mapReview(row: Record<string, unknown>): ReviewRecord {
    return {
      reviewId: String(row.review_id),
      orderId: String(row.order_id),
      vendorId: String(row.vendor_id),
      customerId: String(row.customer_id),
      rating: Number(row.rating),
      comment: String(row.comment),
      moderationStatus: String(row.moderation_status) as ReviewRecord["moderationStatus"],
      flaggedReason: row.flagged_reason ? String(row.flagged_reason) : undefined,
      createdAtIso: String(row.created_at_iso),
    };
  }

  private mapSupportTicket(row: Record<string, unknown>): SupportTicketRecord {
    return {
      ticketId: String(row.ticket_id),
      customerId: String(row.customer_id),
      orderId: row.order_id ? String(row.order_id) : undefined,
      subject: String(row.subject),
      description: String(row.description),
      priority: String(row.priority) as SupportTicketRecord["priority"],
      status: String(row.status) as SupportTicketRecord["status"],
      adminNotes: row.admin_notes ? String(row.admin_notes) : undefined,
      createdAtIso: String(row.created_at_iso),
      updatedAtIso: String(row.updated_at_iso),
    };
  }
}
