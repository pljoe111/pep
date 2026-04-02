/**
 * EmailTestController — provides testing endpoints for the email system
 */
import { inject } from 'tsyringe';
import { Controller, Post, Route, Tags, Security, Request, Body } from 'tsoa';
import { EmailService } from '../services/email.service';
import type { MessageResponseDto } from 'common';
import type { AuthRequest } from '../middleware/auth.middleware';

interface SendTestEmailRequest {
  recipient?: string; // Optional - defaults to the authenticated user's email
  subject?: string; // Optional - defaults to "Test Email"
}

@Route('email-test')
@Tags('EmailTest')
@Security('jwt') // Require authentication for all endpoints in this controller
export class EmailTestController extends Controller {
  constructor(@inject(EmailService) private readonly emailService: EmailService) {
    super();
  }

  /** POST /email-test/send - Send a test email */
  @Post('send')
  public async sendTestEmail(
    @Body() body: SendTestEmailRequest,
    @Request() req: AuthRequest
  ): Promise<MessageResponseDto> {
    // SAFETY: expressAuthentication guarantees req.user on @Security routes.
    const user = req.user;

    // Default to sending to the authenticated user if no recipient is specified
    const recipient = body.recipient || user.email;
    const subject = body.subject || 'Test Email from PEP Platform';

    // Get the current timestamp for the email
    const timestamp = new Date().toISOString();

    // Send a test email
    await this.emailService.send({
      to: recipient,
      subject,
      html: `
        <h1>Test Email</h1>
        <p>This is a test email sent at: ${timestamp}</p>
        <p>Current email provider: ${process.env.EMAIL_PROVIDER}</p>
        <p>If you're seeing this, the email system is working!</p>
      `,
      text: `Test Email
      
This is a test email sent at: ${timestamp}
Current email provider: ${process.env.EMAIL_PROVIDER}

If you're seeing this, the email system is working!`,
    });

    return { message: `Test email sent to ${recipient}` };
  }
}
