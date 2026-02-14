export interface HomeVendorCard {
  id: string;
  name: string;
  cuisine: string;
  etaMinutes: number;
  deliveryFeeCents: number;
  rating: number;
  heroColor: string;
}

export interface HomeBootstrapResponse {
  generatedAtIso: string;
  vendors: HomeVendorCard[];
}
