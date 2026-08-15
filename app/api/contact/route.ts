import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/sendEmail';
import { getContactNotificationEmailHtml, getContactAutoReplyEmailHtml } from '@/lib/emailTemplates';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }
    if (!message || !message.trim() || message.trim().length < 10) {
      return NextResponse.json({ error: 'Message must be at least 10 characters long' }, { status: 400 });
    }

    const categorySubject = subject || 'General Inquiry';

    // 1. Send notification email to support@examly.site
    const notificationResult = await sendEmail({
      to: 'support@examly.site',
      from: 'Examly Contact Form <noreply@examly.site>',
      replyTo: email,
      subject: `${categorySubject} - New Contact Form Submission`,
      html: getContactNotificationEmailHtml({ name, email, subject: categorySubject, message }),
      text: `New Contact Form Submission\nFrom: ${name} (${email})\nSubject: ${categorySubject}\n\nMessage:\n${message}`,
    });

    // 2. Send auto-reply confirmation to the submitter
    const autoReplyResult = await sendEmail({
      to: email,
      from: 'Examly <noreply@examly.site>',
      subject: 'We received your message',
      html: getContactAutoReplyEmailHtml(name, categorySubject),
      text: `Hi ${name},\n\nThank you for contacting Examly. We have received your inquiry regarding ${categorySubject}.\n\nOur team typically responds to all support requests in under 4 hours during business hours (Mon–Fri, 9am–6pm EST).\n\nBest regards,\nThe Examly Support Team\nhttps://examly.site`,
    });

    return NextResponse.json({
      success: true,
      notificationEmailId: notificationResult?.id,
      autoReplyEmailId: autoReplyResult?.id,
    });
  } catch (error: any) {
    console.error('[API /api/contact Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to submit contact form' },
      { status: 500 }
    );
  }
}
