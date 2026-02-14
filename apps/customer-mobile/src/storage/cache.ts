import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthLoginResponse,
  CustomerCart,
  DiscoveryResponse,
  HomeBootstrapResponse,
} from "@get-caramel/types";

const SESSION_KEY = "gc_customer_session_v1";
const HOME_BOOTSTRAP_KEY = "gc_home_bootstrap_v1";
const DISCOVERY_KEY = "gc_discovery_v1";
const CART_KEY = "gc_cart_v1";

export async function saveSession(session: AuthLoginResponse): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthLoginResponse | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as AuthLoginResponse) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function saveHomeBootstrap(data: HomeBootstrapResponse): Promise<void> {
  await AsyncStorage.setItem(HOME_BOOTSTRAP_KEY, JSON.stringify(data));
}

export async function loadHomeBootstrap(): Promise<HomeBootstrapResponse | null> {
  const raw = await AsyncStorage.getItem(HOME_BOOTSTRAP_KEY);
  return raw ? (JSON.parse(raw) as HomeBootstrapResponse) : null;
}

export async function saveDiscovery(data: DiscoveryResponse): Promise<void> {
  await AsyncStorage.setItem(DISCOVERY_KEY, JSON.stringify(data));
}

export async function loadDiscovery(): Promise<DiscoveryResponse | null> {
  const raw = await AsyncStorage.getItem(DISCOVERY_KEY);
  return raw ? (JSON.parse(raw) as DiscoveryResponse) : null;
}

export async function saveCart(data: CustomerCart): Promise<void> {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(data));
}

export async function loadCart(): Promise<CustomerCart | null> {
  const raw = await AsyncStorage.getItem(CART_KEY);
  return raw ? (JSON.parse(raw) as CustomerCart) : null;
}
