import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AuthLoginResponse,
  CustomerCart,
  DiscoveryMenuItem,
  DiscoveryResponse,
  DiscoveryVendor,
  NotificationItem,
  OrderRecord,
  PaymentIntentRecord,
  PaymentMethod,
  ReviewRecord,
  SupportTicketPriority,
  SupportTicketRecord,
} from "@get-caramel/types";
import {
  addCartItem,
  checkout,
  confirmPayment,
  createPaymentIntent,
  createReview,
  createSupportTicket,
  fetchCart,
  fetchCustomerNotifications,
  fetchCustomerOrders,
  fetchCustomerReviews,
  fetchCustomerSupportTickets,
  fetchDiscovery,
  getOrderPayment,
  login,
  PAYMENT_METHODS,
  register,
  requestPasswordReset,
  resetPassword,
  registerPushToken,
} from "./src/api/client";
import {
  clearSession,
  loadCart,
  loadDiscovery,
  loadSession,
  saveCart,
  saveDiscovery,
  saveSession,
} from "./src/storage/cache";
import { initMobileSentry } from "./src/observability/sentry";
import { colors } from "./src/theme/colors";

const { width } = Dimensions.get("window");

type OnboardingSlide = {
  key: string;
  title: string;
  highlight: string;
  body: string;
  accent: string;
};

const slides: OnboardingSlide[] = [
  { key: "discover", title: "Find", highlight: " Food You Love", body: "High-quality local restaurants with fast checkout.", accent: "#F97316" },
  { key: "delivery", title: "Fast", highlight: " Delivery", body: "Reliable dispatch and real-time courier updates.", accent: "#EA580C" },
  { key: "tracking", title: "Track", highlight: " Every Order", body: "Instant order state changes from kitchen to door.", accent: "#FB923C" },
];

const TICKET_PRIORITIES: SupportTicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const SPACING = { xs: 6, sm: 10, md: 14, lg: 18 };

function orderStatusTone(status: string): { bg: string; fg: string } {
  if (status === "DELIVERED") return { bg: "#dcfce7", fg: "#166534" };
  if (status === "CANCELED") return { bg: "#fee2e2", fg: "#991b1b" };
  if (status === "ON_THE_WAY") return { bg: "#dbeafe", fg: "#1d4ed8" };
  return { bg: "#ffedd5", fg: "#9a3412" };
}

const MenuItemRow = memo(function MenuItemRow({
  item,
  onAdd,
  disabled,
}: {
  item: DiscoveryMenuItem;
  onAdd: (item: DiscoveryMenuItem) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.menuRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuDesc}>{item.description}</Text>
      </View>
      <View style={styles.menuRight}>
        <Text style={styles.menuPrice}>${(item.priceCents / 100).toFixed(2)}</Text>
        <TouchableOpacity style={styles.addBtn} disabled={disabled} onPress={() => onAdd(item)}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const VendorCard = memo(function VendorCard({
  vendor,
  onAdd,
  busy,
}: {
  vendor: DiscoveryVendor;
  onAdd: (vendorId: string, item: DiscoveryMenuItem) => void;
  busy: boolean;
}) {
  return (
    <View style={styles.vendorCard}>
      <View style={styles.vendorHeader}>
        <Text style={styles.vendorName}>{vendor.name}</Text>
        <Text style={styles.vendorMeta}>{vendor.cuisine} | {vendor.etaMinutes} min | ${(vendor.deliveryFeeCents / 100).toFixed(2)} fee</Text>
      </View>

      {vendor.menu.map((item) => (
        <MenuItemRow
          key={item.itemId}
          item={item}
          disabled={busy}
          onAdd={(picked) => onAdd(vendor.vendorId, picked)}
        />
      ))}
    </View>
  );
});

function Onboarding({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<OnboardingSlide>>(null);

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (nextIndex !== index) setIndex(nextIndex);
  };

  const next = () => {
    const nextIndex = Math.min(index + 1, slides.length - 1);
    if (nextIndex === slides.length - 1 && index === slides.length - 1) {
      onDone();
      return;
    }

    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setIndex(nextIndex);
  };

  return (
    <>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={onDone}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.illustration, { borderColor: item.accent }]}>
              <Text style={styles.illustrationText}>GET CARAMEL</Text>
            </View>
            <Text style={styles.title}>
              {item.title}
              <Text style={[styles.title, { color: item.accent }]}>{item.highlight}</Text>
            </Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        onMomentumScrollEnd={onMomentumEnd}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((slide, i) => (
            <View key={slide.key} style={[styles.dot, i === index ? styles.dotActive : undefined]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={next}>
          <Text style={styles.nextText}>{"->"}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: AuthLoginResponse) => void }): React.JSX.Element {
  const [identifier, setIdentifier] = useState("customer@getcaramel.app");
  const [password, setPassword] = useState("password123");
  const [fullName, setFullName] = useState("Caramel Customer");
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const submit = async () => {
    if (mode === "forgot") {
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        if (!resetToken || !newPassword) {
          const result = await requestPasswordReset({ identifier, role: "customer" });
          if (result.resetToken) setResetToken(result.resetToken);
          setInfo("If account exists, reset token has been issued. Enter token + new password.");
          return;
        }
        await resetPassword(resetToken, newPassword);
        setInfo("Password reset successful. You can now sign in.");
        setPassword(newPassword);
        setNewPassword("");
        setResetToken("");
        setMode("login");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to reset password.");
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const session = mode === "register"
        ? await register({ identifier, password, fullName, role: "customer" })
        : await login({ identifier, password, role: "customer" });
      await saveSession(session);
      onLogin(session);
    } catch (nextError) {
      if (mode === "register" && String(nextError).toLowerCase().includes("already exists")) {
        setError("Account already exists. Switch to Sign In.");
      } else {
        setError(mode === "register" ? "Unable to create account. Try again." : "Unable to sign in. Check API and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
            <TextInput
              style={styles.authFieldInput}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              placeholder="Name"
              placeholderTextColor="#6b7280"
            />
          </View>
        ) : null}

        <View style={styles.authFieldRow}>
          <Text style={styles.authFieldIcon}>✉</Text>
          <TextInput
            style={styles.authFieldInput}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            placeholder="Email address"
            placeholderTextColor="#6b7280"
          />
        </View>

        {mode !== "forgot" ? (
          <View style={styles.authFieldRow}>
            <Text style={styles.authFieldIcon}>🔒</Text>
            <TextInput
              style={styles.authFieldInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Password"
              placeholderTextColor="#6b7280"
            />
            <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
              <Text style={styles.authFieldIcon}>{showPassword ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {mode === "forgot" ? (
          <>
            <View style={styles.authFieldRow}>
              <Text style={styles.authFieldIcon}>🎟</Text>
              <TextInput
                style={styles.authFieldInput}
                value={resetToken}
                onChangeText={setResetToken}
                placeholder="Reset token"
                placeholderTextColor="#6b7280"
              />
            </View>
            <View style={styles.authFieldRow}>
              <Text style={styles.authFieldIcon}>🔒</Text>
              <TextInput
                style={styles.authFieldInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                placeholder="New password"
                placeholderTextColor="#6b7280"
              />
            </View>
          </>
        ) : null}

        {mode !== "forgot" ? (
          <View style={styles.authMetaRow}>
            <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((value) => !value)}>
              <View style={[styles.rememberBox, rememberMe ? styles.rememberBoxActive : undefined]} />
              <Text style={styles.authMetaText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode("forgot"); setError(null); setInfo(null); }}>
              <Text style={styles.authMetaText}>Forgot Password</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {info ? <Text style={styles.successText}>{info}</Text> : null}

        <TouchableOpacity style={styles.authButtonGreen} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authButtonText}>{mode === "register" ? "Create Account" : mode === "forgot" ? (resetToken && newPassword ? "Reset Password" : "Continue") : "Login"}</Text>}
        </TouchableOpacity>

        <Text style={styles.authSwitchText}>
          {mode === "register" ? "Already have an account? " : "Don’t have an account? "}
          <Text style={styles.authSwitchLink} onPress={() => { setMode(mode === "register" ? "login" : "register"); setError(null); setInfo(null); }}>
            {mode === "register" ? "Sign In here" : "Sign Up here"}
          </Text>
        </Text>
        {mode === "forgot" ? (
          <Text style={styles.authSwitchLink} onPress={() => { setMode("login"); setError(null); setInfo(null); }}>
            Back to Sign In
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function HomeScreen({ session, onLogout }: { session: AuthLoginResponse; onLogout: () => void }): React.JSX.Element {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [cart, setCart] = useState<CustomerCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentIntentRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CARD");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [ordersHistory, setOrdersHistory] = useState<OrderRecord[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"explore" | "history" | "support" | "account">("explore");

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("Great quality and fast delivery.");
  const [ticketPriority, setTicketPriority] = useState<SupportTicketPriority>("MEDIUM");
  const [ticketSubject, setTicketSubject] = useState("Order question");
  const [ticketDescription, setTicketDescription] = useState("I need help with my latest order.");
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Burger");
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [featureQuantity, setFeatureQuantity] = useState(1);
  const [featureSize, setFeatureSize] = useState<"12" | "14" | "16" | "20">("14");

  const customerId = session.profile.userId;
  const accessToken = session.tokens.accessToken;
  const categories = ["Burger", "Pizza", "Potato", "Chicken"];

  const featuredItems = useMemo(() => {
    const rows = (discovery?.vendors || []).flatMap((vendor) =>
      vendor.menu.map((item) => ({
        ...item,
        vendorName: vendor.name,
        cuisine: vendor.cuisine,
      })));
    return rows.slice(0, 8);
  }, [discovery]);

  const filteredFeatured = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    const byCategory = featuredItems.filter((item) => {
      if (selectedCategory === "Burger") return item.name.toLowerCase().includes("burger");
      if (selectedCategory === "Pizza") return item.name.toLowerCase().includes("pizza");
      if (selectedCategory === "Potato") return item.name.toLowerCase().includes("fries") || item.name.toLowerCase().includes("potato");
      if (selectedCategory === "Chicken") return item.name.toLowerCase().includes("chicken");
      return true;
    });

    if (!q) return byCategory.length > 0 ? byCategory : featuredItems;
    const searched = (byCategory.length > 0 ? byCategory : featuredItems).filter((item) =>
      `${item.name} ${item.description} ${item.vendorName}`.toLowerCase().includes(q));
    return searched;
  }, [featuredItems, searchText, selectedCategory]);

  const selectedFeatured = useMemo(
    () => filteredFeatured.find((item) => item.itemId === selectedFeatureId) || filteredFeatured[0] || null,
    [filteredFeatured, selectedFeatureId],
  );
  const selectedFeaturedVendor = useMemo(
    () => (discovery?.vendors || []).find((vendor) => vendor.vendorId === selectedFeatured?.vendorId) || null,
    [discovery, selectedFeatured],
  );

  useEffect(() => {
    if (!selectedFeatureId && filteredFeatured[0]) setSelectedFeatureId(filteredFeatured[0].itemId);
  }, [filteredFeatured, selectedFeatureId]);

  useEffect(() => {
    registerPushToken(`customer:${customerId}`, `demo-customer-${customerId}`, "web", accessToken).catch(() => undefined);
  }, [customerId, accessToken]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const cachedDiscovery = await loadDiscovery();
      const cachedCart = await loadCart();

      if (!cancelled) {
        if (cachedDiscovery) setDiscovery(cachedDiscovery);
        if (cachedCart && cachedCart.customerId === customerId) setCart(cachedCart);
        if (cachedDiscovery || cachedCart) setLoading(false);
      }

      try {
        const [freshDiscovery, freshCart, customerOrders, notif, customerReviews, customerTickets] = await Promise.all([
          fetchDiscovery(accessToken),
          fetchCart(customerId, accessToken),
          fetchCustomerOrders(customerId, accessToken),
          fetchCustomerNotifications(customerId, accessToken),
          fetchCustomerReviews(customerId, accessToken),
          fetchCustomerSupportTickets(customerId, accessToken),
        ]);

        if (!cancelled) {
          const latest = customerOrders.orders[0] || null;
          setDiscovery(freshDiscovery);
          setCart(freshCart);
          setLastOrder(latest);
          setOrdersHistory(customerOrders.orders);
          setNotifications(notif);
          setReviews(customerReviews);
          setTickets(customerTickets);
          setLoading(false);
          setError(null);

          if (latest) {
            try {
              const payment = await getOrderPayment(latest.orderId, accessToken);
              if (!cancelled) setPaymentInfo(payment);
            } catch {
              if (!cancelled) setPaymentInfo(null);
            }
          }
        }

        await Promise.all([saveDiscovery(freshDiscovery), saveCart(freshCart)]);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError("Live data unavailable. Showing cached view.");
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [orders, notif, customerReviews, customerTickets] = await Promise.all([
          fetchCustomerOrders(customerId, accessToken),
          fetchCustomerNotifications(customerId, accessToken),
          fetchCustomerReviews(customerId, accessToken),
          fetchCustomerSupportTickets(customerId, accessToken),
        ]);
        if (!cancelled) {
          const latest = orders.orders[0] || null;
          setLastOrder(latest);
          setOrdersHistory(orders.orders);
          setNotifications(notif);
          setReviews(customerReviews);
          setTickets(customerTickets);
          if (latest) {
            try {
              const payment = await getOrderPayment(latest.orderId, accessToken);
              if (!cancelled) setPaymentInfo(payment);
            } catch {
              if (!cancelled) setPaymentInfo(null);
            }
          }
        }
      } catch {
        // keep current state on polling failure
      }
    };

    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [customerId, accessToken]);

  const heading = useMemo(() => `Hello, ${session.profile.fullName}`, [session.profile.fullName]);

  const onAdd = async (vendorId: string, item: DiscoveryMenuItem) => {
    setBusy(true);
    setError(null);
    try {
      const next = await addCartItem({ customerId, vendorId, itemId: item.itemId, quantity: 1 }, accessToken);
      setCart(next);
      await saveCart(next);
    } catch {
      setError("Unable to add item. Keep one vendor per cart.");
    } finally {
      setBusy(false);
    }
  };

  const onCheckout = async () => {
    if (!cart || cart.items.length === 0 || !cart.vendorId) return;

    setBusy(true);
    setError(null);
    try {
      const order = await checkout(customerId, "221B Baker Street", accessToken);
      setLastOrder(order);

      const intent = await createPaymentIntent({
        orderId: order.orderId,
        customerId: order.customerId,
        vendorId: order.vendorId,
        amountCents: order.totalCents,
        method: paymentMethod,
      }, accessToken);

      const finalPayment = intent.status === "REQUIRES_CONFIRMATION"
        ? await confirmPayment(intent.paymentId, accessToken)
        : intent;

      setPaymentInfo(finalPayment);

      const [nextCart, customerOrders, customerReviews] = await Promise.all([
        fetchCart(customerId, accessToken),
        fetchCustomerOrders(customerId, accessToken),
        fetchCustomerReviews(customerId, accessToken),
      ]);
      setCart(nextCart);
      setLastOrder(customerOrders.orders[0] || order);
      setReviews(customerReviews);
      await saveCart(nextCart);
    } catch {
      setError("Checkout/payment failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmitReview = async () => {
    if (!lastOrder || lastOrder.status !== "DELIVERED") {
      setError("Review is available after delivery.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await createReview({
        orderId: lastOrder.orderId,
        customerId,
        rating: reviewRating,
        comment: reviewComment,
      }, accessToken);
      setReviews((prev) => [created, ...prev.filter((r) => r.reviewId !== created.reviewId)]);
    } catch {
      setError("Unable to submit review. It may already exist for this order.");
    } finally {
      setBusy(false);
    }
  };

  const onOpenTicket = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createSupportTicket({
        customerId,
        orderId: lastOrder?.orderId,
        subject: ticketSubject,
        description: ticketDescription,
        priority: ticketPriority,
      }, accessToken);
      setTickets((prev) => [created, ...prev]);
    } catch {
      setError("Unable to open support ticket.");
    } finally {
      setBusy(false);
    }
  };

  const onPlaceFeaturedOrder = async () => {
    if (!selectedFeatured) return;
    setBusy(true);
    setError(null);
    try {
      const cartAfterAdd = await addCartItem({
        customerId,
        vendorId: selectedFeatured.vendorId,
        itemId: selectedFeatured.itemId,
        quantity: featureQuantity,
      }, accessToken);
      setCart(cartAfterAdd);
      await saveCart(cartAfterAdd);

      const order = await checkout(customerId, "221B Baker Street", accessToken);
      setLastOrder(order);

      const intent = await createPaymentIntent({
        orderId: order.orderId,
        customerId: order.customerId,
        vendorId: order.vendorId,
        amountCents: order.totalCents,
        method: paymentMethod,
      }, accessToken);
      const finalPayment = intent.status === "REQUIRES_CONFIRMATION"
        ? await confirmPayment(intent.paymentId, accessToken)
        : intent;
      setPaymentInfo(finalPayment);

      const [nextCart, customerOrders, customerReviews] = await Promise.all([
        fetchCart(customerId, accessToken),
        fetchCustomerOrders(customerId, accessToken),
        fetchCustomerReviews(customerId, accessToken),
      ]);
      setCart(nextCart);
      setLastOrder(customerOrders.orders[0] || order);
      setReviews(customerReviews);
      await saveCart(nextCart);
    } catch {
      setError("Unable to place featured order. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.homeWrap}>
      <View style={styles.homeHeaderRow}>
        <TouchableOpacity style={styles.menuTrigger} onPress={() => setDrawerOpen(true)}>
          <Text style={styles.menuTriggerText}>|||</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.homeHeading}>{heading}</Text>
          <Text style={styles.homeSub}>Discover, pay, track history, and get support</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {[
          { id: "explore", label: "Explore" },
          { id: "history", label: "History" },
          { id: "support", label: "Support" },
          { id: "account", label: "Account" },
        ].map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.tabBtn, activeTab === item.id ? styles.tabBtnActive : undefined]}
            onPress={() => setActiveTab(item.id as "explore" | "history" | "support" | "account")}
          >
            <Text style={activeTab === item.id ? styles.tabTextActive : styles.tabText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {drawerOpen ? (
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerPanel}>
            <Text style={styles.drawerTitle}>Menu</Text>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("explore"); setDrawerOpen(false); }}>
              <Text style={styles.drawerLinkText}>Explore Restaurants</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("history"); setDrawerOpen(false); }}>
              <Text style={styles.drawerLinkText}>Order History</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("support"); setDrawerOpen(false); }}>
              <Text style={styles.drawerLinkText}>Support Center</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerLink} onPress={() => { setActiveTab("account"); setDrawerOpen(false); }}>
              <Text style={styles.drawerLinkText}>Profile & Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerDanger} onPress={onLogout}>
              <Text style={styles.drawerDangerText}>Log out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerClose} onPress={() => setDrawerOpen(false)}>
              <Text style={styles.drawerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {activeTab === "explore" && loading && !discovery ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}

      {activeTab === "explore" ? (
        <FlatList
          data={discovery?.vendors || []}
          keyExtractor={(item) => item.vendorId}
          renderItem={({ item }) => <VendorCard vendor={item} onAdd={onAdd} busy={busy} />}
          contentContainerStyle={styles.vendorList}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.mockHomeWrap}>
              <View style={styles.mockTopRow}>
                <View>
                  <Text style={styles.mockHello}>Hello {session.profile.fullName.split(" ")[0]}</Text>
                  <Text style={styles.mockTitle}>Todays{"\n"}Special For You</Text>
                </View>
                <View style={styles.mockAvatar}>
                  <Text style={styles.mockAvatarText}>{session.profile.fullName.slice(0, 1).toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.mockSearchRow}>
                <Text style={styles.mockSearchIcon}>⌕</Text>
                <TextInput
                  style={styles.mockSearchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search items ..."
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity style={styles.mockFilterBtn}>
                  <Text style={styles.mockFilterText}>⚙</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.mockSectionTitle}>Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mockCategoryRow}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.mockCategoryCard, selectedCategory === category ? styles.mockCategoryCardActive : undefined]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={styles.mockCategoryIcon}>
                      {category === "Burger" ? "🍔" : category === "Pizza" ? "🍕" : category === "Potato" ? "🍟" : "🍗"}
                    </Text>
                    <Text style={styles.mockCategoryText}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mockFeatureRow}>
                {(filteredFeatured.length > 0 ? filteredFeatured : featuredItems).slice(0, 6).map((item, idx) => (
                  <TouchableOpacity
                    key={item.itemId}
                    style={[
                      styles.mockFeatureCard,
                      styles[idx % 2 === 0 ? "mockFeatureCardOrange" : "mockFeatureCardBlue"],
                      selectedFeatured?.itemId === item.itemId ? styles.mockFeatureCardActive : undefined,
                    ]}
                    onPress={() => setSelectedFeatureId(item.itemId)}
                  >
                    <Text style={styles.mockFeatureEmoji}>🍔</Text>
                    <Text style={styles.mockFeatureName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.mockFeatureSub} numberOfLines={1}>{item.vendorName}</Text>
                    <Text style={styles.mockFeaturePrice}>${(item.priceCents / 100).toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedFeatured ? (
                <View style={styles.mockDetailCard}>
                  <View style={styles.mockDetailHero}>
                    <TouchableOpacity style={styles.mockDetailBack}>
                      <Text style={styles.mockDetailBackText}>{"<"}</Text>
                    </TouchableOpacity>
                    <Text style={styles.mockDetailBurger}>🍔</Text>
                    <Text style={styles.mockDetailHeroTitle} numberOfLines={1}>{selectedFeatured.name}</Text>
                    <Text style={styles.mockDetailHeroSub}>Special {selectedFeaturedVendor?.cuisine || "Burger"}</Text>
                    <Text style={styles.mockDetailHeroPrice}>${(selectedFeatured.priceCents / 100).toFixed(2)}</Text>
                  </View>

                  <View style={styles.mockStatsWrap}>
                    <Text style={styles.mockDetailTitle}>{selectedFeaturedVendor?.name || selectedFeatured.vendorName}</Text>
                    <View style={styles.mockStatsRow}>
                      <View>
                        <Text style={styles.mockStars}>★★★★★</Text>
                        <Text style={styles.mockStatHint}>168 Reviews</Text>
                      </View>
                      <View>
                        <Text style={styles.mockStatStrong}>Free</Text>
                        <Text style={styles.mockStatHint}>Delivery</Text>
                      </View>
                      <View>
                        <Text style={styles.mockStatStrong}>{selectedFeaturedVendor?.etaMinutes || 38}</Text>
                        <Text style={styles.mockStatHint}>Minutes</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.mockDetailBody}>
                    <Text style={styles.mockSectionTitle}>Ingredients</Text>
                    <View style={styles.mockIngredients}>
                      {["🥩", "🍞", "🧅", "🍾", "🫘"].map((ingredient) => (
                        <View key={ingredient} style={styles.mockIngredientChip}>
                          <Text>{ingredient}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.mockQtyRow}>
                      <Text style={styles.mockDetailVendor}>Quantity</Text>
                      <View style={styles.mockQtyControl}>
                        <TouchableOpacity onPress={() => setFeatureQuantity((qty) => Math.max(1, qty - 1))}>
                          <Text style={styles.mockQtyButton}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.mockQtyValue}>{featureQuantity}</Text>
                        <TouchableOpacity onPress={() => setFeatureQuantity((qty) => qty + 1)}>
                          <Text style={styles.mockQtyButton}>＋</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.mockDetailVendor, { marginTop: 8, marginBottom: 6 }]}>Size</Text>
                    <View style={styles.mockSizeRow}>
                      {(["12", "14", "16", "20"] as const).map((size) => (
                        <TouchableOpacity key={size} style={[styles.mockSizeChip, featureSize === size ? styles.mockSizeChipActive : undefined]} onPress={() => setFeatureSize(size)}>
                          <Text style={featureSize === size ? styles.mockSizeTextActive : styles.mockSizeText}>{size}"</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.mockPlaceBtn} disabled={busy} onPress={onPlaceFeaturedOrder}>
                      <Text style={styles.mockPlaceText}>{busy ? "Working..." : "Place Order"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            <View style={styles.cartCard}>
              <Text style={styles.sectionHint}>All current functions are still active below.</Text>
              <Text style={styles.cartTitle}>Your Cart</Text>
              <Text style={styles.cartLine}>Items: {cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0}</Text>
              <Text style={styles.cartLine}>Subtotal: ${((cart?.subtotalCents || 0) / 100).toFixed(2)}</Text>
              <Text style={styles.cartLine}>Delivery: ${((cart?.deliveryFeeCents || 0) / 100).toFixed(2)}</Text>
              <Text style={styles.cartTotal}>Total: ${((cart?.totalCents || 0) / 100).toFixed(2)}</Text>

              <Text style={[styles.successText, { color: colors.text }]}>Payment Method</Text>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[styles.methodBtn, paymentMethod === method ? styles.methodBtnActive : undefined]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={paymentMethod === method ? styles.methodTextActive : styles.methodText}>{method}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.authButton, { marginTop: 10 }]}
                disabled={busy || !cart || cart.items.length === 0}
                onPress={onCheckout}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.authButtonText}>Pay & Checkout</Text>}
              </TouchableOpacity>

              {lastOrder ? (
                <View style={styles.orderStateCard}>
                  <Text style={styles.successText}>Latest: {lastOrder.orderId}</Text>
                  <View style={styles.badgeRow}>
                    <Text style={styles.cartLine}>Status:</Text>
                    <View style={[styles.badge, { backgroundColor: orderStatusTone(lastOrder.status).bg }]}>
                      <Text style={[styles.badgeText, { color: orderStatusTone(lastOrder.status).fg }]}>{lastOrder.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.cartLine}>Rider: {lastOrder.riderId || "Pending assignment"}</Text>
                </View>
              ) : null}

              {paymentInfo ? (
                <View style={styles.orderStateCard}>
                  <Text style={styles.successText}>Payment: {paymentInfo.status}</Text>
                  <Text style={styles.cartLine}>Method: {paymentInfo.method}</Text>
                  <Text style={styles.cartLine}>Risk Score: {paymentInfo.riskScore}</Text>
                  <Text style={styles.cartLine}>Risk Flagged: {paymentInfo.riskFlagged ? "Yes" : "No"}</Text>
                </View>
              ) : null}

              <View style={styles.orderStateCard}>
                <Text style={styles.successText}>Rate Last Delivered Order</Text>
                <View style={styles.methodRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={String(n)}
                      style={[styles.methodBtn, reviewRating === n ? styles.methodBtnActive : undefined]}
                      onPress={() => setReviewRating(n)}
                    >
                      <Text style={reviewRating === n ? styles.methodTextActive : styles.methodText}>{n}*</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Share your experience"
                  placeholderTextColor={colors.muted}
                />
                <TouchableOpacity style={[styles.authButton, { marginTop: 8 }]} disabled={busy} onPress={onSubmitReview}>
                  <Text style={styles.authButtonText}>Submit Review</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.orderStateCard}>
                <Text style={styles.successText}>Support Ticket</Text>
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  value={ticketSubject}
                  onChangeText={setTicketSubject}
                  placeholder="Subject"
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  value={ticketDescription}
                  onChangeText={setTicketDescription}
                  placeholder="Describe the issue"
                  placeholderTextColor={colors.muted}
                  multiline
                />
                <View style={styles.methodRow}>
                  {TICKET_PRIORITIES.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.methodBtn, ticketPriority === p ? styles.methodBtnActive : undefined]}
                      onPress={() => setTicketPriority(p)}
                    >
                      <Text style={ticketPriority === p ? styles.methodTextActive : styles.methodText}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.authButton, { marginTop: 8 }]} disabled={busy} onPress={onOpenTicket}>
                  <Text style={styles.authButtonText}>Open Ticket</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.orderStateCard}>
                <Text style={styles.successText}>My Reviews</Text>
                {reviews.length === 0 ? <Text style={styles.emptyStateText}>No reviews yet. Rate your first delivered order.</Text> : null}
                {reviews.slice(0, 4).map((review) => (
                  <Text style={styles.cartLine} key={review.reviewId}>
                    {review.orderId}: {review.rating}* ({review.moderationStatus})
                  </Text>
                ))}
              </View>

              <View style={styles.orderStateCard}>
                <Text style={styles.successText}>My Tickets</Text>
                {tickets.length === 0 ? <Text style={styles.emptyStateText}>No support tickets open.</Text> : null}
                {tickets.slice(0, 4).map((ticket) => (
                  <Text style={styles.cartLine} key={ticket.ticketId}>
                    {ticket.subject}: {ticket.status} ({ticket.priority})
                  </Text>
                ))}
              </View>

              <View style={styles.orderStateCard}>
                <Text style={styles.successText}>Notifications</Text>
                {notifications.length === 0 ? <Text style={styles.emptyStateText}>No alerts right now.</Text> : null}
                {notifications.slice(0, 4).map((n) => (
                  <Text style={styles.cartLine} key={n.id}>{n.title}: {n.body}</Text>
                ))}
              </View>
            </View>
          }
        />
      ) : null}

      {activeTab === "history" ? (
        <ScrollView contentContainerStyle={styles.vendorList}>
          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>Order History</Text>
            <Text style={styles.sectionHint}>Your latest 12 orders with delivery status.</Text>
            {ordersHistory.length === 0 ? <Text style={styles.cartLine}>No orders yet.</Text> : null}
            {ordersHistory.slice(0, 12).map((order) => (
              <View key={order.orderId} style={styles.orderStateCard}>
                <Text style={styles.successText}>{order.orderId}</Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.cartLine}>Status:</Text>
                  <View style={[styles.badge, { backgroundColor: orderStatusTone(order.status).bg }]}>
                    <Text style={[styles.badgeText, { color: orderStatusTone(order.status).fg }]}>{order.status}</Text>
                  </View>
                </View>
                <Text style={styles.cartLine}>Total: ${(order.totalCents / 100).toFixed(2)}</Text>
                <Text style={styles.cartLine}>Address: {order.addressLine}</Text>
              </View>
            ))}
          </View>
          {paymentInfo ? (
            <View style={styles.cartCard}>
              <Text style={styles.cartTitle}>Latest Payment</Text>
              <Text style={styles.cartLine}>Status: {paymentInfo.status}</Text>
              <Text style={styles.cartLine}>Method: {paymentInfo.method}</Text>
              <Text style={styles.cartLine}>Risk Score: {paymentInfo.riskScore}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {activeTab === "support" ? (
        <ScrollView contentContainerStyle={styles.vendorList}>
          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>Support Ticket</Text>
            <TextInput
              style={[styles.input, { marginTop: 6 }]}
              value={ticketSubject}
              onChangeText={setTicketSubject}
              placeholder="Subject"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.input, { marginTop: 6 }]}
              value={ticketDescription}
              onChangeText={setTicketDescription}
              placeholder="Describe the issue"
              placeholderTextColor={colors.muted}
              multiline
            />
            <View style={styles.methodRow}>
              {TICKET_PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.methodBtn, ticketPriority === p ? styles.methodBtnActive : undefined]}
                  onPress={() => setTicketPriority(p)}
                >
                  <Text style={ticketPriority === p ? styles.methodTextActive : styles.methodText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.authButton, { marginTop: 8 }]} disabled={busy} onPress={onOpenTicket}>
              <Text style={styles.authButtonText}>Open Ticket</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>My Tickets</Text>
            {tickets.length === 0 ? <Text style={styles.emptyStateText}>No support requests yet.</Text> : null}
            {tickets.slice(0, 8).map((ticket) => (
              <Text style={styles.cartLine} key={ticket.ticketId}>
                {ticket.subject}: {ticket.status} ({ticket.priority})
              </Text>
            ))}
          </View>

          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>Notifications</Text>
            {notifications.length === 0 ? <Text style={styles.emptyStateText}>No notifications yet.</Text> : null}
            {notifications.slice(0, 8).map((n) => (
              <Text style={styles.cartLine} key={n.id}>{n.title}: {n.body}</Text>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {activeTab === "account" ? (
        <ScrollView contentContainerStyle={styles.vendorList}>
          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>Profile</Text>
            <Text style={styles.cartLine}>Name: {session.profile.fullName}</Text>
            <Text style={styles.cartLine}>Role: {session.profile.role}</Text>
            <Text style={styles.cartLine}>User ID: {session.profile.userId}</Text>
            <TouchableOpacity style={[styles.authButton, { marginTop: 12 }]} onPress={onLogout}>
              <Text style={styles.authButtonText}>Log out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>My Reviews</Text>
            {reviews.length === 0 ? <Text style={styles.emptyStateText}>No reviews submitted yet.</Text> : null}
            {reviews.slice(0, 8).map((review) => (
              <Text style={styles.cartLine} key={review.reviewId}>
                {review.orderId}: {review.rating}* ({review.moderationStatus})
              </Text>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

export default function App(): React.JSX.Element {
  const [phase, setPhase] = useState<"loading" | "onboarding" | "auth" | "home">("loading");
  const [session, setSession] = useState<AuthLoginResponse | null>(null);

  useEffect(() => {
    initMobileSentry();
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const restored = await loadSession();
      if (!mounted) return;
      if (restored) {
        setSession(restored);
        setPhase("home");
      } else {
        setPhase("onboarding");
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const onLogout = async () => {
    await clearSession();
    setSession(null);
    setPhase("auth");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {phase === "loading" && (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {phase === "onboarding" && <Onboarding onDone={() => setPhase("auth")} />}
      {phase === "auth" && <LoginScreen onLogin={(nextSession) => { setSession(nextSession); setPhase("home"); }} />}
      {phase === "home" && session && <HomeScreen session={session} onLogout={onLogout} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center" },
  skipRow: { alignItems: "flex-end", paddingHorizontal: 22, paddingTop: 10 },
  skipText: { color: colors.primary, fontWeight: "600", fontSize: 16 },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  illustration: {
    width: 270,
    height: 240,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  illustrationText: { color: colors.text, fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 33, fontWeight: "800", color: colors.text, textAlign: "center" },
  body: { marginTop: 12, fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: "center", maxWidth: 320 },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 30,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FED7AA" },
  dotActive: { width: 24, backgroundColor: colors.primary },
  nextButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  nextText: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  authShell: { flex: 1, justifyContent: "center", paddingHorizontal: 18, backgroundColor: "#e5e7eb" },
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
  authWrap: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: SPACING.sm },
  authTitle: { fontSize: 34, fontWeight: "800", color: colors.text },
  authBody: { fontSize: 16, color: colors.muted, marginBottom: 16 },
  modeRow: { flexDirection: "row", gap: SPACING.xs, marginBottom: 4 },
  modeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  modeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  modeText: { color: colors.muted, fontWeight: "600" },
  modeTextActive: { color: colors.primaryDark, fontWeight: "700" },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    fontSize: 16,
    color: colors.text,
  },
  authButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  authButtonGreen: {
    backgroundColor: "#35b97d",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    marginTop: 4,
  },
  authButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorText: { color: "#B91C1C", fontSize: 14, marginBottom: 8 },
  successText: { color: "#166534", fontSize: 13, marginTop: 8, fontWeight: "600" },
  homeWrap: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  homeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  homeHeading: { fontSize: 26, fontWeight: "800", color: colors.text },
  homeSub: { fontSize: 14, color: colors.muted },
  menuTrigger: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: colors.card,
  },
  menuTriggerText: { color: colors.primaryDark, fontWeight: "700" },
  tabRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    flexWrap: "wrap",
  },
  tabBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  tabText: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
  drawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.35)",
    zIndex: 20,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  drawerPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: SPACING.xs,
  },
  drawerTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
  drawerLink: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceAlt,
  },
  drawerLinkText: { color: colors.primaryDark, fontWeight: "700" },
  drawerDanger: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fef2f2",
    marginTop: 6,
  },
  drawerDangerText: { color: "#b91c1c", fontWeight: "700" },
  drawerClose: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  drawerCloseText: { color: colors.muted, fontWeight: "700" },
  logoutText: { color: colors.primaryDark, fontWeight: "700" },
  sectionHint: { color: colors.muted, fontSize: 12, marginBottom: SPACING.xs },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  emptyStateText: { color: colors.muted, fontSize: 12, marginBottom: 2 },
  mockHomeWrap: {
    backgroundColor: "#eef2ff",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: SPACING.sm,
  },
  mockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  mockHello: { color: "#9ca3af", fontSize: 14, marginBottom: 2 },
  mockTitle: { color: "#111827", fontSize: 38, fontWeight: "800", lineHeight: 42 },
  mockAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  mockAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  mockSearchRow: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mockSearchIcon: { color: "#9ca3af", fontSize: 18 },
  mockSearchInput: { flex: 1, fontSize: 15, color: "#111827", marginLeft: 8 },
  mockFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#fb923c",
    alignItems: "center",
    justifyContent: "center",
  },
  mockFilterText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  mockSectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginTop: 12, marginBottom: 8 },
  mockCategoryRow: { gap: 10, paddingBottom: 2 },
  mockCategoryCard: {
    width: 84,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    paddingVertical: 10,
  },
  mockCategoryCardActive: { borderColor: "#fb923c", backgroundColor: "#ffedd5" },
  mockCategoryIcon: { fontSize: 24, marginBottom: 6 },
  mockCategoryText: { color: "#334155", fontWeight: "600" },
  mockFeatureRow: { gap: 10, paddingTop: 4, paddingBottom: 4 },
  mockFeatureCard: {
    width: 170,
    borderRadius: 18,
    padding: 12,
  },
  mockFeatureCardOrange: { backgroundColor: "#f97316" },
  mockFeatureCardBlue: { backgroundColor: "#06b6d4" },
  mockFeatureCardActive: { borderWidth: 2, borderColor: "#0f172a" },
  mockFeatureEmoji: { fontSize: 38, marginBottom: 6 },
  mockFeatureName: { color: "#fff", fontSize: 24, fontWeight: "800" },
  mockFeatureSub: { color: "#ffedd5", fontSize: 14, marginTop: 2 },
  mockFeaturePrice: { color: "#fff", fontSize: 34, fontWeight: "700", marginTop: 6 },
  mockDetailCard: {
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 0,
    overflow: "hidden",
  },
  mockDetailHero: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  mockDetailBack: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#fb923c",
    alignItems: "center",
    justifyContent: "center",
  },
  mockDetailBackText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  mockDetailBurger: { fontSize: 86, textAlign: "right", marginTop: -12 },
  mockDetailHeroTitle: { color: "#fff", fontWeight: "800", fontSize: 28, marginTop: -10 },
  mockDetailHeroSub: { color: "#ffedd5", fontSize: 16, marginTop: 2 },
  mockDetailHeroPrice: { color: "#fff", fontWeight: "800", fontSize: 42, marginTop: 6 },
  mockStatsWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  mockStatsRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mockStars: { color: "#f97316", fontWeight: "800", letterSpacing: 1.2, fontSize: 15 },
  mockStatStrong: { color: "#111827", fontWeight: "800", fontSize: 21, textAlign: "center" },
  mockStatHint: { color: "#94a3b8", fontSize: 13, marginTop: 1, textAlign: "center" },
  mockDetailBody: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  mockDetailTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  mockDetailVendor: { color: "#6b7280", fontSize: 14, marginTop: 2 },
  mockIngredients: { flexDirection: "row", gap: 8, marginBottom: 8 },
  mockIngredientChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  mockQtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  mockQtyControl: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 10,
  },
  mockQtyButton: { fontSize: 20, color: "#fb923c", fontWeight: "800" },
  mockQtyValue: { fontSize: 16, color: "#111827", fontWeight: "700", minWidth: 16, textAlign: "center" },
  mockSizeRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  mockSizeChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  mockSizeChipActive: { backgroundColor: "#fb923c", borderColor: "#fb923c" },
  mockSizeText: { color: "#475569", fontWeight: "700" },
  mockSizeTextActive: { color: "#fff", fontWeight: "700" },
  mockPlaceBtn: {
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#fb923c",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  mockPlaceText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  vendorList: { paddingBottom: 24, gap: SPACING.sm },
  vendorCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  vendorHeader: { marginBottom: 2 },
  vendorName: { fontSize: 18, fontWeight: "700", color: colors.text },
  vendorMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  menuRow: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  menuName: { fontSize: 14, color: colors.text, fontWeight: "600" },
  menuDesc: { fontSize: 12, color: colors.muted },
  menuRight: { alignItems: "flex-end", gap: 6 },
  menuPrice: { fontSize: 13, fontWeight: "700", color: colors.primaryDark },
  addBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  addBtnText: { color: "#9a3412", fontWeight: "700", fontSize: 12 },
  cartCard: {
    backgroundColor: "#fff7ed",
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.md,
    marginTop: 8,
  },
  methodRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: 6,
    flexWrap: "wrap",
  },
  methodBtn: {
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  methodBtnActive: {
    backgroundColor: "#fb923c",
    borderColor: "#ea580c",
  },
  methodText: {
    color: "#9a3412",
    fontWeight: "700",
    fontSize: 12,
  },
  methodTextActive: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  orderStateCard: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "#fdba74",
    paddingTop: 8,
  },
  cartTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 6 },
  cartLine: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  cartTotal: { fontSize: 16, color: colors.text, fontWeight: "800", marginTop: 6 },
});

