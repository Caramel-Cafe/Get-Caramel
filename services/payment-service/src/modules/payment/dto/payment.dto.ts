import { IsIn, IsInt, IsString, Min } from "class-validator";
import { PaymentMethod, PaymentStatus } from "@get-caramel/types";

const METHODS: PaymentMethod[] = ["CARD", "WALLET", "CASH"];
const STATUSES: PaymentStatus[] = ["REQUIRES_CONFIRMATION", "SUCCEEDED", "FAILED", "REFUNDED"];

export class CreatePaymentIntentDto {
  @IsString()
  orderId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  vendorId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsIn(METHODS)
  method!: PaymentMethod;
}

export class ConfirmPaymentDto {
  @IsString()
  paymentId!: string;
}

export class PaymentWebhookDto {
  @IsString()
  paymentId!: string;

  @IsIn(STATUSES)
  status!: PaymentStatus;

  @IsString()
  providerRef!: string;
}

export class WalletTopupDto {
  @IsString()
  customerId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;
}
