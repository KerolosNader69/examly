import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/sendEmail';
import { getContactNotificationEmailHtml, getContactAutoReplyEmailHtml } from '@/lib/emailTemplates';
import { validateContactInput } from '@/lib/contactInput';
import { getRateLimiter, tooManyRequests } from '@/lib/rateLimit';
import { getTrustedClientIp } from '@/lib/clientIp';

export const dynamic = 'force-dynamic';

// Per sender IP and per submitted email address. Both are checked BEFORE any email is
// sent, so the auto-reply can't be used to mail-bomb an arbitrary address.
const perIp = getRateLimiter({ name: 'contact-ip', max: 5, windowMs: 60 * 60 * 1000 });
const perEmail = getRateLimiter({ name: 'contact-email', max: 3, windowMs: 24 * 60 * 60 * 1000 });

export async function POST(request: Request) {
  const ipRl = await perIp.limit(getTrustedClientIp(request));
  if (!ipRl.allowed) {
    const r = tooManyRequests(ipRl.retryAfterSeconds, 'Too many messages. Please try again later.');
    return NextResponse.json(r.body, r.init);
  }

  const body = await request.json().catch(() => null);
  const parsed = validateContactInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name, email, subject, message } = parsed.value;

  const emailRl = await perEmail.limit(email);
  if (!emailRl.allowed) {
    const r = tooManyRequests(emailRl.retryAfterSeconds, 'Too many messages from this address. Please try again later.');
    return NextResponse.json(r.body, r.init);
  }

  try {
    // 1. Notification to support (all user values are HTML-escaped by the template)
    const notificationResult = await sendEmail({
      to: 'support@examly.site',
      from: 'Examly Contact Form <noreply@examly.site>',
      replyTo: email,
      subject: `${subject} - New Contact Form Submission`,
      html: getContactNotificationEmailHtml({ name, email, subject, message }),
      text: `New Contact Form Submission\nFrom: ${name} (${email})\nSubject: ${subject}\n\nMessage:\n${message}`,
    });

    // 2. Auto-reply: only to a validated address that passed both rate limits above.
    //    It contains no user-supplied message text (only the escaped name/subject).
    const autoReplyResult = await sendEmail({
      to: email,
      from: 'Examly <noreply@examly.site>',
      subject: 'We received your message',
      html: getContactAutoReplyEmailHtml(name, subject),
      text: `Hi ${name},\n\nThank you for contacting Examly. We have received your inquiry regarding ${subject}.\n\nOur team typically responds to all support requests in under 4 hours during business hours (Mon–Fri, 9am–6pm EST).\n\nBest regards,\nThe Examly Support Team\nhttps://examly.site`,
    });

    return NextResponse.json({
      success: true,
      notificationEmailId: notificationResult?.id,
      autoReplyEmailId: autoReplyResult?.id,
    });
  } catch (error) {
    console.error('[API /api/contact Error]:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to submit contact form' }, { status: 500 });
  }
}
