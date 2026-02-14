import { IsIn, IsString, MinLength } from "class-validator";
import { UserRole } from "@get-caramel/types";

const ALLOWED_ROLES: UserRole[] = ["customer", "vendor_owner", "courier", "admin"];

export class RegisterDto {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(ALLOWED_ROLES)
  role!: UserRole;

  @IsString()
  @MinLength(2)
  fullName!: string;
}
