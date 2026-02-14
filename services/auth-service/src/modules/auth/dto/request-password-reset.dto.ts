import { IsIn, IsString } from "class-validator";
import { UserRole } from "@get-caramel/types";

const ALLOWED_ROLES: UserRole[] = ["customer", "vendor_owner", "courier", "admin"];

export class RequestPasswordResetDto {
  @IsString()
  identifier!: string;

  @IsIn(ALLOWED_ROLES)
  role!: UserRole;
}
