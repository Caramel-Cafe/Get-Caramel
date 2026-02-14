import { IsIn, IsString, MinLength } from "class-validator";
import { UserRole } from "@get-caramel/types";

const ALLOWED_ROLES: UserRole[] = ["customer", "vendor_owner", "courier", "admin"];

export class LoginDto {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(ALLOWED_ROLES)
  role!: UserRole;
}
