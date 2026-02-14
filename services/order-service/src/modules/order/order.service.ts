import {
  AdminOverviewResponse,
  AddCartItemRequest,
  AuditActorRole,
  AuditOutcome,
  CartItem,
  CheckoutRequest,
  CreateReviewRequest,
  CreateSupportTicketRequest,
  CustomerCart,
  CustomerOrdersResponse,
  DiscoveryResponse,
  DiscoveryVendor,
  DispatchSuggestionResponse,
  OrderRecord,
  OrderStatus,
  RealtimeOrderEvent,
  ReviewRecord,
  RiderAvailability,
  RiderDispatchScore,
  RiderLocationUpdateRequest,
  RiderStateSnapshot,
  RiderNavigationSnapshot,
  RiderTaskResponse,
  SupportTicketRecord,
  SupportTicketStatus,
  VendorQueueResponse,
  VendorReviewSummary,
} from "@get-caramel/types";
import { IdempotencyStore } from "@get-caramel/persistence";
import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrderRepository } from "./repository/order.repository";
import { RealtimeEventsService } from "../realtime/realtime-events.service";

type MenuIndex = {
  [itemId: string]: CartItem;
};

type RiderState = {
  riderId: string;
  latitude: number;
  longitude: number;
  availability: RiderAvailability;
  updatedAtIso: string;
};

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private readonly riders = ["rdr_001", "rdr_002", "rdr_003"];
  private readonly idempotency = new IdempotencyStore({
    namespace: "order-service",
    ttlSeconds: 900,
    postgresUrl: process.env.ORDER_DATABASE_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    log: (message) => this.logger.log(message),
  });

  private readonly vendors: DiscoveryVendor[] = [
    {
      vendorId: "vnd_001",
      name: "Saffron Street Kitchen",
      cuisine: "Indian",
      etaMinutes: 18,
      deliveryFeeCents: 199,
      rating: 4.8,
      menu: [
        { itemId: "itm_001", vendorId: "vnd_001", name: "Butter Chicken Bowl", description: "Rich tomato butter sauce", priceCents: 1299 },
        { itemId: "itm_002", vendorId: "vnd_001", name: "Paneer Tikka Wrap", description: "Smoked paneer and mint chutney", priceCents: 999 },
      ],
    },
    {
      vendorId: "vnd_002",
      name: "Roma Fire Pizza",
      cuisine: "Italian",
      etaMinutes: 22,
      deliveryFeeCents: 149,
      rating: 4.6,
      menu: [
        { itemId: "itm_003", vendorId: "vnd_002", name: "Margherita 12in", description: "San marzano, basil, mozzarella", priceCents: 1399 },
        { itemId: "itm_004", vendorId: "vnd_002", name: "Pepperoni 12in", description: "Classic spicy pepperoni", priceCents: 1599 },
      ],
    },
    {
      vendorId: "vnd_003",
      name: "Tokyo Rice & Roll",
      cuisine: "Japanese",
      etaMinutes: 16,
      deliveryFeeCents: 249,
      rating: 4.7,
      menu: [
        { itemId: "itm_005", vendorId: "vnd_003", name: "Salmon Poke", description: "Fresh salmon with sesame rice", priceCents: 1499 },
        { itemId: "itm_006", vendorId: "vnd_003", name: "Chicken Katsu Box", description: "Crispy katsu with slaw", priceCents: 1399 },
      ],
    },
  ];

  private readonly carts = new Map<string, CustomerCart>();
  private readonly orders: OrderRecord[] = [];
  private readonly reviews: ReviewRecord[] = [];
  private readonly supportTickets: SupportTicketRecord[] = [];
  private readonly riderStates = new Map<string, RiderState>([
    ["rdr_001", { riderId: "rdr_001", latitude: 40.748, longitude: -73.985, availability: "ONLINE", updatedAtIso: new Date().toISOString() }],
    ["rdr_002", { riderId: "rdr_002", latitude: 40.753, longitude: -73.977, availability: "ONLINE", updatedAtIso: new Date().toISOString() }],
    ["rdr_003", { riderId: "rdr_003", latitude: 40.742, longitude: -73.995, availability: "ONLINE", updatedAtIso: new Date().toISOString() }],
  ]);
  private readonly vendorCoordinates = new Map<string, { latitude: number; longitude: number }>([
    ["vnd_001", { latitude: 40.751, longitude: -73.989 }],
    ["vnd_002", { latitude: 40.755, longitude: -73.983 }],
    ["vnd_003", { latitude: 40.744, longitude: -73.979 }],
  ]);

  constructor(
    private readonly realtime: RealtimeEventsService,
    private readonly notifications: NotificationsService,
    private readonly auditService: AuditService,
    private readonly orderRepository: OrderRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const state = await this.orderRepository.loadState();
    if (!state) return;

    for (const [customerId, cart] of state.carts) this.carts.set(customerId, cart);
    this.orders.splice(0, this.orders.length, ...state.orders);
    this.reviews.splice(0, this.reviews.length, ...state.reviews);
    this.supportTickets.splice(0, this.supportTickets.length, ...state.supportTickets);
    if (state.riderStates.length > 0) {
      this.riderStates.clear();
      for (const [riderId, riderState] of state.riderStates) {
        this.riderStates.set(riderId, riderState);
      }
    }
    this.logger.log("Hydrated order-service state from repository");
  }

  getDiscovery(): DiscoveryResponse {
    return {
      vendors: this.vendors,
      generatedAtIso: new Date().toISOString(),
    };
  }

  getCart(customerId: string): CustomerCart {
    return this.carts.get(customerId) || this.emptyCart(customerId);
  }

  addCartItem(input: AddCartItemRequest): CustomerCart {
    const vendor = this.vendors.find((candidate) => candidate.vendorId === input.vendorId);
    if (!vendor) throw new NotFoundException("Vendor not found");

    const menuIndex = this.buildMenuIndex(vendor.vendorId);
    const menuItem = menuIndex[input.itemId];
    if (!menuItem) throw new NotFoundException("Item not found");

    const current = this.carts.get(input.customerId) || this.emptyCart(input.customerId);

    if (current.vendorId && current.vendorId !== input.vendorId) {
      throw new BadRequestException("Cart already contains items from another vendor");
    }

    const existingItem = current.items.find((item) => item.itemId === input.itemId);
    if (existingItem) {
      existingItem.quantity += input.quantity;
    } else {
      current.items.push({ ...menuItem, quantity: input.quantity });
    }

    current.vendorId = input.vendorId;
    const next = this.withTotals(current, vendor.deliveryFeeCents);
    this.carts.set(input.customerId, next);
    this.persistCart(next);
    return next;
  }

  checkout(input: CheckoutRequest): OrderRecord {
    const cart = this.carts.get(input.customerId);
    if (!cart || cart.items.length === 0 || !cart.vendorId) {
      throw new BadRequestException("Cart is empty");
    }

    const now = new Date().toISOString();
    const order: OrderRecord = {
      orderId: `ord_${randomUUID().slice(0, 12)}`,
      customerId: input.customerId,
      vendorId: cart.vendorId,
      riderId: null,
      items: cart.items,
      subtotalCents: cart.subtotalCents,
      deliveryFeeCents: cart.deliveryFeeCents,
      totalCents: cart.totalCents,
      status: "PLACED",
      createdAtIso: now,
      updatedAtIso: now,
      addressLine: input.addressLine,
    };

    this.orders.unshift(order);
    const clearedCart = this.emptyCart(input.customerId);
    this.carts.set(input.customerId, clearedCart);

    this.publishOrderEvent("order.created", order);
    this.notifyOrder(order, "Order placed", `Your order ${order.orderId} was placed.`);
    this.persistOrder(order);
    this.persistCart(clearedCart);

    return order;
  }

  async checkoutIdempotent(input: CheckoutRequest, idempotencyKey?: string): Promise<OrderRecord> {
    if (!idempotencyKey) return this.checkout(input);
    const scopedKey = `checkout:${input.customerId}:${idempotencyKey}`;
    return this.idempotency.execute(scopedKey, async () => this.checkout(input));
  }

  getVendorQueue(vendorId: string): VendorQueueResponse {
    const activeOrders = this.orders.filter(
      (order) => order.vendorId === vendorId && order.status !== "DELIVERED" && order.status !== "CANCELED",
    );

    return { vendorId, activeOrders };
  }

  async getVendorQueuePaged(vendorId: string, limit: number, offset: number): Promise<VendorQueueResponse> {
    const dbRows = await this.orderRepository.getVendorQueuePaged(vendorId, limit, offset);
    if (dbRows) return { vendorId, activeOrders: dbRows };
    const activeOrders = this.orders.filter(
      (order) => order.vendorId === vendorId && order.status !== "DELIVERED" && order.status !== "CANCELED",
    );
    return { vendorId, activeOrders: activeOrders.slice(offset, offset + limit) };
  }

  vendorAccept(orderId: string): OrderRecord {
    const order = this.transitionOrder(orderId, ["PLACED"], "ACCEPTED_BY_VENDOR");
    this.notifyOrder(order, "Vendor accepted", `Vendor accepted order ${order.orderId}.`);
    return order;
  }

  vendorReject(orderId: string): OrderRecord {
    const order = this.transitionOrder(orderId, ["PLACED", "ACCEPTED_BY_VENDOR", "PREPARING", "READY_FOR_PICKUP"], "CANCELED");
    this.notifyOrder(order, "Order canceled", `Order ${order.orderId} was canceled by vendor.`);
    return order;
  }

  vendorMarkPreparing(orderId: string): OrderRecord {
    const order = this.transitionOrder(orderId, ["ACCEPTED_BY_VENDOR"], "PREPARING");
    this.notifyOrder(order, "Preparing order", `Order ${order.orderId} is now being prepared.`);
    return order;
  }

  vendorMarkReady(orderId: string): OrderRecord {
    const order = this.transitionOrder(orderId, ["ACCEPTED_BY_VENDOR", "PREPARING"], "READY_FOR_PICKUP");
    if (!order.riderId) {
      const autoRider = this.pickBestRiderForOrder(order);
      if (autoRider) {
        order.riderId = autoRider;
        order.updatedAtIso = new Date().toISOString();
        this.setRiderAvailability(autoRider, "BUSY");
      }
    }

    this.publishOrderEvent("order.updated", order);
    this.notifyOrder(order, "Ready for pickup", `Order ${order.orderId} is ready for rider pickup.`);
    return order;
  }

  assignRider(orderId: string, riderId: string): OrderRecord {
    if (!this.riders.includes(riderId)) {
      throw new BadRequestException("Unknown riderId");
    }

    const order = this.getOrder(orderId);
    if (order.status !== "READY_FOR_PICKUP" && order.status !== "PICKED_UP" && order.status !== "ON_THE_WAY") {
      throw new BadRequestException("Order not eligible for rider assignment");
    }

    order.riderId = riderId;
    order.updatedAtIso = new Date().toISOString();
    this.setRiderAvailability(riderId, "BUSY");

    this.publishOrderEvent("order.updated", order);
    this.notifyOrder(order, "Rider assigned", `Rider ${riderId} assigned for order ${order.orderId}.`);
    return order;
  }

  getRiderTasks(riderId: string): RiderTaskResponse {
    const activeOrders = this.orders.filter(
      (order) => order.riderId === riderId && order.status !== "DELIVERED" && order.status !== "CANCELED",
    );

    return { riderId, activeOrders };
  }

  getRiderNavigation(riderId: string): RiderNavigationSnapshot {
    const state = this.getRiderState(riderId);
    const currentOrder = this.orders.find((order) =>
      order.riderId === riderId && order.status !== "DELIVERED" && order.status !== "CANCELED");
    if (!currentOrder) {
      return {
        riderId,
        orderId: null,
        status: "IDLE",
        distanceKmRemaining: 0,
        etaMinutes: 0,
        route: [{ latitude: state.latitude, longitude: state.longitude, label: "Current Position" }],
        nextInstruction: "Waiting for assignment",
        updatedAtIso: new Date().toISOString(),
      };
    }

    const route = this.buildNavigationRoute(currentOrder, state);
    let distanceKmRemaining = 0;
    for (let i = 0; i < route.length - 1; i += 1) {
      distanceKmRemaining += this.haversineKm(route[i].latitude, route[i].longitude, route[i + 1].latitude, route[i + 1].longitude);
    }

    const etaMinutes = Math.max(1, Math.round((distanceKmRemaining / 0.45)));
    const nextInstruction = currentOrder.status === "READY_FOR_PICKUP"
      ? "Proceed to pickup vendor"
      : currentOrder.status === "PICKED_UP"
        ? "Start trip to customer dropoff"
        : "Continue to customer";

    return {
      riderId,
      orderId: currentOrder.orderId,
      status: currentOrder.status,
      distanceKmRemaining: Number(distanceKmRemaining.toFixed(2)),
      etaMinutes,
      route,
      nextInstruction,
      updatedAtIso: new Date().toISOString(),
    };
  }

  updateRiderLocation(input: RiderLocationUpdateRequest): RiderStateSnapshot {
    if (!this.riders.includes(input.riderId)) {
      throw new BadRequestException("Unknown riderId");
    }

    const current = this.riderStates.get(input.riderId);
    const next: RiderState = {
      riderId: input.riderId,
      latitude: input.latitude,
      longitude: input.longitude,
      availability: input.availability || current?.availability || "ONLINE",
      updatedAtIso: new Date().toISOString(),
    };
    this.riderStates.set(input.riderId, next);
    this.persistRiderState(next);
    return this.toRiderSnapshot(next);
  }

  getRiderState(riderId: string): RiderStateSnapshot {
    if (!this.riders.includes(riderId)) {
      throw new BadRequestException("Unknown riderId");
    }
    const state = this.riderStates.get(riderId);
    if (!state) throw new NotFoundException("Rider state not found");
    return this.toRiderSnapshot(state);
  }

  suggestDispatch(orderId: string): DispatchSuggestionResponse {
    const order = this.getOrder(orderId);
    return this.buildDispatchSuggestion(order);
  }

  riderPickup(orderId: string, riderId: string): OrderRecord {
    const order = this.getOrder(orderId);
    this.assertRider(order, riderId);
    this.assertAllowedStatus(order.status, ["READY_FOR_PICKUP"]);

    order.status = "PICKED_UP";
    order.updatedAtIso = new Date().toISOString();

    this.publishOrderEvent("order.updated", order);
    this.notifyOrder(order, "Order picked up", `Rider picked up order ${order.orderId}.`);
    return order;
  }

  riderStartTransit(orderId: string, riderId: string): OrderRecord {
    const order = this.getOrder(orderId);
    this.assertRider(order, riderId);
    this.assertAllowedStatus(order.status, ["PICKED_UP"]);

    order.status = "ON_THE_WAY";
    order.updatedAtIso = new Date().toISOString();
    this.setRiderAvailability(riderId, "BUSY");

    this.publishOrderEvent("order.updated", order);
    this.notifyOrder(order, "Order on the way", `Order ${order.orderId} is now on the way.`);
    return order;
  }

  riderDeliver(orderId: string, riderId: string): OrderRecord {
    const order = this.getOrder(orderId);
    this.assertRider(order, riderId);
    this.assertAllowedStatus(order.status, ["ON_THE_WAY", "PICKED_UP"]);

    order.status = "DELIVERED";
    order.updatedAtIso = new Date().toISOString();
    this.setRiderAvailability(riderId, "ONLINE");

    this.publishOrderEvent("order.updated", order);
    this.notifyOrder(order, "Delivered", `Order ${order.orderId} was delivered.`);
    return order;
  }

  createReview(input: CreateReviewRequest): ReviewRecord {
    const order = this.getOrder(input.orderId);
    if (order.customerId !== input.customerId) {
      throw new BadRequestException("Order does not belong to this customer");
    }
    if (order.status !== "DELIVERED") {
      throw new BadRequestException("Review can only be submitted after delivery");
    }
    if (this.reviews.find((r) => r.orderId === input.orderId && r.customerId === input.customerId)) {
      throw new BadRequestException("Review already exists for this order");
    }

    const flaggedReason = this.detectModerationFlags(input.comment);
    const moderationStatus = flaggedReason ? "PENDING" : "APPROVED";

    const review: ReviewRecord = {
      reviewId: `rvw_${randomUUID().slice(0, 10)}`,
      orderId: input.orderId,
      vendorId: order.vendorId,
      customerId: input.customerId,
      rating: input.rating,
      comment: input.comment,
      moderationStatus,
      flaggedReason: flaggedReason || undefined,
      createdAtIso: new Date().toISOString(),
    };

    this.reviews.unshift(review);

    this.notifications.create(`customer:${review.customerId}`, "Review submitted", `Review ${review.reviewId} received.`);
    this.notifications.create(`vendor:${review.vendorId}`, "New customer review", `Review ${review.reviewId} was submitted.`);

    if (review.moderationStatus === "PENDING") {
      this.notifications.create("admin:ops", "Review moderation needed", `Review ${review.reviewId} requires moderation.`);
    }

    this.persistReview(review);
    return review;
  }

  getVendorReviewSummary(vendorId: string): VendorReviewSummary {
    const approved = this.reviews.filter((r) => r.vendorId === vendorId && r.moderationStatus === "APPROVED");
    const totalReviews = approved.length;
    const averageRating = totalReviews === 0
      ? 0
      : Number((approved.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(2));

    return {
      vendorId,
      averageRating,
      totalReviews,
      reviews: this.reviews.filter((r) => r.vendorId === vendorId).slice(0, 100),
    };
  }

  getCustomerReviews(customerId: string): ReviewRecord[] {
    return this.reviews.filter((r) => r.customerId === customerId).slice(0, 100);
  }

  async getCustomerReviewsPaged(customerId: string, limit: number, offset: number): Promise<ReviewRecord[]> {
    const dbRows = await this.orderRepository.getCustomerReviewsPaged(customerId, limit, offset);
    if (dbRows) return dbRows;
    return this.reviews.filter((r) => r.customerId === customerId).slice(offset, offset + limit);
  }

  getPendingReviews(): ReviewRecord[] {
    return this.reviews.filter((r) => r.moderationStatus === "PENDING").slice(0, 100);
  }

  async getPendingReviewsPaged(limit: number, offset: number): Promise<ReviewRecord[]> {
    const dbRows = await this.orderRepository.getPendingReviewsPaged(limit, offset);
    if (dbRows) return dbRows;
    return this.reviews.filter((r) => r.moderationStatus === "PENDING").slice(offset, offset + limit);
  }

  approveReview(reviewId: string): ReviewRecord {
    const review = this.getReview(reviewId);
    review.moderationStatus = "APPROVED";
    review.flaggedReason = undefined;

    this.notifications.create(`customer:${review.customerId}`, "Review approved", `Review ${review.reviewId} is now public.`);
    this.notifications.create(`vendor:${review.vendorId}`, "Review approved", `A review for your store was approved.`);

    this.persistReview(review);
    return review;
  }

  rejectReview(reviewId: string): ReviewRecord {
    const review = this.getReview(reviewId);
    review.moderationStatus = "REJECTED";

    this.notifications.create(`customer:${review.customerId}`, "Review rejected", `Review ${review.reviewId} did not meet policy.`);
    this.persistReview(review);
    return review;
  }

  createSupportTicket(input: CreateSupportTicketRequest): SupportTicketRecord {
    const ticket: SupportTicketRecord = {
      ticketId: `tkt_${randomUUID().slice(0, 10)}`,
      customerId: input.customerId,
      orderId: input.orderId,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      status: "OPEN",
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    this.supportTickets.unshift(ticket);

    this.notifications.create(`customer:${ticket.customerId}`, "Support ticket opened", `Ticket ${ticket.ticketId} is open.`);
    this.notifications.create("admin:ops", "New support ticket", `Ticket ${ticket.ticketId} requires triage.`);

    this.persistTicket(ticket);
    return ticket;
  }

  getCustomerSupportTickets(customerId: string): SupportTicketRecord[] {
    return this.supportTickets.filter((t) => t.customerId === customerId).slice(0, 100);
  }

  async getCustomerSupportTicketsPaged(customerId: string, limit: number, offset: number): Promise<SupportTicketRecord[]> {
    const dbRows = await this.orderRepository.getCustomerSupportTicketsPaged(customerId, limit, offset);
    if (dbRows) return dbRows;
    return this.supportTickets.filter((t) => t.customerId === customerId).slice(offset, offset + limit);
  }

  getAdminSupportTickets(): SupportTicketRecord[] {
    return this.supportTickets.slice(0, 200);
  }

  async getAdminSupportTicketsPaged(limit: number, offset: number): Promise<SupportTicketRecord[]> {
    const dbRows = await this.orderRepository.getAdminSupportTicketsPaged(limit, offset);
    if (dbRows) return dbRows;
    return this.supportTickets.slice(offset, offset + limit);
  }

  updateSupportTicket(ticketId: string, status: SupportTicketStatus, adminNotes?: string): SupportTicketRecord {
    const ticket = this.supportTickets.find((t) => t.ticketId === ticketId);
    if (!ticket) throw new NotFoundException("Support ticket not found");

    ticket.status = status;
    ticket.adminNotes = adminNotes || ticket.adminNotes;
    ticket.updatedAtIso = new Date().toISOString();

    this.notifications.create(`customer:${ticket.customerId}`, "Support ticket updated", `Ticket ${ticket.ticketId} is now ${ticket.status}.`);
    this.persistTicket(ticket);
    return ticket;
  }

  getCustomerOrders(customerId: string): CustomerOrdersResponse {
    const orders = this.orders.filter((order) => order.customerId === customerId);
    return { customerId, orders };
  }

  async getCustomerOrdersPaged(customerId: string, limit: number, offset: number): Promise<CustomerOrdersResponse> {
    const dbRows = await this.orderRepository.getCustomerOrdersPaged(customerId, limit, offset);
    if (dbRows) return { customerId, orders: dbRows };
    return { customerId, orders: this.orders.filter((order) => order.customerId === customerId).slice(offset, offset + limit) };
  }

  getAdminOverview(): AdminOverviewResponse {
    const completedOrders = this.orders.filter((order) => order.status === "DELIVERED").length;
    const openOrders = this.orders.length - completedOrders;
    const totalGMVCents = this.orders.reduce((sum, order) => sum + order.totalCents, 0);

    return {
      openOrders,
      completedOrders,
      totalGMVCents,
      activeVendors: this.vendors.length,
    };
  }

  getAdminRecentOrders(): OrderRecord[] {
    return this.orders.slice(0, 25);
  }

  async getAdminRecentOrdersPaged(limit: number, offset: number): Promise<OrderRecord[]> {
    const dbRows = await this.orderRepository.getAdminRecentOrdersPaged(limit, offset);
    if (dbRows) return dbRows;
    return this.orders.slice(offset, offset + limit);
  }

  private transitionOrder(orderId: string, allowed: OrderStatus[], next: OrderStatus): OrderRecord {
    const order = this.getOrder(orderId);
    this.assertAllowedStatus(order.status, allowed);
    order.status = next;
    order.updatedAtIso = new Date().toISOString();

    this.publishOrderEvent("order.updated", order);
    this.persistOrder(order);
    return order;
  }

  private getOrder(orderId: string): OrderRecord {
    const order = this.orders.find((candidate) => candidate.orderId === orderId);
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private getReview(reviewId: string): ReviewRecord {
    const review = this.reviews.find((candidate) => candidate.reviewId === reviewId);
    if (!review) throw new NotFoundException("Review not found");
    return review;
  }

  private detectModerationFlags(comment: string): string | null {
    const normalized = comment.toLowerCase();
    const bannedSignals = ["fraud", "poison", "scam", "abuse"];
    const found = bannedSignals.find((token) => normalized.includes(token));
    return found ? `contains_${found}` : null;
  }

  private assertAllowedStatus(current: OrderStatus, allowed: OrderStatus[]): void {
    if (!allowed.includes(current)) {
      throw new BadRequestException(`Invalid status transition from ${current}`);
    }
  }

  private assertRider(order: OrderRecord, riderId: string): void {
    if (order.riderId !== riderId) {
      throw new BadRequestException("Order is not assigned to this rider");
    }
  }

  private setRiderAvailability(riderId: string, availability: RiderAvailability): void {
    const current = this.riderStates.get(riderId);
    if (!current) return;
    const next = {
      ...current,
      availability,
      updatedAtIso: new Date().toISOString(),
    };
    this.riderStates.set(riderId, next);
    this.persistRiderState(next);
  }

  private activeOrdersByRider(riderId: string): number {
    return this.orders.filter(
      (order) => order.riderId === riderId && order.status !== "DELIVERED" && order.status !== "CANCELED",
    ).length;
  }

  private toRiderSnapshot(state: RiderState): RiderStateSnapshot {
    return {
      riderId: state.riderId,
      latitude: state.latitude,
      longitude: state.longitude,
      availability: state.availability,
      activeOrders: this.activeOrdersByRider(state.riderId),
      updatedAtIso: state.updatedAtIso,
    };
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (value: number): number => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      (Math.sin(dLat / 2) ** 2) +
      (Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLng / 2) ** 2));
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private pickBestRiderForOrder(order: OrderRecord): string | null {
    return this.buildDispatchSuggestion(order).recommendedRiderId;
  }

  private buildDispatchSuggestion(order: OrderRecord): DispatchSuggestionResponse {
    const vendorPoint = this.vendorCoordinates.get(order.vendorId);
    const candidates: RiderDispatchScore[] = [];
    for (const riderId of this.riders) {
      const state = this.riderStates.get(riderId);
      const activeOrders = this.activeOrdersByRider(riderId);
      const availability: RiderAvailability = state?.availability || (activeOrders > 0 ? "BUSY" : "ONLINE");
      if (availability === "OFFLINE") continue;

      const distanceKm = vendorPoint && state
        ? this.haversineKm(vendorPoint.latitude, vendorPoint.longitude, state.latitude, state.longitude)
        : 4;
      const loadPenalty = Math.min(activeOrders / 4, 1);
      const distancePenalty = Math.min(distanceKm / 8, 1);
      const availabilityPenalty = availability === "BUSY" ? 0.25 : 0;
      const score = Number((1.25 - (loadPenalty * 0.6) - (distancePenalty * 0.5) - availabilityPenalty).toFixed(4));

      candidates.push({
        riderId,
        availability,
        activeOrders,
        distanceKm: Number(distanceKm.toFixed(2)),
        score,
      });
    }
    candidates.sort((a, b) => b.score - a.score);

    return {
      orderId: order.orderId,
      recommendedRiderId: candidates[0]?.riderId || null,
      candidates,
      computedAtIso: new Date().toISOString(),
    };
  }

  private buildMenuIndex(vendorId: string): MenuIndex {
    const vendor = this.vendors.find((candidate) => candidate.vendorId === vendorId);
    if (!vendor) return {};

    return vendor.menu.reduce<MenuIndex>((acc, item) => {
      acc[item.itemId] = { ...item, quantity: 1 };
      return acc;
    }, {});
  }

  private withTotals(cart: CustomerCart, deliveryFeeCents: number): CustomerCart {
    const subtotalCents = cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
    const totalCents = subtotalCents + deliveryFeeCents;

    return {
      ...cart,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      updatedAtIso: new Date().toISOString(),
    };
  }

  private buildNavigationRoute(order: OrderRecord, riderState: RiderStateSnapshot): Array<{ latitude: number; longitude: number; label: string }> {
    const vendor = this.vendorCoordinates.get(order.vendorId) || { latitude: riderState.latitude, longitude: riderState.longitude };
    const dropoff = this.addressToPoint(order.addressLine);
    if (order.status === "READY_FOR_PICKUP") {
      return [
        { latitude: riderState.latitude, longitude: riderState.longitude, label: "Current Position" },
        { latitude: vendor.latitude, longitude: vendor.longitude, label: "Pickup Vendor" },
        { latitude: dropoff.latitude, longitude: dropoff.longitude, label: "Customer Dropoff" },
      ];
    }

    if (order.status === "PICKED_UP" || order.status === "ON_THE_WAY") {
      return [
        { latitude: riderState.latitude, longitude: riderState.longitude, label: "Current Position" },
        { latitude: dropoff.latitude, longitude: dropoff.longitude, label: "Customer Dropoff" },
      ];
    }

    return [
      { latitude: riderState.latitude, longitude: riderState.longitude, label: "Current Position" },
    ];
  }

  private addressToPoint(addressLine: string): { latitude: number; longitude: number } {
    const baseLatitude = 40.74;
    const baseLongitude = -73.99;
    let hash = 0;
    for (let i = 0; i < addressLine.length; i += 1) {
      hash = ((hash << 5) - hash) + addressLine.charCodeAt(i);
      hash |= 0;
    }
    const latitude = baseLatitude + ((hash % 400) / 10000);
    const longitude = baseLongitude + (((hash >> 3) % 400) / 10000);
    return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
  }

  private emptyCart(customerId: string): CustomerCart {
    return {
      customerId,
      vendorId: null,
      items: [],
      subtotalCents: 0,
      deliveryFeeCents: 0,
      totalCents: 0,
      updatedAtIso: new Date().toISOString(),
    };
  }

  private persistCart(cart: CustomerCart): void {
    void this.orderRepository.upsertCart(cart)
      .catch((error: unknown) => this.logger.warn(`Persist cart failed: ${String(error)}`));
  }

  private persistOrder(order: OrderRecord): void {
    void this.orderRepository.upsertOrder(order)
      .catch((error: unknown) => this.logger.warn(`Persist order failed: ${String(error)}`));
  }

  private persistReview(review: ReviewRecord): void {
    void this.orderRepository.upsertReview(review)
      .catch((error: unknown) => this.logger.warn(`Persist review failed: ${String(error)}`));
  }

  private persistTicket(ticket: SupportTicketRecord): void {
    void this.orderRepository.upsertSupportTicket(ticket)
      .catch((error: unknown) => this.logger.warn(`Persist support ticket failed: ${String(error)}`));
  }

  private persistRiderState(state: RiderState): void {
    void this.orderRepository.upsertRiderState(state)
      .catch((error: unknown) => this.logger.warn(`Persist rider state failed: ${String(error)}`));
  }

  private audit(
    actorKey: string,
    action: string,
    outcome: AuditOutcome,
    resourceType: string,
    resourceId?: string,
    metadata?: Record<string, string | number | boolean>,
  ): void {
    const actorRole: AuditActorRole =
      actorKey.startsWith("customer:") ? "customer" :
      actorKey.startsWith("vendor:") ? "vendor" :
      actorKey.startsWith("rider:") ? "rider" :
      actorKey.startsWith("admin:") ? "admin" : "system";

    this.auditService.record({
      actorKey,
      actorRole,
      action,
      resourceType,
      resourceId,
      outcome,
      metadata,
    });
  }

  private actorKeys(order: OrderRecord): string[] {
    const keys = [
      `customer:${order.customerId}`,
      `vendor:${order.vendorId}`,
      "admin:ops",
    ];

    if (order.riderId) keys.push(`rider:${order.riderId}`);
    return keys;
  }

  private publishOrderEvent(type: "order.created" | "order.updated", order: OrderRecord): void {
    const event: RealtimeOrderEvent = {
      type,
      order,
      emittedAtIso: new Date().toISOString(),
      targetActorKeys: this.actorKeys(order),
    };

    this.realtime.emit(event);
  }

  private notifyOrder(order: OrderRecord, title: string, body: string): void {
    const keys = this.actorKeys(order);
    for (const actorKey of keys) {
      this.notifications.create(actorKey, title, body, order.orderId);
    }
    this.audit("system", "order.notify", "SUCCESS", "order", order.orderId, { title });
    this.persistOrder(order);
  }
}





