export type OrderStatus =
  | "PLACED"
  | "ACCEPTED_BY_VENDOR"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELED";

export type RiderAvailability = "ONLINE" | "BUSY" | "OFFLINE";

export interface DiscoveryMenuItem {
  itemId: string;
  vendorId: string;
  name: string;
  description: string;
  priceCents: number;
}

export interface DiscoveryVendor {
  vendorId: string;
  name: string;
  cuisine: string;
  etaMinutes: number;
  deliveryFeeCents: number;
  rating: number;
  menu: DiscoveryMenuItem[];
}

export interface DiscoveryResponse {
  vendors: DiscoveryVendor[];
  generatedAtIso: string;
}

export interface CartItem {
  itemId: string;
  vendorId: string;
  name: string;
  quantity: number;
  priceCents: number;
}

export interface CustomerCart {
  customerId: string;
  vendorId: string | null;
  items: CartItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  updatedAtIso: string;
}

export interface AddCartItemRequest {
  customerId: string;
  vendorId: string;
  itemId: string;
  quantity: number;
}

export interface CheckoutRequest {
  customerId: string;
  addressLine: string;
}

export interface OrderRecord {
  orderId: string;
  customerId: string;
  vendorId: string;
  riderId: string | null;
  items: CartItem[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  status: OrderStatus;
  createdAtIso: string;
  updatedAtIso: string;
  addressLine: string;
}

export interface VendorQueueResponse {
  vendorId: string;
  activeOrders: OrderRecord[];
}

export interface RiderTaskResponse {
  riderId: string;
  activeOrders: OrderRecord[];
}

export interface CustomerOrdersResponse {
  customerId: string;
  orders: OrderRecord[];
}

export interface AdminOverviewResponse {
  openOrders: number;
  completedOrders: number;
  totalGMVCents: number;
  activeVendors: number;
}

export interface AssignRiderRequest {
  orderId: string;
  riderId: string;
}

export interface RiderLocationUpdateRequest {
  riderId: string;
  latitude: number;
  longitude: number;
  availability?: RiderAvailability;
}

export interface RiderStateSnapshot {
  riderId: string;
  latitude: number;
  longitude: number;
  availability: RiderAvailability;
  activeOrders: number;
  updatedAtIso: string;
}

export interface RiderDispatchScore {
  riderId: string;
  availability: RiderAvailability;
  activeOrders: number;
  distanceKm: number;
  score: number;
}

export interface DispatchSuggestionResponse {
  orderId: string;
  recommendedRiderId: string | null;
  candidates: RiderDispatchScore[];
  computedAtIso: string;
}

export interface RiderRoutePoint {
  latitude: number;
  longitude: number;
  label: string;
}

export interface RiderNavigationSnapshot {
  riderId: string;
  orderId: string | null;
  status: OrderStatus | "IDLE";
  distanceKmRemaining: number;
  etaMinutes: number;
  route: RiderRoutePoint[];
  nextInstruction: string;
  updatedAtIso: string;
}
