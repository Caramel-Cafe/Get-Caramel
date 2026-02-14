import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  CatalogVendorSearchResponse,
  VendorMenu,
  VendorOnboardingResponse,
  VendorProfile,
} from "@get-caramel/types";
import { CatalogService } from "./catalog.service";
import { OnboardVendorDto, UpsertVendorMenuDto } from "./dto/catalog.dto";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post("vendors")
  onboardVendor(@Body() dto: OnboardVendorDto): Promise<VendorOnboardingResponse> {
    return this.catalogService.onboardVendor(dto);
  }

  @Get("vendors")
  listVendors(): Promise<VendorProfile[]> {
    return this.catalogService.listVendors();
  }

  @Get("vendors/search")
  searchVendors(
    @Query("q") q?: string,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("radiusKm") radiusKm?: string,
    @Query("limit") limit?: string,
  ): Promise<CatalogVendorSearchResponse> {
    return this.catalogService.searchVendors(
      q || "",
      lat !== undefined ? Number(lat) : undefined,
      lng !== undefined ? Number(lng) : undefined,
      Number(radiusKm || 8),
      Number(limit || 20),
    );
  }

  @Get("vendors/nearby")
  nearbyVendors(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("radiusKm") radiusKm?: string,
    @Query("limit") limit?: string,
  ): Promise<CatalogVendorSearchResponse> {
    return this.catalogService.nearbyVendors(
      Number(lat),
      Number(lng),
      Number(radiusKm || 8),
      Number(limit || 20),
    );
  }

  @Post("vendors/menu")
  upsertVendorMenu(@Body() dto: UpsertVendorMenuDto): Promise<VendorMenu> {
    return this.catalogService.upsertVendorMenu(dto);
  }

  @Get("vendors/:vendorId/menu")
  getVendorMenu(@Param("vendorId") vendorId: string): Promise<VendorMenu> {
    return this.catalogService.getVendorMenu(vendorId);
  }
}
