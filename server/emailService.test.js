import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateOtpCode,
  isValidEmail,
  buildOtpEmailHtml,
  buildAgentWelcomeEmailHtml,
  buildResetPasswordEmailHtml,
  normalizeEmail,
  OTP_TTL_MS,
  resolveContactEmailRecipients,
  resolveEmailSender,
  sendAgentWelcomeEmail,
} from './emailService.js';

test('generateOtpCode returns a 6-digit code', () => {
  const code = generateOtpCode();
  assert.equal(code.length, 6);
  assert.match(code, /^\d{6}$/);
});

test('email validation detects real addresses', () => {
  assert.equal(isValidEmail('test@example.com'), true);
  assert.equal(isValidEmail('bad-email'), false);
});

test('otp email includes the code and expiry message', () => {
  const html = buildOtpEmailHtml('456789', 10);
  assert.match(html, /456789/);
  assert.match(html, /10 minutes/);
});

test('normalizeEmail lowercases and trims input', () => {
  assert.equal(normalizeEmail('  USER@EXAMPLE.COM  '), 'user@example.com');
});

test('OTP TTL is 10 minutes', () => {
  assert.equal(OTP_TTL_MS, 600000);
});

test('agent welcome email includes the password in the credential block', () => {
  const html = buildAgentWelcomeEmailHtml({
    name: 'Alice',
    email: 'agent@example.com',
    password: 'Secret123',
    parentAdminEmail: 'admin@example.com',
  });

  assert.match(html, /Mot de passe/i);
  assert.match(html, /Secret123/);
  assert.match(html, /agent@example.com/);
});

test('reset password email contains the reset link and expiry information', () => {
  const html = buildResetPasswordEmailHtml({
    name: 'Alice',
    resetUrl: 'http://localhost:5173/reset-password?token=abc123',
    expiresInMinutes: 60,
  });

  assert.match(html, /Réinitialiser mon mot de passe/i);
  assert.match(html, /abc123/);
  assert.match(html, /60 minutes/i);
});

test('email sender uses the requested Gmail mailbox as the visible From address', () => {
  const sender = resolveEmailSender({
    from: 'Waiting Line <fileattente.team@gmail.com>',
    replyTo: 'fileattente.team@gmail.com',
  });

  assert.equal(sender.from, 'Waiting Line <fileattente.team@gmail.com>');
  assert.equal(sender.replyTo, 'fileattente.team@gmail.com');
  assert.match(sender.from, /fileattente\.team@gmail\.com/);
});

test('contact emails go to the team inbox and copy the client', () => {
  const recipients = resolveContactEmailRecipients({
    contactEmail: 'fileattente.team@gmail.com',
    clientEmail: 'client@example.com',
  });

  assert.equal(recipients.to, 'fileattente.team@gmail.com');
  assert.deepEqual(recipients.cc, ['client@example.com']);
  assert.equal(recipients.replyTo, 'client@example.com');
});

test('agent welcome fallback returns the generated password in dev mode', async () => {
  const previous = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  };

  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  try {
    const result = await sendAgentWelcomeEmail({
      email: 'agent@example.com',
      name: 'Alice',
      password: 'Secret456',
      parentAdminEmail: 'admin@example.com',
    });

    assert.equal(result.devFallback, true);
    assert.equal(result.password, 'Secret456');
  } finally {
    Object.assign(process.env, previous);
  }
});
