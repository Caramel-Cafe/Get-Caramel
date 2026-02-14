import { IsIn, IsString } from "class-validator";

export class RegisterPushTokenDto {
  @IsString()
  actorKey!: string;

  @IsString()
  token!: string;

  @IsIn(["ios", "android", "web"])
  platform!: "ios" | "android" | "web";
}
