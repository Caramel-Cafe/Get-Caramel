import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { IsNumber, IsOptional, Max, Min } from "class-validator";
import { DeliveryService } from "./delivery.service";

class CourierLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;
}

class DispatchPreviewDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;
}

class CourierLoadDto {
  @IsNumber()
  @Min(0)
  activeOrders!: number;
}

@Controller("delivery")
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post("couriers/:courierId/location")
  updateCourierLocation(@Param("courierId") courierId: string, @Body() dto: CourierLocationDto): unknown {
    return this.delivery.upsertLocation(courierId, dto.lat, dto.lng, dto.heading);
  }

  @Get("couriers/:courierId/location")
  getCourierLocation(@Param("courierId") courierId: string): unknown {
    return this.delivery.getLocation(courierId);
  }

  @Post("couriers/:courierId/load")
  updateCourierLoad(@Param("courierId") courierId: string, @Body() dto: CourierLoadDto): unknown {
    return this.delivery.setCourierLoad(courierId, dto.activeOrders);
  }

  @Post("dispatch/preview")
  previewDispatch(@Body() dto: DispatchPreviewDto): unknown {
    return this.delivery.previewDispatch(dto.lat, dto.lng, dto.limit);
  }

  @Get("dispatch/preview")
  previewDispatchGet(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("limit") limit?: string,
  ): unknown {
    return this.delivery.previewDispatch(Number(lat), Number(lng), limit ? Number(limit) : undefined);
  }
}
