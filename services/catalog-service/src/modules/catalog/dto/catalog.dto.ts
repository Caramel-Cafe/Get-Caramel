import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class OnboardVendorDto {
  @IsString()
  ownerUserId!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  cuisineTags!: string[];

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class CatalogItemDto {
  @IsString()
  itemId!: string;

  @IsString()
  name!: string;

  @IsString()
  description!: string;

  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsBoolean()
  isAvailable!: boolean;
}

export class CatalogSectionDto {
  @IsString()
  sectionId!: string;

  @IsString()
  title!: string;

  @IsArray()
  items!: CatalogItemDto[];
}

export class UpsertVendorMenuDto {
  @IsString()
  vendorId!: string;

  @IsArray()
  sections!: CatalogSectionDto[];
}
