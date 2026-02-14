import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import {
  AdminOverviewResponse,
  CustomerCart,
  CustomerOrdersResponse,
  DispatchSuggestionResponse,
  DiscoveryResponse,
  OrderRecord,
  ReviewRecord,
  RiderStateSnapshot,
  RiderNavigationSnapshot,
  RiderTaskResponse,
  SupportTicketRecord,
  VendorQueueResponse,
  VendorReviewSummary,
} from "@get-caramel/types";
import { OrderService } from "./order.service";
import {
  AddCartItemDto,
  AssignRiderDto,
  CheckoutDto,
  CreateReviewDto,
  CreateSupportTicketDto,
  RiderLocationUpdateDto,
  RiderOrderActionDto,
  UpdateSupportTicketDto,
} from "./dto/order.dto";

@Controller("orders")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get("discovery")
  discovery(): DiscoveryResponse {
    return this.orderService.getDiscovery();
  }

  @Get("cart/:customerId")
  cart(@Param("customerId") customerId: string): CustomerCart {
    return this.orderService.getCart(customerId);
  }

  @Post("cart/items")
  addCartItem(@Body() dto: AddCartItemDto): CustomerCart {
    return this.orderService.addCartItem(dto);
  }

  @Post("checkout")
  async checkout(
    @Body() dto: CheckoutDto,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ): Promise<OrderRecord> {
    return this.orderService.checkoutIdempotent(dto, idempotencyKey);
  }

  @Get("customer/:customerId")
  customerOrders(@Param("customerId") customerId: string): CustomerOrdersResponse {
    return this.orderService.getCustomerOrders(customerId);
  }

  @Get("customer/:customerId/paged")
  async customerOrdersPaged(
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<CustomerOrdersResponse> {
    return this.orderService.getCustomerOrdersPaged(customerId, Number(limit || 25), Number(offset || 0));
  }

  @Get("customer/:customerId/reviews")
  customerReviews(@Param("customerId") customerId: string): ReviewRecord[] {
    return this.orderService.getCustomerReviews(customerId);
  }

  @Get("customer/:customerId/reviews/paged")
  async customerReviewsPaged(
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<ReviewRecord[]> {
    return this.orderService.getCustomerReviewsPaged(customerId, Number(limit || 25), Number(offset || 0));
  }

  @Get("customer/:customerId/tickets")
  customerTickets(@Param("customerId") customerId: string): SupportTicketRecord[] {
    return this.orderService.getCustomerSupportTickets(customerId);
  }

  @Get("customer/:customerId/tickets/paged")
  async customerTicketsPaged(
    @Param("customerId") customerId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<SupportTicketRecord[]> {
    return this.orderService.getCustomerSupportTicketsPaged(customerId, Number(limit || 25), Number(offset || 0));
  }

  @Get("vendor/:vendorId/queue")
  vendorQueue(@Param("vendorId") vendorId: string): VendorQueueResponse {
    return this.orderService.getVendorQueue(vendorId);
  }

  @Get("vendor/:vendorId/queue/paged")
  async vendorQueuePaged(
    @Param("vendorId") vendorId: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<VendorQueueResponse> {
    return this.orderService.getVendorQueuePaged(vendorId, Number(limit || 25), Number(offset || 0));
  }

  @Get("vendor/:vendorId/reviews")
  vendorReviews(@Param("vendorId") vendorId: string): VendorReviewSummary {
    return this.orderService.getVendorReviewSummary(vendorId);
  }

  @Post("vendor/:orderId/accept")
  vendorAccept(@Param("orderId") orderId: string): OrderRecord {
    return this.orderService.vendorAccept(orderId);
  }

  @Post("vendor/:orderId/reject")
  vendorReject(@Param("orderId") orderId: string): OrderRecord {
    return this.orderService.vendorReject(orderId);
  }

  @Post("vendor/:orderId/preparing")
  vendorPreparing(@Param("orderId") orderId: string): OrderRecord {
    return this.orderService.vendorMarkPreparing(orderId);
  }

  @Post("vendor/:orderId/ready")
  vendorReady(@Param("orderId") orderId: string): OrderRecord {
    return this.orderService.vendorMarkReady(orderId);
  }

  @Post("dispatch/assign")
  assignRider(@Body() dto: AssignRiderDto): OrderRecord {
    return this.orderService.assignRider(dto.orderId, dto.riderId);
  }

  @Get("dispatch/suggest/:orderId")
  suggestDispatch(@Param("orderId") orderId: string): DispatchSuggestionResponse {
    return this.orderService.suggestDispatch(orderId);
  }

  @Post("rider/location")
  updateRiderLocation(@Body() dto: RiderLocationUpdateDto): RiderStateSnapshot {
    return this.orderService.updateRiderLocation(dto);
  }

  @Get("rider/:riderId/state")
  riderState(@Param("riderId") riderId: string): RiderStateSnapshot {
    return this.orderService.getRiderState(riderId);
  }

  @Get("rider/:riderId/tasks")
  riderTasks(@Param("riderId") riderId: string): RiderTaskResponse {
    return this.orderService.getRiderTasks(riderId);
  }

  @Get("rider/:riderId/navigation")
  riderNavigation(@Param("riderId") riderId: string): RiderNavigationSnapshot {
    return this.orderService.getRiderNavigation(riderId);
  }

  @Post("rider/:orderId/pickup")
  riderPickup(@Param("orderId") orderId: string, @Body() dto: RiderOrderActionDto): OrderRecord {
    return this.orderService.riderPickup(orderId, dto.riderId);
  }

  @Post("rider/:orderId/start")
  riderStart(@Param("orderId") orderId: string, @Body() dto: RiderOrderActionDto): OrderRecord {
    return this.orderService.riderStartTransit(orderId, dto.riderId);
  }

  @Post("rider/:orderId/deliver")
  riderDeliver(@Param("orderId") orderId: string, @Body() dto: RiderOrderActionDto): OrderRecord {
    return this.orderService.riderDeliver(orderId, dto.riderId);
  }

  @Post("reviews")
  createReview(@Body() dto: CreateReviewDto): ReviewRecord {
    return this.orderService.createReview(dto);
  }

  @Post("support/tickets")
  createSupportTicket(@Body() dto: CreateSupportTicketDto): SupportTicketRecord {
    return this.orderService.createSupportTicket(dto);
  }

  @Get("admin/overview")
  adminOverview(): AdminOverviewResponse {
    return this.orderService.getAdminOverview();
  }

  @Get("admin/orders")
  adminRecentOrders(): OrderRecord[] {
    return this.orderService.getAdminRecentOrders();
  }

  @Get("admin/orders/paged")
  async adminRecentOrdersPaged(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<OrderRecord[]> {
    return this.orderService.getAdminRecentOrdersPaged(Number(limit || 25), Number(offset || 0));
  }

  @Get("admin/reviews/pending")
  adminPendingReviews(): ReviewRecord[] {
    return this.orderService.getPendingReviews();
  }

  @Get("admin/reviews/pending/paged")
  async adminPendingReviewsPaged(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<ReviewRecord[]> {
    return this.orderService.getPendingReviewsPaged(Number(limit || 25), Number(offset || 0));
  }

  @Post("admin/reviews/:reviewId/approve")
  adminApproveReview(@Param("reviewId") reviewId: string): ReviewRecord {
    return this.orderService.approveReview(reviewId);
  }

  @Post("admin/reviews/:reviewId/reject")
  adminRejectReview(@Param("reviewId") reviewId: string): ReviewRecord {
    return this.orderService.rejectReview(reviewId);
  }

  @Get("admin/support/tickets")
  adminSupportTickets(): SupportTicketRecord[] {
    return this.orderService.getAdminSupportTickets();
  }

  @Get("admin/support/tickets/paged")
  async adminSupportTicketsPaged(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<SupportTicketRecord[]> {
    return this.orderService.getAdminSupportTicketsPaged(Number(limit || 25), Number(offset || 0));
  }

  @Post("admin/support/:ticketId/status")
  adminUpdateTicket(
    @Param("ticketId") ticketId: string,
    @Body() dto: UpdateSupportTicketDto,
  ): SupportTicketRecord {
    return this.orderService.updateSupportTicket(ticketId, dto.status, dto.adminNotes);
  }
}
