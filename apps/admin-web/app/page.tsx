"use client";

import {
  AdminOverviewResponse,
  AuthLoginResponse,
  NotificationItem,
  OrderRecord,
  PayoutOverview,
  PayoutRecord,
  ReviewRecord,
  SupportTicketRecord,
  SupportTicketStatus,
} from "@get-caramel/types";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV || "local").toLowerCase();
const GATEWAY_BASE_BY_ENV: Record<string, string> = {
  local: "http://127.0.0.1:4000",
  staging: "https://staging-api.get-caramel.com",
  prod: "https://api.get-caramel.com",
};
const API_BASE = process.env.NEXT_PUBLIC_GATEWAY_BASE_URL || GATEWAY_BASE_BY_ENV[APP_ENV] || GATEWAY_BASE_BY_ENV.local;
const ACTOR_KEY = "admin:ops";
const TICKET_STATUSES: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED"];

const shell: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top right, #dcfce7 0%, #f0fdf4 35%, #ffffff 100%)",
  color: "#111827",
  fontFamily: "var(--gc-font)",
  padding: "clamp(16px, 3vw, 32px)",
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #bbf7d0",
  borderRadius: "var(--gc-radius-2)",
  padding: "clamp(14px, 2vw, 18px)",
  marginTop: "14px",
};

const navButton = (active: boolean): React.CSSProperties => ({
  borderRadius: "10px",
  border: active ? "1px solid #22c55e" : "1px solid #bbf7d0",
  background: active ? "#dcfce7" : "#ffffff",
  color: active ? "#166534" : "#14532d",
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
  if (status === "DELIVERED" || status === "RESOLVED") return { background: "#dcfce7", color: "#166534" };
  if (status === "CANCELED" || status === "ESCALATED") return { background: "#fee2e2", color: "#991b1b" };
  if (status === "IN_PROGRESS" || status === "ON_THE_WAY") return { background: "#dbeafe", color: "#1d4ed8" };
  return { background: "#ffedd5", color: "#9a3412" };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export default function Page(): React.JSX.Element {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [payoutOverview, setPayoutOverview] = useState<PayoutOverview | null>(null);
  const [lastPayoutRun, setLastPayoutRun] = useState<PayoutRecord[]>([]);
  const [pendingReviews, setPendingReviews] = useState<ReviewRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRecord[]>([]);
  const [connected, setConnected] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("admin.ops@getcaramel.app");
  const [password, setPassword] = useState("dev-password");
  const [fullName, setFullName] = useState("Admin Ops");
  const [inviteCode, setInviteCode] = useState("");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [section, setSection] = useState<"overview" | "moderation" | "support" | "history">("overview");

  const loginAdmin = async (): Promise<void> => {
    if (mode === "forgot") {
      setAuthBusy(true);
      setAuthError(null);
      setAuthInfo(null);
      try {
        if (!resetToken || !newPassword) {
          const response = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, role: "admin" }),
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
      const path = mode === "register" ? "/api/auth/register-admin" : "/api/auth/login";
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          ...(mode === "register"
            ? { fullName, inviteCode }
            : { role: "admin" }),
        }),
      });
      if (!res.ok) {
        throw new Error(mode === "register" ? "Admin invite registration failed" : "Invalid admin credentials");
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
      const [overviewRes, ordersRes, notifRes, payoutRes, pendingReviewsRes, ticketsRes] = await Promise.all([
        fetch(`${API_BASE}/api/orders/admin/overview`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/orders/admin/orders`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/notifications/admin`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/payouts/overview`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/orders/admin/reviews/pending`, { cache: "no-store", headers: authHeaders(accessToken) }),
        fetch(`${API_BASE}/api/orders/admin/support/tickets`, { cache: "no-store", headers: authHeaders(accessToken) }),
      ]);
      setData((await overviewRes.json()) as AdminOverviewResponse);
      setOrders((await ordersRes.json()) as OrderRecord[]);
      setNotifications((await notifRes.json()) as NotificationItem[]);
      setPayoutOverview((await payoutRes.json()) as PayoutOverview);
      setPendingReviews((await pendingReviewsRes.json()) as ReviewRecord[]);
      setSupportTickets((await ticketsRes.json()) as SupportTicketRecord[]);
    } catch {
      setData({ openOrders: 0, completedOrders: 0, totalGMVCents: 0, activeVendors: 0 });
      setOrders([]);
      setNotifications([]);
      setPayoutOverview({ totalPendingCents: 0, totalPaidCents: 0, vendorsWithPending: 0 });
      setPendingReviews([]);
      setSupportTickets([]);
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

      socket.on("connect", () => setConnected(true));
      socket.on("disconnect", () => setConnected(false));
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

  const runPayouts = async () => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/api/payouts/run`, { method: "POST", headers: authHeaders(token) });
    const records = (await response.json()) as PayoutRecord[];
    setLastPayoutRun(records);
    await load(token);
  };

  const moderateReview = async (reviewId: string, action: "approve" | "reject") => {
    if (!token) return;
    setBusyAction(`${reviewId}:${action}`);
    try {
      await fetch(`${API_BASE}/api/orders/admin/reviews/${reviewId}/${action}`, { method: "POST", headers: authHeaders(token) });
      await load(token);
    } finally {
      setBusyAction(null);
    }
  };

  const setTicketStatus = async (ticketId: string, status: SupportTicketStatus) => {
    if (!token) return;
    setBusyAction(`${ticketId}:${status}`);
    try {
      await fetch(`${API_BASE}/api/orders/admin/support/${ticketId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ status, adminNotes: `Set to ${status} by ops.` }),
      });
      await load(token);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <main style={shell}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button onClick={() => setDrawerOpen(true)} style={{ borderRadius: "10px", border: "1px solid #bbf7d0", background: "#fff", padding: "8px 10px" }}>|||</button>
        <div>
          <h1 style={{ fontSize: "40px", marginBottom: "8px" }}>Admin Control Room</h1>
          <p style={{ color: "#4b5563", margin: 0 }}>
            Live oversight across customer, vendor, rider, quality, support, and payouts. Socket: {connected ? "connected" : "offline"}
          </p>
        </div>
      </div>

      {token ? (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
          <button style={navButton(section === "overview")} onClick={() => setSection("overview")}>Overview</button>
          <button style={navButton(section === "moderation")} onClick={() => setSection("moderation")}>Moderation</button>
          <button style={navButton(section === "support")} onClick={() => setSection("support")}>Support</button>
          <button style={navButton(section === "history")} onClick={() => setSection("history")}>History</button>
        </div>
      ) : null}

      {drawerOpen ? (
        <section style={{ ...panel, position: "fixed", top: "80px", left: "32px", width: "300px", zIndex: 20 }}>
          <h2 style={{ marginTop: 0 }}>Navigation</h2>
          <div style={{ display: "grid", gap: "8px" }}>
            <button onClick={() => { setSection("overview"); setDrawerOpen(false); }}>Operations Overview</button>
            <button onClick={() => { setSection("moderation"); setDrawerOpen(false); }}>Review Moderation</button>
            <button onClick={() => { setSection("support"); setDrawerOpen(false); }}>Support Triage</button>
            <button onClick={() => { setSection("history"); setDrawerOpen(false); }}>Order & Event History</button>
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
                <>
                  <label style={authField}>
                    <span>👤</span>
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Name" style={authInput} />
                  </label>
                  <label style={authField}>
                    <span>🔑</span>
                    <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Admin invite code" style={authInput} />
                  </label>
                </>
              ) : null}
              <label style={authField}>
                <span>✉</span>
                <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email address" style={authInput} />
              </label>
              {mode !== "forgot" ? (
                <label style={authField}>
                  <span>🔒</span>
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" style={authInput} />
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
                    <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Reset token" style={authInput} />
                  </label>
                  <label style={authField}>
                    <span>🔒</span>
                    <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" style={authInput} />
                  </label>
                </>
              ) : null}
              <button onClick={() => void loginAdmin()} disabled={authBusy} style={{ border: "none", borderRadius: 999, background: "#35b97d", color: "#fff", padding: "14px", fontSize: 18, marginTop: 4 }}>
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

      {token && section === "overview" ? (
        <>
          <section style={{ ...panel, animation: "gcAdminFade 220ms ease-out" }}>
            <h2 style={{ marginTop: 0 }}>Operations Snapshot</h2>
            <p>Open Orders: {data?.openOrders ?? "..."}</p>
            <p>Completed Orders: {data?.completedOrders ?? "..."}</p>
            <p>Active Vendors: {data?.activeVendors ?? "..."}</p>
            <p>Platform GMV: {data ? money(data.totalGMVCents) : "..."}</p>
            <p style={{ color: "#6b7280", marginTop: 4 }}>Monitor platform health before payout or moderation actions.</p>
          </section>

      <section style={panel}>
        <h2 style={{ marginTop: 0 }}>Payouts</h2>
        <p>Total Pending: {money(payoutOverview?.totalPendingCents || 0)}</p>
        <p>Total Paid: {money(payoutOverview?.totalPaidCents || 0)}</p>
        <p>Vendors With Pending: {payoutOverview?.vendorsWithPending || 0}</p>
        <button onClick={runPayouts}>Run Payout Batch</button>
        {lastPayoutRun.length === 0 ? <p style={{ color: "#6b7280" }}>No payout batch run in this session.</p> : null}
        {lastPayoutRun.map((p) => (
          <p key={p.payoutId}>{p.vendorId} paid {money(p.amountCents)} ({p.ordersCount} orders)</p>
        ))}
      </section>

      <section style={panel}>
        <h2 style={{ marginTop: 0 }}>Pending Review Moderation</h2>
        {pendingReviews.length === 0 ? <p>No reviews pending moderation.</p> : null}
        {pendingReviews.map((review) => (
          <div key={review.reviewId} style={{ marginBottom: "10px", borderTop: "1px solid #dcfce7", paddingTop: "8px" }}>
            <p style={{ marginBottom: "4px" }}>
              {review.reviewId} | {review.vendorId} | {review.rating}* | {review.comment}
            </p>
            <p style={{ marginBottom: "6px", color: "#6b7280" }}>Flag: {review.flaggedReason || "-"}</p>
            <button disabled={!!busyAction} onClick={() => moderateReview(review.reviewId, "approve")}>Approve</button>
            <button disabled={!!busyAction} onClick={() => moderateReview(review.reviewId, "reject")} style={{ marginLeft: "8px" }}>Reject</button>
          </div>
        ))}
      </section>

      <section style={panel}>
        <h2 style={{ marginTop: 0 }}>Support Ticket Triage</h2>
        {supportTickets.length === 0 ? <p>No tickets yet.</p> : null}
        {supportTickets.map((ticket) => (
          <div key={ticket.ticketId} style={{ marginBottom: "10px", borderTop: "1px solid #dcfce7", paddingTop: "8px" }}>
            <p style={{ marginBottom: "4px" }}>{ticket.ticketId} | {ticket.subject}</p>
            <p style={{ marginBottom: "4px" }}>Status: {ticket.status} | Priority: {ticket.priority}</p>
            <p style={{ marginBottom: "6px", color: "#6b7280" }}>{ticket.description}</p>
            {TICKET_STATUSES.map((status) => (
              <button
                key={status}
                disabled={!!busyAction || ticket.status === status}
                onClick={() => setTicketStatus(ticket.ticketId, status)}
                style={{ marginRight: "6px", marginBottom: "6px" }}
              >
                {status}
              </button>
            ))}
          </div>
        ))}
      </section>

	      <section style={panel}>
	        <h2 style={{ marginTop: 0 }}>Realtime Notifications</h2>
	        {notifications.length === 0 ? <p style={{ color: "#6b7280" }}>No realtime notifications right now.</p> : null}
	        {notifications.slice(0, 10).map((n) => (
	          <p key={n.id}>{n.title}: {n.body}</p>
	        ))}
	      </section>

	          {orders.map((order) => (
	            <section key={order.orderId} style={panel}>
	              <h3 style={{ marginTop: 0 }}>{order.orderId}</h3>
	              <p>Status: <span style={{ ...statusPill(order.status), borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>{order.status}</span></p>
	              <p>Vendor: {order.vendorId}</p>
	              <p>Rider: {order.riderId || "Unassigned"}</p>
	              <p>Total: {money(order.totalCents)}</p>
            </section>
          ))}
        </>
      ) : null}

      {token && section === "moderation" ? (
        <section style={{ ...panel, animation: "gcAdminFade 220ms ease-out" }}>
          <h2 style={{ marginTop: 0 }}>Pending Review Moderation</h2>
          {pendingReviews.length === 0 ? <p>No reviews pending moderation.</p> : null}
          {pendingReviews.map((review) => (
            <div key={review.reviewId} style={{ marginBottom: "10px", borderTop: "1px solid #dcfce7", paddingTop: "8px" }}>
              <p style={{ marginBottom: "4px" }}>
                {review.reviewId} | {review.vendorId} | {review.rating}* | {review.comment}
              </p>
              <p style={{ marginBottom: "6px", color: "#6b7280" }}>Flag: {review.flaggedReason || "-"}</p>
              <button disabled={!!busyAction} onClick={() => moderateReview(review.reviewId, "approve")}>Approve</button>
              <button disabled={!!busyAction} onClick={() => moderateReview(review.reviewId, "reject")} style={{ marginLeft: "8px" }}>Reject</button>
            </div>
          ))}
        </section>
      ) : null}

	      {token && section === "support" ? (
	        <section style={{ ...panel, animation: "gcAdminFade 220ms ease-out" }}>
	          <h2 style={{ marginTop: 0 }}>Support Ticket Triage</h2>
	          <p style={{ color: "#6b7280", marginTop: 0 }}>Set clear status transitions to maintain SLA compliance.</p>
	          {supportTickets.length === 0 ? <p>No tickets yet.</p> : null}
	          {supportTickets.map((ticket) => (
	            <div key={ticket.ticketId} style={{ marginBottom: "10px", borderTop: "1px solid #dcfce7", paddingTop: "8px" }}>
	              <p style={{ marginBottom: "4px" }}>{ticket.ticketId} | {ticket.subject}</p>
	              <p style={{ marginBottom: "4px" }}>Status: <span style={{ ...statusPill(ticket.status), borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>{ticket.status}</span> | Priority: {ticket.priority}</p>
	              <p style={{ marginBottom: "6px", color: "#6b7280" }}>{ticket.description}</p>
              {TICKET_STATUSES.map((status) => (
                <button
                  key={status}
                  disabled={!!busyAction || ticket.status === status}
                  onClick={() => setTicketStatus(ticket.ticketId, status)}
                  style={{ marginRight: "6px", marginBottom: "6px" }}
                >
                  {status}
                </button>
              ))}
            </div>
          ))}
        </section>
      ) : null}

	      {token && section === "history" ? (
	        <>
	          <section style={{ ...panel, animation: "gcAdminFade 220ms ease-out" }}>
	            <h2 style={{ marginTop: 0 }}>Realtime Notifications</h2>
	            {notifications.length === 0 ? <p style={{ color: "#6b7280" }}>No realtime notifications right now.</p> : null}
	            {notifications.slice(0, 20).map((n) => (
	              <p key={n.id}>{n.title}: {n.body}</p>
	            ))}
	          </section>
	          {orders.length === 0 ? <section style={{ ...panel, animation: "gcAdminFade 240ms ease-out" }}><p>No recent orders recorded.</p></section> : null}
	          {orders.map((order) => (
	            <section key={order.orderId} style={{ ...panel, animation: "gcAdminFade 240ms ease-out" }}>
	              <h3 style={{ marginTop: 0 }}>{order.orderId}</h3>
	              <p>Status: <span style={{ ...statusPill(order.status), borderRadius: 999, padding: "2px 8px", fontWeight: 700 }}>{order.status}</span></p>
	              <p>Vendor: {order.vendorId}</p>
	              <p>Rider: {order.riderId || "Unassigned"}</p>
	              <p>Total: {money(order.totalCents)}</p>
            </section>
          ))}
        </>
      ) : null}

      <style jsx global>{`
        @keyframes gcAdminFade {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
