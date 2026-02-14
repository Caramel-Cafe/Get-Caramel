"use client";

import {
  AuthLoginResponse,
  InvoiceRecord,
  NotificationItem,
  OrderRecord,
  VendorPayoutSummary,
  VendorQueueResponse,
  VendorReviewSummary,
} from "@get-caramel/types";
import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";

const APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV || "local").toLowerCase();
const GATEWAY_BASE_BY_ENV: Record<string, string> = {
  local: "http://127.0.0.1:4000",
  staging: "https://staging-api.get-caramel.com",
  prod: "https://api.get-caramel.com",
};
const API_BASE = process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || GATEWAY_BASE_BY_ENV[APP_ENV] || GATEWAY_BASE_BY_ENV.local;
const VENDOR_ID = "vnd_001";
const ACTOR_KEY = `vendor:${VENDOR_ID}`;

type State = {
  data: VendorQueueResponse | null;
  notifications: NotificationItem[];
  payout: VendorPayoutSummary | null;
  invoices: InvoiceRecord[];
  reviews: VendorReviewSummary | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
};

const shell: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(130deg, #fff7ed 0%, #ffffff 40%, #ffedd5 100%)",
  color: "#1f2937",
  fontFamily: "var(--gc-font)",
  padding: "clamp(16px, 3vw, 32px)",
};

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "var(--gc-radius-2)",
  border: "1px solid #fed7aa",
  padding: "clamp(14px, 2vw, 18px)",
  boxShadow: "0 10px 30px rgba(249,115,22,0.08)",
  marginTop: "14px",
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const navButton = (active: boolean): React.CSSProperties => ({
  borderRadius: "10px",
  border: active ? "1px solid #fb923c" : "1px solid #fed7aa",
  background: active ? "#ffedd5" : "#ffffff",
  color: active ? "#9a3412" : "#7c2d12",
  fontWeight: 700,
  padding: "8px 12px",
});

const authScreen: React.CSSProperties = {
  minHeight: "calc(100vh - 120px)",
  display: "grid",
  placeItems: "center",
};

const authCard: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "#f3f4f6",
  borderRadius: "28px",
  border: "1px solid #e5e7eb",
  padding: "20px",
  boxShadow: "0 16px 30px rgba(2,6,23,0.06)",
};

const authField: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  borderRadius: "999px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  padding: "12px 14px",
};

const authInput: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  width: "100%",
  fontSize: "15px",
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusPill(status: string): React.CSSProperties {
  if (status === "DELIVERED") return { background: "#dcfce7", color: "#166534" };
  if (status === "CANCELED") return { background: "#fee2e2", color: "#991b1b" };
  if (status === "ON_THE_WAY") return { background: "#dbeafe", color: "#1d4ed8" };
  return { background: "#ffedd5", color: "#9a3412" };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function Page(): React.JSX.Element {
  const [state, setState] = useState<State>({
    data: null,
    notifications: [],
    payout: null,
    invoices: [],
    reviews: null,
    loading: true,
    error: null,
    connected: false,
  });
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("vendor.demo@getcaramel.app");
  const [password, setPassword] = useState("dev-password");
  const [fullName, setFullName] = useState("Vendor Owner");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [section, setSection] = useState<"queue" | "finance" | "quality" | "history">("queue");

  const authenticateVendor = async (): Promise<void> => {
    if (mode === "forgot") {
      setAuthBusy(true);
      setAuthError(null);
      setAuthInfo(null);
      try {
        if (!resetToken || !newPassword) {
          const response = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, role: "vendor_owner" }),
          });
          if (!response.ok) throw new Error("Unable to request password reset");
          const body = (await response.json()) as { success: boolean; resetToken?: string };
          if (body.resetToken) setResetToken(body.resetToken);
          setAuthInfo("If this account exists, a reset token has been issued. Enter token + new password below.");
          return;
        }

        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetToken, newPassword }),
        });
        if (!response.ok) throw new Error("Unable to reset password");
        setAuthInfo("Password reset successful. You can now sign in.");
        setMode("login");
        setPassword(newPassword);
        setNewPassword("");
        setResetToken("");
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Unable to reset password");
      } finally {
        setAuthBusy(false);
      }
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthInfo(null);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          role: "vendor_owner",
          ...(mode === "register" ? { fullName } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(mode === "register" ? "Unable to create vendor account" : "Invalid vendor credentials");
      }
      const session = (await res.json()) as AuthLoginResponse;
      setToken(session.tokens.accessToken);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setAuthBusy(false);
    }
  };

  const load = async (accessToken: string) => {
    try {
      const [queueRes, notifRes, payoutRes, invoiceRes, reviewRes] = await Promise.all([
        fetch(`${API_BASE}/api/orders/vendor/${VENDOR_ID}/queue`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/notifications/vendor/${VENDOR_ID}`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/payouts/vendor/${VENDOR_ID}/summary`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/invoices/vendor/${VENDOR_ID}`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/orders/vendor/${VENDOR_ID}/reviews`, { cache: "no-store", headers: authHeaders(accessToken) }),
      ]);
      const queuePayload = (await queueRes.json()) as Partial<VendorQueueResponse> | null;
      const notifPayload = await notifRes.json();
      const payoutPayload = await payoutRes.json();
      const invoicePayload = await invoiceRes.json();
      const reviewPayload = await reviewRes.json();

      const data: VendorQueueResponse = {
        vendorId: queuePayload?.vendorId || VENDOR_ID,
        activeOrders: asArray<OrderRecord>(queuePayload?.activeOrders).map((order) => ({
          ...order,
          items: asArray(order?.items),
        })),
      };
      const notifications = asArray<NotificationItem>(notifPayload);
      const invoices = asArray<InvoiceRecord>(invoicePayload);
      const payout: VendorPayoutSummary = {
        vendorId: typeof (payoutPayload as { vendorId?: unknown })?.vendorId === "string"
          ? String((payoutPayload as { vendorId?: unknown }).vendorId)
          : VENDOR_ID,
        pendingBalanceCents: Number((payoutPayload as { pendingBalanceCents?: unknown })?.pendingBalanceCents || 0),
        paidOutTotalCents: Number((payoutPayload as { paidOutTotalCents?: unknown })?.paidOutTotalCents || 0),
        lastPayoutAtIso: ((payoutPayload as { lastPayoutAtIso?: unknown })?.lastPayoutAtIso as string | null) || null,
        payouts: asArray((payoutPayload as { payouts?: unknown })?.payouts),
      };
      const reviews: VendorReviewSummary = {
        vendorId: typeof (reviewPayload as { vendorId?: unknown })?.vendorId === "string"
          ? String((reviewPayload as { vendorId?: unknown }).vendorId)
          : VENDOR_ID,
        averageRating: Number((reviewPayload as { averageRating?: unknown })?.averageRating || 0),
        totalReviews: Number((reviewPayload as { totalReviews?: unknown })?.totalReviews || 0),
        reviews: asArray((reviewPayload as { reviews?: unknown })?.reviews),
      };
      setState((prev) => ({ ...prev, data, notifications, payout, invoices, reviews, loading: false, error: null }));
    } catch {
      setState((prev) => ({ ...prev, data: null, loading: false, error: "Unable to load queue" }));
    }
  };

  useEffect(() => {
    let socket: Socket | null = null;
    let cancel = false;

    if (!token) return;
    const start = async () => {
      await load(token);
      if (cancel) return;

      socket = io(`${API_BASE}/realtime`, {
        transports: ["websocket"],
        query: { actorKey: ACTOR_KEY },
      });

      socket.on("connect", () => {
        setState((prev) => ({ ...prev, connected: true }));
      });

      socket.on("disconnect", () => {
        setState((prev) => ({ ...prev, connected: false }));
      });

      socket.on("realtime:event", async () => {
        await load(token);
      });
    };

    void start();
    return () => {
      cancel = true;
      socket?.disconnect();
    };
  }, [token]);

  const callAction = async (orderId: string, action: "accept" | "preparing" | "ready" | "reject") => {
    if (!token) return;
    setActionBusy(`${orderId}:${action}`);
    try {
      await fetch(`${API_BASE}/api/orders/vendor/${orderId}/${action}`, { method: "POST", headers: authHeaders(token) });
      await load(token);
    } finally {
      setActionBusy(null);
    }
  };

  const activeCount = state.data?.activeOrders?.length ?? 0;
  const totalValue = useMemo(
    () => (state.data?.activeOrders || []).reduce((sum, order) => sum + order.totalCents, 0),
    [state.data],
  );

  return (
    <main style={shell}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button onClick={() => setDrawerOpen(true)} style={{ borderRadius: "10px", border: "1px solid #fed7aa", background: "#fff", padding: "8px 10px" }}>|||</button>
        <div>
          <h1 style={{ fontSize: "40px", marginBottom: "6px" }}>Vendor Console</h1>
          <p style={{ color: "#6b7280", fontSize: "16px", margin: 0 }}>
            Live queue, payments, payouts, and customer quality signals. Socket: {state.connected ? "connected" : "offline"}
          </p>
        </div>
      </div>

      {token ? (
        <div style={{ ...buttonRow, marginTop: "12px" }}>
          <button style={navButton(section === "queue")} onClick={() => setSection("queue")}>Queue</button>
          <button style={navButton(section === "finance")} onClick={() => setSection("finance")}>Finance</button>
          <button style={navButton(section === "quality")} onClick={() => setSection("quality")}>Quality</button>
          <button style={navButton(section === "history")} onClick={() => setSection("history")}>History</button>
        </div>
      ) : null}

      {drawerOpen ? (
        <section style={{ ...card, position: "fixed", top: "80px", left: "32px", width: "300px", zIndex: 20 }}>
          <h2 style={{ marginTop: 0 }}>Navigation</h2>
          <div style={{ display: "grid", gap: "8px" }}>
            <button onClick={() => { setSection("queue"); setDrawerOpen(false); }}>Queue & Actions</button>
            <button onClick={() => { setSection("finance"); setDrawerOpen(false); }}>Payouts & Invoices</button>
            <button onClick={() => { setSection("quality"); setDrawerOpen(false); }}>Reviews & Alerts</button>
            <button onClick={() => { setSection("history"); setDrawerOpen(false); }}>Order History</button>
            <button onClick={() => setDrawerOpen(false)}>Close</button>
          </div>
        </section>
      ) : null}

      {!token ? (
        <section style={authScreen}>
          <div style={authCard}>
            <button style={{ borderRadius: 999, border: "1px solid #e5e7eb", background: "#fff", width: 36, height: 36 }}>{"<"}</button>
            <h2 style={{ fontSize: "48px", margin: "16px 0 8px", textAlign: "center", color: "#020617" }}>
              {mode === "register" ? "Create Account" : mode === "forgot" ? "Forgot Password" : "Log in"}
            </h2>
            <p style={{ textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
              {mode === "register"
                ? "Create a new account to get started and enjoy seamless access."
                : mode === "forgot"
                  ? "Enter your email to receive a reset link and regain account access."
                  : "Enter your email and password to securely access your account."}
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {mode === "register" ? (
                <label style={authField}>
                  <span>👤</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Name"
                    style={authInput}
                  />
                </label>
              ) : null}
              <label style={authField}>
                <span>✉</span>
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="Email address"
                  style={authInput}
                />
              </label>
              {mode !== "forgot" ? (
                <label style={authField}>
                  <span>🔒</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
                    style={authInput}
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} style={{ border: "none", background: "transparent" }}>
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </label>
              ) : null}
              {mode !== "forgot" ? (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe((value) => !value)} />
                    Remember me
                  </label>
                  <button onClick={() => { setMode("forgot"); setAuthError(null); setAuthInfo(null); }} style={{ border: "none", background: "transparent", color: "#0f172a" }}>Forgot Password</button>
                </div>
              ) : null}
              {mode === "forgot" ? (
                <>
                  <label style={authField}>
                    <span>🎟</span>
                    <input
                      value={resetToken}
                      onChange={(event) => setResetToken(event.target.value)}
                      placeholder="Reset token"
                      style={authInput}
                    />
                  </label>
                  <label style={authField}>
                    <span>🔒</span>
                    <input
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="New password"
                      type={showPassword ? "text" : "password"}
                      style={authInput}
                    />
                  </label>
                </>
              ) : null}
              <button
                onClick={() => void authenticateVendor()}
                disabled={authBusy}
                style={{ border: "none", borderRadius: 999, background: "#35b97d", color: "#fff", padding: "14px", fontSize: 18, marginTop: 4 }}
              >
                {authBusy ? "Working..." : mode === "register" ? "Create Account" : mode === "forgot" ? (resetToken && newPassword ? "Reset Password" : "Continue") : "Login"}
              </button>
              <p style={{ textAlign: "center", color: "#4b5563", margin: 0 }}>
                {mode === "register" ? (
                  <>
                    Already have an account?{" "}
                    <button onClick={() => { setMode("login"); setAuthError(null); setAuthInfo(null); }} style={{ border: "none", background: "transparent", color: "#16a34a", fontWeight: 700 }}>
                      Sign In here
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{" "}
                    <button onClick={() => { setMode("register"); setAuthError(null); setAuthInfo(null); }} style={{ border: "none", background: "transparent", color: "#16a34a", fontWeight: 700 }}>
                      Sign Up here
                    </button>
                  </>
                )}
              </p>
              {mode === "forgot" ? (
                <button onClick={() => { setMode("login"); setAuthError(null); setAuthInfo(null); }} style={{ border: "none", background: "transparent", color: "#16a34a", fontWeight: 700 }}>
                  Back to Sign In
                </button>
              ) : null}
              {authError ? <p style={{ color: "#b91c1c", margin: 0 }}>{authError}</p> : null}
              {authInfo ? <p style={{ color: "#166534", margin: 0 }}>{authInfo}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {token && section === "queue" ? (
        <>
          <section style={{ ...card, animation: "gcFadeUp 220ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Queue Snapshot</h2>
            <p>Active Orders: {activeCount}</p>
            <p>Order Value: {money(totalValue)}</p>
            <p style={{ color: "#6b7280", marginTop: 4 }}>Use Queue actions to keep prep and dispatch flowing.</p>
          </section>

          <section style={{ ...card, animation: "gcFadeUp 240ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Settlement Snapshot</h2>
            <p>Pending Balance: {money(state.payout?.pendingBalanceCents || 0)}</p>
            <p>Paid Out Total: {money(state.payout?.paidOutTotalCents || 0)}</p>
            <p>Last Payout: {state.payout?.lastPayoutAtIso || "-"}</p>
          </section>

          <section style={{ ...card, animation: "gcFadeUp 260ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Review Quality</h2>
            <p>Average Rating: {state.reviews?.averageRating ?? 0}</p>
            <p>Total Reviews: {state.reviews?.totalReviews ?? 0}</p>
            {(state.reviews?.reviews || []).slice(0, 6).map((review) => (
              <p key={review.reviewId}>
                {review.rating}* [{review.moderationStatus}] {review.comment}
              </p>
            ))}
          </section>

          {state.loading ? <p>Loading queue...</p> : null}
          {state.error ? <p style={{ color: "#b91c1c" }}>{state.error}</p> : null}

          {(state.data?.activeOrders || []).map((order: OrderRecord) => (
            <article key={order.orderId} style={card}>
              <h3 style={{ marginTop: 0 }}>{order.orderId}</h3>
              <p>Status: <span style={{ ...statusPill(order.status), borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>{order.status}</span></p>
              <p>Items: {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
              <p>Total: {money(order.totalCents)}</p>
              <p>Rider: {order.riderId || "Not assigned"}</p>
              <p>Address: {order.addressLine}</p>

              <div style={buttonRow}>
                <button disabled={!!actionBusy} onClick={() => callAction(order.orderId, "accept")}>Accept</button>
                <button disabled={!!actionBusy} onClick={() => callAction(order.orderId, "preparing")}>Preparing</button>
                <button disabled={!!actionBusy} onClick={() => callAction(order.orderId, "ready")}>Ready</button>
                <button disabled={!!actionBusy} onClick={() => callAction(order.orderId, "reject")}>Reject</button>
              </div>
            </article>
          ))}

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Recent Invoices</h2>
            {state.invoices.length === 0 ? <p style={{ color: "#6b7280" }}>No invoice records yet.</p> : null}
            {state.invoices.slice(0, 6).map((invoice) => (
              <p key={invoice.invoiceId}>{invoice.orderId}: net {money(invoice.netVendorAmountCents)} (fee {money(invoice.platformFeeCents)})</p>
            ))}
          </section>

          <section style={card}>
            <h2 style={{ marginTop: 0 }}>Notifications</h2>
            {state.notifications.length === 0 ? <p style={{ color: "#6b7280" }}>No alerts from ops or customers right now.</p> : null}
            {state.notifications.slice(0, 8).map((item) => (
              <p key={item.id}>{item.title}: {item.body}</p>
            ))}
          </section>
        </>
      ) : null}

      {token && section === "finance" ? (
        <>
          <section style={{ ...card, animation: "gcFadeUp 220ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Settlement Snapshot</h2>
            <p>Pending Balance: {money(state.payout?.pendingBalanceCents || 0)}</p>
            <p>Paid Out Total: {money(state.payout?.paidOutTotalCents || 0)}</p>
            <p>Last Payout: {state.payout?.lastPayoutAtIso || "-"}</p>
            <p style={{ color: "#6b7280", marginTop: 4 }}>Track settlement health before closing your day.</p>
          </section>

          <section style={{ ...card, animation: "gcFadeUp 240ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Recent Invoices</h2>
            {state.invoices.length === 0 ? <p style={{ color: "#6b7280" }}>No invoice records yet.</p> : null}
            {state.invoices.slice(0, 12).map((invoice) => (
              <p key={invoice.invoiceId}>{invoice.orderId}: net {money(invoice.netVendorAmountCents)} (fee {money(invoice.platformFeeCents)})</p>
            ))}
          </section>
        </>
      ) : null}

      {token && section === "quality" ? (
        <>
          <section style={{ ...card, animation: "gcFadeUp 220ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Review Quality</h2>
            <p>Average Rating: {state.reviews?.averageRating ?? 0}</p>
            <p>Total Reviews: {state.reviews?.totalReviews ?? 0}</p>
            {(state.reviews?.reviews || []).length === 0 ? <p style={{ color: "#6b7280" }}>No review feedback yet.</p> : null}
            {(state.reviews?.reviews || []).slice(0, 12).map((review) => (
              <p key={review.reviewId}>
                {review.rating}* [{review.moderationStatus}] {review.comment}
              </p>
            ))}
          </section>

          <section style={{ ...card, animation: "gcFadeUp 240ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Notifications</h2>
            {state.notifications.length === 0 ? <p style={{ color: "#6b7280" }}>No alerts from ops or customers right now.</p> : null}
            {state.notifications.slice(0, 12).map((item) => (
              <p key={item.id}>{item.title}: {item.body}</p>
            ))}
          </section>
        </>
      ) : null}

      {token && section === "history" ? (
        <section style={{ ...card, animation: "gcFadeUp 220ms ease-out" }}>
          <h2 style={{ marginTop: 0 }}>Order History</h2>
          <p style={{ color: "#6b7280", marginTop: 0 }}>Review order flow, assignment, and handoff status.</p>
          {(state.data?.activeOrders || []).length === 0 ? <p>No active orders currently.</p> : null}
          {(state.data?.activeOrders || []).map((order: OrderRecord) => (
            <article key={order.orderId} style={{ borderTop: "1px solid #fed7aa", marginTop: "8px", paddingTop: "8px" }}>
              <p>{order.orderId} - <span style={{ ...statusPill(order.status), borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>{order.status}</span></p>
              <p>Total: {money(order.totalCents)} | Rider: {order.riderId || "Unassigned"}</p>
              <p>Address: {order.addressLine}</p>
            </article>
          ))}
        </section>
      ) : null}

      <style jsx global>{`
        @keyframes gcFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
