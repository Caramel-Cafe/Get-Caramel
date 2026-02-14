import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthLoginResponse, HomeBootstrapResponse } from "@get-caramel/types";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { LogoutDto } from "./dto/logout.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { RegisterAdminDto } from "./dto/register-admin.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto): Promise<AuthLoginResponse> {
    return this.authService.login(dto);
  }

  @Post("register")
  async register(@Body() dto: RegisterDto): Promise<AuthLoginResponse> {
    return this.authService.register(dto);
  }

  @Post("register-admin")
  async registerAdmin(@Body() dto: RegisterAdminDto): Promise<AuthLoginResponse> {
    return this.authService.registerAdmin(dto);
  }

  @Post("refresh")
  async refresh(@Body() dto: RefreshDto): Promise<AuthLoginResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  async logout(@Body() dto: LogoutDto): Promise<{ success: true }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post("request-password-reset")
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ success: true; resetToken?: string }> {
    return this.authService.requestPasswordReset(dto);
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string): { userId: string; fullName: string; role: string } {
    const token = this.extractBearer(authorization);
    return this.authService.getProfileFromAccessToken(token);
  }

  @Get("bootstrap-home")
  bootstrapHome(@Headers("authorization") authorization?: string): HomeBootstrapResponse {
    const token = this.extractBearer(authorization);
    const profile = this.authService.getProfileFromAccessToken(token);
    return this.authService.getHomeBootstrapForUser(profile.userId);
  }

  private extractBearer(authorization?: string): string {
    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    return authorization.slice("Bearer ".length).trim();
  }
}
