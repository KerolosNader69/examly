import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not defined.');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

/**
 * Utility function to send emails via Resend.
 * Default sender is Examly <noreply@examly.site>.
 */
export async function sendEmail(options: SendEmailOptions) {
  const resend = getResendClient();
  const fromAddress = options.from || 'Examly <noreply@examly.site>';

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });

  if (error) {
    console.error('[sendEmail] Failed to send email via Resend:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}
