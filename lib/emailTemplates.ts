/**
 * Examly Branded Email Template System
 * 
 * Provides consistent, table-based HTML email templates compatible with standard email clients
 * using Examly's design tokens (Deep Teal #0F2D2E, Primary Teal #16B39A, Light Mint #6EE7D1).
 */

export interface WrapEmailOptions {
  headline: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

/**
 * Wraps arbitrary body content inside the standard Examly branded HTML email shell.
 */
export function wrapEmailContent({
  headline,
  bodyHtml,
  ctaText,
  ctaUrl,
  footerNote = 'This email was sent by Examly (noreply@examly.site).',
}: WrapEmailOptions): string {
  const ctaSection = ctaText && ctaUrl ? `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 20px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="17%" stroke="f" fillcolor="#16B39A">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;">${ctaText}</center>
          </v:roundrect>
          <![style]-->
          <a href="${ctaUrl}" target="_blank" style="background-color: #16B39A; color: #ffffff; display: inline-block; font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px -1px rgba(22, 179, 154, 0.2);">
            ${ctaText}
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 16px 0 0 0; text-align: center;">
      If the button above does not work, copy and paste this link into your browser:<br />
      <a href="${ctaUrl}" style="color: #16B39A; text-decoration: underline; word-break: break-all;">${ctaUrl}</a>
    </p>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #F7F8FA; font-family: 'Inter', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F7F8FA; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Email Container (Max 540px) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; border: 1px solid #E5E9F0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(15, 45, 46, 0.05);">
          
          <!-- Header Banner (Deep Teal #0F2D2E) -->
          <tr>
            <td align="center" style="background-color: #0F2D2E; padding: 28px 24px; text-align: center; border-bottom: 3px solid #16B39A;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" valign="middle">
                    <span style="font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      Exam<span style="color: #6EE7D1;">ly</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 32px 32px; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #1A1F23; font-size: 15px; line-height: 1.6;">
              <h1 style="font-family: 'Poppins', Helvetica, Arial, sans-serif; font-size: 22px; font-weight: 700; color: #0F2D2E; margin: 0 0 20px 0; text-align: center; letter-spacing: -0.3px;">
                ${headline}
              </h1>

              ${bodyHtml}

              ${ctaSection}
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background-color: #F7F8FA; padding: 24px 32px; border-top: 1px solid #E5E9F0; text-align: center; font-size: 12px; color: #5A6578; line-height: 1.5;">
              <p style="margin: 0 0 8px 0; font-weight: 500;">
                ${footerNote}
              </p>
              <p style="margin: 0; color: #8A94A6;">
                © 2026 Examly Inc. • <a href="https://examly.site" style="color: #16B39A; text-decoration: none;">examly.site</a> • <a href="mailto:support@examly.site" style="color: #16B39A; text-decoration: none;">support@examly.site</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Returns the HTML for Supabase Auth Signup Confirmation Email Template.
 */
export function getSignupConfirmationEmailHtml(confirmationUrl: string = '{{ .ConfirmationURL }}'): string {
  return wrapEmailContent({
    headline: 'Welcome to Examly!',
    bodyHtml: `
      <p style="margin: 0 0 16px 0;">Hi there,</p>
      <p style="margin: 0 0 16px 0;">Thank you for registering your teacher account on <strong>Examly</strong>. To activate your account and start creating oral AI exams, please confirm your email address by clicking the button below.</p>
      <p style="margin: 0;">This link is valid for 24 hours.</p>
    `,
    ctaText: 'Verify Email Address',
    ctaUrl: confirmationUrl,
    footerNote: 'This email was sent because you signed up for an account on Examly.',
  });
}

/**
 * Returns the HTML for Contact Form Support Notification Email.
 */
export function getContactNotificationEmailHtml(data: { name: string; email: string; subject: string; message: string }): string {
  return wrapEmailContent({
    headline: 'New Contact Form Submission',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;"><strong>From:</strong> ${data.name} (&lt;<a href="mailto:${data.email}" style="color: #16B39A;">${data.email}</a>&gt;)</p>
      <p style="margin: 0 0 16px 0;"><strong>Subject Category:</strong> ${data.subject}</p>
      <div style="background-color: #F7F8FA; border: 1px solid #E5E9F0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; color: #1A1F23; white-space: pre-wrap;">${data.message}</div>
    `,
    footerNote: 'Notification email generated from examly.site contact page.',
  });
}

/**
 * Returns the HTML for Contact Form Auto-Reply Email.
 */
export function getContactAutoReplyEmailHtml(name: string, subject: string): string {
  return wrapEmailContent({
    headline: 'We received your message!',
    bodyHtml: `
      <p style="margin: 0 0 16px 0;">Hi ${name},</p>
      <p style="margin: 0 0 16px 0;">Thank you for contacting Examly. We have received your inquiry regarding <strong>${subject}</strong>.</p>
      <p style="margin: 0 0 16px 0;">Our support team typically responds to all inquiries in <strong>under 4 hours</strong> during business hours (Mon–Fri, 9am–6pm EST).</p>
      <p style="margin: 0;">If you have additional details to share, simply reply to this email.</p>
    `,
    ctaText: 'Visit Examly',
    ctaUrl: 'https://examly.site',
    footerNote: 'You are receiving this automated confirmation because you submitted a contact request on examly.site.',
  });
}

/**
 * Returns the HTML for Supabase Auth Password Reset Email Template.
 */
export function getPasswordResetEmailHtml(resetUrl: string = '{{ .ConfirmationURL }}'): string {
  return wrapEmailContent({
    headline: 'Reset Your Examly Password',
    bodyHtml: `
      <p style="margin: 0 0 16px 0;">Hi there,</p>
      <p style="margin: 0 0 16px 0;">We received a request to reset the password for your <strong>Examly</strong> teacher account.</p>
      <p style="margin: 0 0 16px 0;">Click the button below to set a new password for your account. This link is valid for 24 hours.</p>
      <p style="margin: 0;">If you did not request a password reset, you can safely ignore this email.</p>
    `,
    ctaText: 'Reset Password',
    ctaUrl: resetUrl,
    footerNote: 'This email was sent because a password reset was requested for your Examly account.',
  });
}

