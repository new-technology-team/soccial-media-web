import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthOtpController {
  constructor(private authService: AuthService) {}

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() body: { emailOrPhone: string }) {
    // In demo mode, return a mock reset code (no actual email)
    return {
      message: 'Mã đặt lại đã được gửi thành công (demo mode)',
      resetCode: '123456',
      otpSent: true,
      otpChannel: 'console',
      otpDestination: body.emailOrPhone,
      otpReason: 'Demo mode - code logged to console',
      otpError: null,
    };
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(
    @Body() body: { emailOrPhone: string; code: string; newPassword: string },
  ) {
    if (body.code !== '123456') {
      throw new Error('Mã đặt lại không đúng');
    }
    // Demo: just return success - in production would update DB
    return { message: 'Đặt lại mật khẩu thành công' };
  }
}
