import {
  AddCartItemRequest,
  AuthLoginResponse,
  CreatePaymentIntentRequest,
  CreateReviewRequest,
  CreateSupportTicketRequest,
  CustomerCart,
  CustomerOrdersResponse,
  DiscoveryResponse,
  HomeBootstrapResponse,
  NotificationItem,
  OrderRecord,
  PaymentIntentRecord,
  PaymentMethod,
  ReviewRecord,
  SupportTicketRecord,
  UserRole,
} from "@get-caramel/types";

type EnvMap = Record<string, string | undefined>;
const ENV: EnvMap = ((globalThis as { process?: { env?: EnvMap } }).process?.env) || {};

const APP_ENV = (ENV.EXPO_PUBLIC_APP_ENV || "local").toLowerCase();
const GATEWAY_BASE_BY_ENV: Record<string, string> = {
  local: "http://127.0.0.1:4000",
  staging: "https://staging-api.get-caramel.com",
  prod: "https://api.get-caramel.com",
};
const GATEWAY_BASE_URL = ENV.EXPO_PUBLIC_GATEWAY_BASE_URL || GATEWAY_BASE_BY_ENV[APP_ENV] || GATEWAY_BASE_BY_ENV.local;

interface LoginInput {
  identifier: string;
  password: string;
  role: UserRole;
}

interface RegisterInput extends LoginInput {
  fullName: string;
}

interface PasswordResetRequestInput {
  identifier: string;
  role: UserRole;
}

function authHeader(accessToken?: string): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || "Request failed");
  }
  return body;
}

export async function login(input: LoginInput): Promise<AuthLoginResponse> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<AuthLoginResponse>(response);
}

export async function register(input: RegisterInput): Promise<AuthLoginResponse> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<AuthLoginResponse>(response);
}

export async function requestPasswordReset(input: PasswordResetRequestInput): Promise<{ success: true; resetToken?: string }> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<{ success: true; resetToken?: string }>(response);
}

export async function resetPassword(resetToken: string, newPassword: string): Promise<{ success: true }> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken, newPassword }),
  });
  return parseJson<{ success: true }>(response);
}

export async function fetchHomeBootstrap(accessToken: string): Promise<HomeBootstrapResponse> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/auth/bootstrap-home`, {
    method: "GET",
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<HomeBootstrapResponse>(response);
}

export async function fetchDiscovery(accessToken: string): Promise<DiscoveryResponse> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/discovery`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<DiscoveryResponse>(response);
}

export async function fetchCart(customerId: string, accessToken: string): Promise<CustomerCart> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/cart/${customerId}`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<CustomerCart>(response);
}

export async function addCartItem(input: AddCartItemRequest, accessToken: string): Promise<CustomerCart> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify(input),
  });
  return parseJson<CustomerCart>(response);
}

export async function checkout(customerId: string, addressLine: string, accessToken: string): Promise<OrderRecord> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify({ customerId, addressLine }),
  });
  return parseJson<OrderRecord>(response);
}

export async function fetchCustomerOrders(customerId: string, accessToken: string): Promise<CustomerOrdersResponse> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/customer/${customerId}`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<CustomerOrdersResponse>(response);
}

export async function fetchCustomerNotifications(customerId: string, accessToken: string): Promise<NotificationItem[]> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/notifications/customer/${customerId}`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<NotificationItem[]>(response);
}

export async function fetchCustomerReviews(customerId: string, accessToken: string): Promise<ReviewRecord[]> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/customer/${customerId}/reviews`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<ReviewRecord[]>(response);
}

export async function fetchCustomerSupportTickets(customerId: string, accessToken: string): Promise<SupportTicketRecord[]> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/customer/${customerId}/tickets`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<SupportTicketRecord[]>(response);
}

export async function createReview(input: CreateReviewRequest, accessToken: string): Promise<ReviewRecord> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify(input),
  });
  return parseJson<ReviewRecord>(response);
}

export async function createSupportTicket(input: CreateSupportTicketRequest, accessToken: string): Promise<SupportTicketRecord> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/orders/support/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify(input),
  });
  return parseJson<SupportTicketRecord>(response);
}

export async function registerPushToken(
  actorKey: string,
  token: string,
  platform: "ios" | "android" | "web",
  accessToken: string,
): Promise<{ success: true }> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/notifications/push/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify({ actorKey, token, platform }),
  });
  return parseJson<{ success: true }>(response);
}

export async function createPaymentIntent(input: CreatePaymentIntentRequest, accessToken: string): Promise<PaymentIntentRecord> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/payments/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify(input),
  });
  return parseJson<PaymentIntentRecord>(response);
}

export async function confirmPayment(paymentId: string, accessToken: string): Promise<PaymentIntentRecord> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/payments/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
    body: JSON.stringify({ paymentId }),
  });
  return parseJson<PaymentIntentRecord>(response);
}

export async function getOrderPayment(orderId: string, accessToken: string): Promise<PaymentIntentRecord> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/payments/order/${orderId}`, {
    headers: { ...authHeader(accessToken) },
  });
  return parseJson<PaymentIntentRecord>(response);
}

export const PAYMENT_METHODS: PaymentMethod[] = ["CARD", "WALLET", "CASH"];
