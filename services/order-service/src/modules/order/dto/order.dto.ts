import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class AddCartItemDto {
  @IsString()
  customerId!: string;

  @IsString()
  vendorId!: string;

  @IsString()
  itemId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckoutDto {
  @IsString()
  customerId!: string;

  @IsString()
  addressLine!: string;
}

export class AssignRiderDto {
  @IsString()
  orderId!: string;

  @IsString()
  riderId!: string;
}

export class RiderOrderActionDto {
  @IsString()
  riderId!: string;
}

export class RiderLocationUpdateDto {
  @IsString()
  riderId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsIn(["ONLINE", "BUSY", "OFFLINE"])
  availability?: "ONLINE" | "BUSY" | "OFFLINE";
}

export class CreateReviewDto {
  @IsString()
  orderId!: string;

  @IsString()
  customerId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  comment!: string;
}

export class CreateSupportTicketDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsString()
  subject!: string;

  @IsString()
  description!: string;

  @IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
  priority!: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export class UpdateSupportTicketDto {
  @IsIn(["OPEN", "IN_PROGRESS", "RESOLVED", "ESCALATED"])
  status!: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ESCALATED";

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
