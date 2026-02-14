import {
  AuthLoginResponse,
  NotificationItem,
  OrderRecord,
  RiderNavigationSnapshot,
  RiderStateSnapshot,
  RiderTaskResponse,
} from "@get-caramel/types";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { initMobileSentry } from "./src/observability/sentry";

type EnvMap = Record<string, string | undefined>;
const ENV: EnvMap = ((globalThis as { process?: { env?: EnvMap } }).process?.env) || {};
const APP_ENV = (ENV.EXPO_PUBLIC_APP_ENV || "local").toLowerCase();
const GATEWAY_BASE_BY_ENV: Record<string, string> = {
  local: "http://127.0.0.1:4000",
  staging: "https://staging-api.get-caramel.com",
  prod: "https://api.get-caramel.com",
};
const API_BASE = ENV.EXPO_PUBLIC_GATEWAY_BASE_URL || GATEWAY_BASE_BY_ENV[APP_ENV] || GATEWAY_BASE_BY_ENV.local;

const colors = {
  bg: "#F0FDF4",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#475569",
  primary: "#16A34A",
};
const SPACE = { xs: 6, sm: 10, md: 14, lg: 18 };

function toneForOrder(status: string): { bg: string; fg: string } {
  if (status === "DELIVERED") return { bg: "#dcfce7", fg: "#166534" };
  if (status === "ON_THE_WAY") return { bg: "#dbeafe", fg: "#1d4ed8" };
  if (status === "CANCELED") return { bg: "#fee2e2", fg: "#991b1b" };
  return { bg: "#dcfce7", fg: "#14532d" };
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function moveToward(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, ratio = 0.2) {
  return {
    latitude: from.latitude + ((to.latitude - from.latitude) * ratio),
    longitude: from.longitude + ((to.longitude - from.longitude) * ratio),
  };
}

async function loginCourier(identifier: string, password: string): Promise<AuthLoginResponse> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password, role: "courier" }),
  });
  if (!response.ok) throw new Error("Invalid courier credentials");
  return (await response.json()) as AuthLoginResponse;
}

async function registerCourier(identifier: string, password: string, fullName: string): Promise<AuthLoginResponse> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password, fullName, role: "courier" }),
  });
  if (!response.ok) throw new Error("Unable to create courier account");
  return (await response.json()) as AuthLoginResponse;
}

async function requestCourierPasswordReset(identifier: string): Promise<{ success: true; resetToken?: string }> {
  const response = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, role: "courier" }),
  });
  if (!response.ok) throw new Error("Unable to request password reset");
  return (await response.json()) as { success: true; resetToken?: string };
}

async function confirmCourierPasswordReset(resetToken: string, newPassword: string): Promise<{ success: true }> {
  const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetToken, newPassword }),
  });
  if (!response.ok) throw new Error("Unable to reset password");
  return (await response.json()) as { success: true };
}

async function fetchTasks(riderId: string, token: string): Promise<RiderTaskResponse> {
  const res = await fetch(`${API_BASE}/api/orders/rider/${riderId}/tasks`, { headers: authHeaders(token) });
  return (await res.json()) as RiderTaskResponse;
}

async function fetchRiderState(riderId: string, token: string): Promise<RiderStateSnapshot> {
  const res = await fetch(`${API_BASE}/api/orders/rider/${riderId}/state`, { headers: authHeaders(token) });
  return (await res.json()) as RiderStateSnapshot;
}

async function fetchNavigation(riderId: string, token: string): Promise<RiderNavigationSnapshot> {
  const res = await fetch(`${API_BASE}/api/orders/rider/${riderId}/navigation`, { headers: authHeaders(token) });
  return (await res.json()) as RiderNavigationSnapshot;
}

async function updateRiderLocation(
  riderId: string,
  token: string,
  latitude: number,
  longitude: number,
  availability?: "ONLINE" | "BUSY" | "OFFLINE",
): Promise<RiderStateSnapshot> {
  const res = await fetch(`${API_BASE}/api/orders/rider/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ riderId, latitude, longitude, availability }),
  });
  return (await res.json()) as RiderStateSnapshot;
}

async function fetchNotifications(riderId: string, token: string): Promise<NotificationItem[]> {
  const res = await fetch(`${API_BASE}/api/notifications/rider/${riderId}`, { headers: authHeaders(token) });
  return (await res.json()) as NotificationItem[];
}

async function registerPush(riderId: string, token: string): Promise<void> {
  await fetch(`${API_BASE}/api/notifications/push/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ actorKey: `rider:${riderId}`, token: `rider-${riderId}`, platform: "web" }),
  });
}

async function action(orderId: string, riderId: string, actionName: "pickup" | "start" | "deliver", token: string): Promise<void> {
  await fetch(`${API_BASE}/api/orders/rider/${orderId}/${actionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ riderId }),
  });
}

export default function App(): React.JSX.Element {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [riderState, setRiderState] = useState<RiderStateSnapshot | null>(null);
  const [navigation, setNavigation] = useState<RiderNavigationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("courier.demo@getcaramel.app");
  const [password, setPassword] = useState("dev-password");
  const [fullName, setFullName] = useState("Courier Rider");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [riderId, setRiderId] = useState("rdr_001");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "history" | "notifications" | "account">("tasks");
  const [lastPulseAt, setLastPulseAt] = useState<string | null>(null);

  useEffect(() => {
    initMobileSentry();
  }, []);

  const load = async (activeRiderId: string, accessToken: string) => {
    const [taskResponse, notif, stateResponse, navResponse] = await Promise.all([
      fetchTasks(activeRiderId, accessToken),
      fetchNotifications(activeRiderId, accessToken),
      fetchRiderState(activeRiderId, accessToken),
      fetchNavigation(activeRiderId, accessToken),
    ]);
    setOrders(taskResponse.activeOrders);
    setNotifications(notif);
    setRiderState(stateResponse);
    setNavigation(navResponse);
    setLoading(false);
  };

  const signIn = async () => {
    if (mode === "forgot") {
      setAuthBusy(true);
      setAuthError(null);
      setAuthInfo(null);
      try {
        if (!resetToken || !newPassword) {
          const result = await requestCourierPasswordReset(identifier);
          if (result.resetToken) setResetToken(result.resetToken);
          setAuthInfo("If account exists, reset token has been issued. Enter token + new password.");
          return;
        }
        await confirmCourierPasswordReset(resetToken, newPassword);
        setAuthInfo("Password reset successful. You can now sign in.");
        setPassword(newPassword);
        setNewPassword("");
        setResetToken("");
        setMode("login");
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
    setLoading(true);
    try {
      const session = mode === "register"
        ? await registerCourier(identifier, password, fullName)
        : await loginCourier(identifier, password);
      setToken(session.tokens.accessToken);
      await registerPush(riderId, session.tokens.accessToken);
    } catch (error) {
      setToken(null);
      setLoading(false);
      setAuthError(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    let cancel = false;

    const wrapped = async () => {
      if (cancel) return;
      try {
        await load(riderId, token);
      } catch {
        setLoading(false);
      }
    };

    void wrapped();
    const pollId = setInterval(wrapped, 3500);
    return () => {
      cancel = true;
      clearInterval(pollId);
    };
  }, [token, riderId]);

  useEffect(() => {
    if (!token || !riderState || !navigation) return;
    let cancel = false;
    const pulse = async () => {
      if (cancel) return;
      const target = navigation.route[1] || navigation.route[0];
      if (!target) return;
      const next = moveToward(
        { latitude: riderState.latitude, longitude: riderState.longitude },
        { latitude: target.latitude, longitude: target.longitude },
      );
      try {
        const state = await updateRiderLocation(
          riderId,
          token,
          Number(next.latitude.toFixed(6)),
          Number(next.longitude.toFixed(6)),
          navigation.orderId ? "BUSY" : "ONLINE",
        );
        setRiderState(state);
        setLastPulseAt(new Date().toISOString());
      } catch {
        return;
      }
    };
    const pulseId = setInterval(() => { void pulse(); }, 2500);
    return () => {
      cancel = true;
      clearInterval(pulseId);
    };
  }, [token, riderId, riderState, navigation]);

  const current = orders[0] || null;
  const totalValue = useMemo(() => orders.reduce((sum, order) => sum + order.totalCents, 0), [orders]);

  const perform = async (orderId: string, next: "pickup" | "start" | "deliver") => {
    if (!token) return;
    setBusy(`${orderId}:${next}`);
    try {
      await action(orderId, riderId, next, token);
      await load(riderId, token);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setDrawerOpen(true)}>
          <Text style={styles.menuButtonText}>|||</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rider Dispatch</Text>
          <Text style={styles.sub}>Live route, ETA, and delivery operations.</Text>
        </View>
      </View>

      {token ? (
        <View style={styles.tabRow}>
          {[
            { id: "tasks", label: "Tasks" },
            { id: "history", label: "History" },
            { id: "notifications", label: "Alerts" },
            { id: "account", label: "Account" },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.tabButton, activeTab === item.id ? styles.tabButtonActive : undefined]}
              onPress={() => setActiveTab(item.id as "tasks" | "history" | "notifications" | "account")}
            >
              <Text style={activeTab === item.id ? styles.tabButtonTextActive : styles.tabButtonText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerPanel}>
            <Text style={styles.cardTitle}>Navigation</Text>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("tasks"); setDrawerOpen(false); }}>
              <Text style={styles.modeTextActive}>Current Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("history"); setDrawerOpen(false); }}>
              <Text style={styles.modeTextActive}>Delivery History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("notifications"); setDrawerOpen(false); }}>
              <Text style={styles.modeTextActive}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("account"); setDrawerOpen(false); }}>
              <Text style={styles.modeTextActive}>Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerClose} onPress={() => setDrawerOpen(false)}>
              <Text style={styles.modeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!token ? (
        <View style={styles.authShell}>
          <View style={styles.authCardMobile}>
            <TouchableOpacity style={styles.authBackBtn}>
              <Text style={styles.authBackText}>{"<"}</Text>
            </TouchableOpacity>
            <Text style={styles.authTitleCentered}>{mode === "register" ? "Create Account" : mode === "forgot" ? "Forgot Password" : "Log in"}</Text>
            <Text style={styles.authBodyCentered}>
              {mode === "register"
                ? "Create a new account to get started and enjoy seamless access to our features."
                : mode === "forgot"
                  ? "Enter your email address to receive a reset link and regain access to your account."
                  : "Enter your email and password to securely access your account and manage your services."}
            </Text>
            {mode === "register" ? (
              <View style={styles.authFieldRow}>
                <Text style={styles.authFieldIcon}>👤</Text>
                <TextInput style={styles.authFieldInput} value={fullName} onChangeText={setFullName} autoCapitalize="words" placeholder="Name" placeholderTextColor="#6b7280" />
              </View>
            ) : null}
            <View style={styles.authFieldRow}>
              <Text style={styles.authFieldIcon}>✉</Text>
              <TextInput style={styles.authFieldInput} value={identifier} onChangeText={setIdentifier} autoCapitalize="none" placeholder="Email address" placeholderTextColor="#6b7280" />
            </View>
            {mode !== "forgot" ? (
              <View style={styles.authFieldRow}>
                <Text style={styles.authFieldIcon}>🔒</Text>
                <TextInput style={styles.authFieldInput} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholder="Password" placeholderTextColor="#6b7280" />
                <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
                  <Text style={styles.authFieldIcon}>{showPassword ? "🙈" : "👁"}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {mode === "forgot" ? (
              <>
                <View style={styles.authFieldRow}>
                  <Text style={styles.authFieldIcon}>🎟</Text>
                  <TextInput style={styles.authFieldInput} value={resetToken} onChangeText={setResetToken} placeholder="Reset token" placeholderTextColor="#6b7280" />
                </View>
                <View style={styles.authFieldRow}>
                  <Text style={styles.authFieldIcon}>🔒</Text>
                  <TextInput style={styles.authFieldInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} placeholder="New password" placeholderTextColor="#6b7280" />
                </View>
              </>
            ) : null}
            <View style={styles.authFieldRow}>
              <Text style={styles.authFieldIcon}>🪪</Text>
              <TextInput style={styles.authFieldInput} value={riderId} onChangeText={setRiderId} autoCapitalize="none" placeholder="Rider ID (example: rdr_001)" placeholderTextColor="#6b7280" />
            </View>
            {mode !== "forgot" ? (
              <View style={styles.authMetaRow}>
                <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((value) => !value)}>
                  <View style={[styles.rememberBox, rememberMe ? styles.rememberBoxActive : undefined]} />
                  <Text style={styles.authMetaText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setMode("forgot"); setAuthError(null); setAuthInfo(null); }}>
                  <Text style={styles.authMetaText}>Forgot Password</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            {authInfo ? <Text style={styles.infoText}>{authInfo}</Text> : null}
            <TouchableOpacity style={styles.authButtonGreen} onPress={() => void signIn()} disabled={authBusy}>
              <Text style={styles.primaryText}>{authBusy ? "Signing in..." : mode === "register" ? "Create Account" : mode === "forgot" ? (resetToken && newPassword ? "Reset Password" : "Continue") : "Login"}</Text>
            </TouchableOpacity>
            <Text style={styles.authSwitchText}>
              {mode === "register" ? "Already have an account? " : "Don’t have an account? "}
              <Text style={styles.authSwitchLink} onPress={() => { setMode(mode === "register" ? "login" : "register"); setAuthError(null); setAuthInfo(null); }}>
                {mode === "register" ? "Sign In here" : "Sign Up here"}
              </Text>
            </Text>
            {mode === "forgot" ? (
              <Text style={styles.authSwitchLink} onPress={() => { setMode("login"); setAuthError(null); setAuthInfo(null); }}>
                Back to Sign In
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {token && activeTab === "tasks" ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rider: {riderId}</Text>
            <Text style={styles.line}>Active tasks: {orders.length}</Text>
            <Text style={styles.line}>Task value: ${(totalValue / 100).toFixed(2)}</Text>
            <Text style={styles.line}>Availability: {riderState?.availability || "..."}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Live Navigation</Text>
            <Text style={styles.line}>Order: {navigation?.orderId || "No active order"}</Text>
            <Text style={styles.line}>Status: {navigation?.status || "IDLE"}</Text>
            <Text style={styles.line}>ETA: {navigation?.etaMinutes ?? 0} min</Text>
            <Text style={styles.line}>Distance: {(navigation?.distanceKmRemaining ?? 0).toFixed(2)} km</Text>
            <Text style={styles.sectionHint}>{navigation?.nextInstruction || "Waiting for assignment"}</Text>
            <View style={styles.routePanel}>
              {(navigation?.route || []).map((point, index) => (
                <View key={`${point.label}-${index}`} style={styles.routeRow}>
                  <Text style={styles.routeStep}>{index + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>{point.label}</Text>
                    <Text style={styles.coord}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>
                  </View>
                </View>
              ))}
            </View>
            {lastPulseAt ? <Text style={styles.sectionHint}>Location sync: {lastPulseAt}</Text> : null}
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : null}

          {current ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{current.orderId}</Text>
              <Text style={styles.line}>Status: {current.status}</Text>
              <Text style={styles.line}>Pickup Vendor: {current.vendorId}</Text>
              <Text style={styles.line}>Dropoff: {current.addressLine}</Text>

              <View style={styles.row}>
                <TouchableOpacity style={[styles.button, styles.primaryButton]} disabled={!!busy} onPress={() => perform(current.orderId, "pickup")}>
                  <Text style={styles.primaryText}>Picked Up</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} disabled={!!busy} onPress={() => perform(current.orderId, "start")}>
                  <Text style={styles.secondaryText}>Start Trip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, styles.secondaryButton]} disabled={!!busy} onPress={() => perform(current.orderId, "deliver")}>
                  <Text style={styles.secondaryText}>Delivered</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.line}>No assigned tasks yet. Waiting for vendor-ready orders.</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notifications</Text>
            {notifications.slice(0, 4).map((n) => (
              <Text style={styles.line} key={n.id}>{n.title}: {n.body}</Text>
            ))}
          </View>
        </>
      ) : null}

      {token && activeTab === "history" ? (
        <ScrollView>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Deliveries</Text>
            <Text style={styles.sectionHint}>Recent rider tasks and outcomes.</Text>
            {orders.length === 0 ? <Text style={styles.line}>No history yet.</Text> : null}
            {orders.map((order) => (
              <View key={order.orderId} style={styles.historyRow}>
                <Text style={styles.line}>{order.orderId}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: toneForOrder(order.status).bg }]}>
                    <Text style={[styles.badgeText, { color: toneForOrder(order.status).fg }]}>{order.status}</Text>
                  </View>
                  <Text style={styles.line}>${(order.totalCents / 100).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {token && activeTab === "notifications" ? (
        <ScrollView>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rider Alerts</Text>
            {notifications.length === 0 ? <Text style={styles.line}>No alerts right now.</Text> : null}
            {notifications.map((n) => (
              <Text style={styles.line} key={n.id}>{n.title}: {n.body}</Text>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {token && activeTab === "account" ? (
        <ScrollView>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.sectionHint}>Profile and shift identity details.</Text>
            <Text style={styles.line}>Identifier: {identifier}</Text>
            <Text style={styles.line}>Rider ID: {riderId}</Text>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setToken(null)}>
              <Text style={styles.secondaryText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: SPACE.lg,
  },
  authShell: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 2,
    backgroundColor: "#e5e7eb",
  },
  authCardMobile: {
    backgroundColor: "#f3f4f6",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 18,
    gap: 10,
  },
  authBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  authBackText: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  authTitleCentered: { fontSize: 42, fontWeight: "800", color: "#020617", textAlign: "center", marginTop: 4 },
  authBodyCentered: { fontSize: 15, color: "#6b7280", textAlign: "center", marginBottom: 6, lineHeight: 21 },
  authFieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authFieldIcon: { fontSize: 14, color: "#64748b" },
  authFieldInput: { flex: 1, color: "#0f172a", fontSize: 15, paddingVertical: 0 },
  authMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rememberBox: { width: 15, height: 15, borderWidth: 1, borderColor: "#94a3b8", backgroundColor: "#fff" },
  rememberBoxActive: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  authMetaText: { color: "#334155", fontSize: 13 },
  authSwitchText: { textAlign: "center", color: "#4b5563", marginTop: 4, fontSize: 14 },
  authSwitchLink: { color: "#16a34a", fontWeight: "700", textAlign: "center", marginTop: 2 },
  authButtonGreen: {
    backgroundColor: "#35b97d",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    marginTop: 4,
  },
  header: {
    marginTop: SPACE.sm,
    marginBottom: SPACE.lg,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
  },
  sub: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 15,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.sm,
    backgroundColor: "#ffffff",
  },
  menuButtonText: {
    color: "#166534",
    fontWeight: "700",
  },
  tabRow: {
    flexDirection: "row",
    gap: SPACE.xs,
    marginBottom: SPACE.sm,
    flexWrap: "wrap",
  },
  tabButton: {
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    borderColor: colors.primary,
    backgroundColor: "#dcfce7",
  },
  tabButtonText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
  },
  drawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  drawerPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: SPACE.md,
    gap: SPACE.xs,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  drawerLink: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  drawerClose: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  historyRow: {
    marginTop: SPACE.xs,
    borderTopWidth: 1,
    borderTopColor: "#dcfce7",
    paddingTop: SPACE.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: SPACE.md,
    gap: SPACE.xs,
    marginBottom: SPACE.sm,
  },
  routePanel: {
    borderWidth: 1,
    borderColor: "#dcfce7",
    borderRadius: 10,
    padding: SPACE.sm,
    gap: SPACE.xs,
    backgroundColor: "#f8fafc",
  },
  routeRow: {
    flexDirection: "row",
    gap: SPACE.xs,
  },
  routeStep: {
    color: "#166534",
    fontWeight: "700",
    width: 22,
  },
  routeLabel: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
  coord: {
    color: colors.muted,
    fontSize: 12,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeRow: {
    flexDirection: "row",
    gap: SPACE.xs,
  },
  modeBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  modeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "#dcfce7",
  },
  modeText: {
    color: colors.muted,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#166534",
    fontWeight: "700",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },
  infoText: {
    color: "#166534",
    fontSize: 13,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionHint: {
    color: colors.muted,
    fontSize: 12,
  },
  line: {
    color: colors.muted,
    fontSize: 14,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  loader: {
    marginVertical: 20,
  },
  row: {
    marginTop: SPACE.xs,
    flexDirection: "row",
    gap: SPACE.xs,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: "#dcfce7",
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  secondaryText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
  },
});
