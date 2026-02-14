export interface VendorProfile {
  vendorId: string;
  ownerUserId: string;
  name: string;
  description: string;
  isOpen: boolean;
  prepTimeMinutes: number;
  cuisineTags: string[];
  latitude?: number;
  longitude?: number;
}

export interface VendorOnboardingRequest {
  ownerUserId: string;
  name: string;
  description: string;
  cuisineTags: string[];
  latitude?: number;
  longitude?: number;
}

export interface VendorOnboardingResponse {
  vendor: VendorProfile;
}

export interface CatalogItem {
  itemId: string;
  name: string;
  description: string;
  priceCents: number;
  isAvailable: boolean;
}

export interface CatalogSection {
  sectionId: string;
  title: string;
  items: CatalogItem[];
}

export interface VendorMenu {
  vendorId: string;
  sections: CatalogSection[];
  updatedAtIso: string;
}

export interface UpsertVendorMenuRequest {
  vendorId: string;
  sections: CatalogSection[];
}

export interface CatalogVendorSearchItem {
  vendor: VendorProfile;
  distanceKm: number | null;
  rankScore: number;
  matchedTerms: string[];
}

export interface CatalogVendorSearchResponse {
  query: string;
  origin?: { latitude: number; longitude: number };
  radiusKm: number;
  limit: number;
  total: number;
  items: CatalogVendorSearchItem[];
}
