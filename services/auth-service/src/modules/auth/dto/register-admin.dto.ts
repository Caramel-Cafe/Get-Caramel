import { IsString, MinLength } from "class-validator";

export class RegisterAdminDto {
  @IsString()
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(8)
  inviteCode!: string;
}
