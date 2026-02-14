import { UnifiedPersistence } from "@get-caramel/persistence";
import {
  CatalogVendorSearchItem,
  CatalogVendorSearchResponse,
  UpsertVendorMenuRequest,
  VendorMenu,
  VendorOnboardingRequest,
  VendorOnboardingResponse,
  VendorProfile,
} from "@get-caramel/types";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private readonly vendors = new Map<string, VendorProfile>();
  private readonly menus = new Map<string, VendorMenu>();
  private readonly persistence = new UnifiedPersistence({
    namespace: "catalog-service",
    postgresUrl: process.env.CATALOG_DATABASE_URL || process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    log: (message: string) => this.logger.log(message),
  });
  private readonly vendorsCacheTtlSec = 15;
  private readonly menuCacheTtlSec = 30;
  private readonly searchCacheTtlSec = 10;

  async onboardVendor(input: VendorOnboardingRequest): Promise<VendorOnboardingResponse> {
    const vendor: VendorProfile = {
      vendorId: `vnd_${randomUUID().slice(0, 10)}`,
      ownerUserId: input.ownerUserId,
      name: input.name,
      description: input.description,
      isOpen: true,
      prepTimeMinutes: 20,
      cuisineTags: input.cuisineTags,
      latitude: input.latitude,
      longitude: input.longitude,
    };

    this.vendors.set(vendor.vendorId, vendor);
    const emptyMenu: VendorMenu = {
      vendorId: vendor.vendorId,
      sections: [],
      updatedAtIso: new Date().toISOString(),
    };
    this.menus.set(vendor.vendorId, emptyMenu);

    await this.refreshVendorsCache();
    await this.writeMenuCache(vendor.vendorId, emptyMenu);
    return { vendor };
  }

  async upsertVendorMenu(input: UpsertVendorMenuRequest): Promise<VendorMenu> {
    if (!this.vendors.has(input.vendorId)) {
      throw new NotFoundException("Vendor not found");
    }

    const menu: VendorMenu = {
      vendorId: input.vendorId,
      sections: input.sections,
      updatedAtIso: new Date().toISOString(),
    };

    this.menus.set(input.vendorId, menu);
    await this.writeMenuCache(input.vendorId, menu);
    return menu;
  }

  async getVendorMenu(vendorId: string): Promise<VendorMenu> {
    const cached = await this.persistence.getCache(this.menuCacheKey(vendorId));
    if (cached) {
      return JSON.parse(cached) as VendorMenu;
    }

    const menu = this.menus.get(vendorId);
    if (!menu) throw new NotFoundException("Menu not found");

    await this.writeMenuCache(vendorId, menu);
    return menu;
  }

  async listVendors(): Promise<VendorProfile[]> {
    const cached = await this.persistence.getCache("vendors:list");
    if (cached) {
      return JSON.parse(cached) as VendorProfile[];
    }

    const vendors = Array.from(this.vendors.values());
    await this.persistence.setCache("vendors:list", JSON.stringify(vendors), this.vendorsCacheTtlSec);
    return vendors;
  }

  async searchVendors(
    query: string,
    latitude?: number,
    longitude?: number,
    radiusKm = 8,
    limit = 20,
  ): Promise<CatalogVendorSearchResponse> {
    const normalizedQuery = query.trim().toLowerCase();
    const safeLimit = this.bound(limit, 1, 100);
    const safeRadiusKm = this.bound(radiusKm, 1, 100);
    const origin = this.validOrigin(latitude, longitude);

    const cacheKey = this.searchCacheKey(normalizedQuery, origin?.latitude, origin?.longitude, safeRadiusKm, safeLimit);
    const cached = await this.persistence.getCache(cacheKey);
    if (cached) return JSON.parse(cached) as CatalogVendorSearchResponse;

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const vendors = await this.listVendors();
    const ranked = vendors
      .map((vendor) => this.rankVendor(vendor, terms, origin, safeRadiusKm))
      .filter((item): item is CatalogVendorSearchItem => item !== null)
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, safeLimit);

    const response: CatalogVendorSearchResponse = {
      query: query.trim(),
      origin: origin || undefined,
      radiusKm: safeRadiusKm,
      limit: safeLimit,
      total: ranked.length,
      items: ranked,
    };

    await this.persistence.setCache(cacheKey, JSON.stringify(response), this.searchCacheTtlSec);
    return response;
  }

  async nearbyVendors(
    latitude: number,
    longitude: number,
    radiusKm = 8,
    limit = 20,
  ): Promise<CatalogVendorSearchResponse> {
    return this.searchVendors("", latitude, longitude, radiusKm, limit);
  }

  private rankVendor(
    vendor: VendorProfile,
    terms: string[],
    origin: { latitude: number; longitude: number } | null,
    radiusKm: number,
  ): CatalogVendorSearchItem | null {
    const haystack = `${vendor.name} ${vendor.description} ${vendor.cuisineTags.join(" ")}`.toLowerCase();
    const matchedTerms = terms.filter((term) => haystack.includes(term));
    if (terms.length > 0 && matchedTerms.length === 0) return null;

    const distanceKm = this.distanceFromOrigin(vendor, origin);
    if (origin && distanceKm !== null && distanceKm > radiusKm) return null;

    const textScore = terms.length === 0 ? 0.35 : matchedTerms.length / Math.max(terms.length, 1);
    const distanceScore = distanceKm === null ? 0.2 : Math.max(0, 1 - (distanceKm / Math.max(radiusKm, 1)));
    const openScore = vendor.isOpen ? 0.15 : 0;
    const rankScore = Number(((textScore * 0.6) + (distanceScore * 0.25) + openScore).toFixed(4));

    return {
      vendor,
      distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
      rankScore,
      matchedTerms,
    };
  }

  private distanceFromOrigin(
    vendor: VendorProfile,
    origin: { latitude: number; longitude: number } | null,
  ): number | null {
    if (!origin) return null;
    if (vendor.latitude === undefined || vendor.longitude === undefined) return null;
    return this.haversineKm(origin.latitude, origin.longitude, vendor.latitude, vendor.longitude);
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (value: number): number => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      (Math.sin(dLat / 2) ** 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLng / 2) ** 2);
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private validOrigin(latitude?: number, longitude?: number): { latitude: number; longitude: number } | null {
    if (latitude === undefined || longitude === undefined) return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    if (latitude < -90 || latitude > 90) return null;
    if (longitude < -180 || longitude > 180) return null;
    return { latitude, longitude };
  }

  private bound(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private searchCacheKey(
    query: string,
    latitude?: number,
    longitude?: number,
    radiusKm?: number,
    limit?: number,
  ): string {
    return `vendors:search:q=${query}|lat=${latitude ?? ""}|lng=${longitude ?? ""}|r=${radiusKm ?? ""}|l=${limit ?? ""}`;
  }

  private async refreshVendorsCache(): Promise<void> {
    const vendors = Array.from(this.vendors.values());
    await this.persistence.setCache("vendors:list", JSON.stringify(vendors), this.vendorsCacheTtlSec);
  }

  private async writeMenuCache(vendorId: string, menu: VendorMenu): Promise<void> {
    await this.persistence.setCache(this.menuCacheKey(vendorId), JSON.stringify(menu), this.menuCacheTtlSec);
  }

  private menuCacheKey(vendorId: string): string {
    return `vendors:${vendorId}:menu`;
  }
}
