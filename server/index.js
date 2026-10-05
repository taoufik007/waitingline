import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

import {
  generateOtpCode,
  isValidEmail,
  normalizeEmail,
  OTP_TTL_MS,
  sendOtpEmail,
  sendApprovalEmail,
  sendAdminWelcomeEmail,
  sendAgentWelcomeEmail,
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendContactEmail,
} from './emailService.js';

import {
  getAccount,
  hasAccount,
  setAccount,
  deleteAccount,
  getPendingOtp,
  setPendingOtp,
  deletePendingOtp,
  getPasswordResetToken,
  setPasswordResetToken,
  deletePasswordResetToken,
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
} from './storage.js';

import { fetchMoroccanNews } from './newsService.js';
import { normalizeRole } from './roleUtils.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
// accounts and pending OTPs are persisted in server/data.json via storage.js

app.use(cors());
app.use(express.json());

const createUser = (email, password, displayName = '', role = 'admin', parentAdminEmail = '') => ({
  id: `user_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  email,
  name: displayName || email.split('@')[0],
  role: normalizeRole(role),
  password,
  parentAdminEmail: parentAdminEmail || '',
  displayMode: 'light',
  createdAt: Date.now(),
});

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const buildResetPasswordUrl = (token) => {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  return `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
};
const createPasswordResetToken = () => crypto.randomBytes(32).toString('hex');

const issueToken = (user) => `waitingline_${user.id}_${Date.now()}`;
const SESSION_RECENT_WINDOW_MS = 60 * 1000;
const isRecentSessionToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const match = token.match(/_(\d+)$/);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= SESSION_RECENT_WINDOW_MS;
};
const getRecentSessionTokens = (account) => {
  const tokens = [...new Set([...(account?.sessionTokens || []), account?.sessionToken].filter(Boolean).map(String))];
  return tokens.filter(isRecentSessionToken);
};
const isRealAgentAccount = (account) => normalizeRole(account?.role) === 'agent' && !account?.approver;
const isRealAdminAccount = (account) => normalizeRole(account?.role) === 'admin' && !account?.approver;

// Plusieurs sessions simultanées par compte (plusieurs onglets / machines).
// Chaque connexion AJOUTE un token au lieu d'écraser le précédent.
const MAX_SESSIONS = 20;

const withNewSession = (account, token) => ({
  ...account,
  sessionToken: token, // conservé pour compatibilité
  sessionTokens: [...(account.sessionTokens || []).filter((t) => t !== token), token].slice(-MAX_SESSIONS),
});

const hasSession = (account, token) =>
  account.sessionToken === token || (account.sessionTokens || []).includes(token);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'waitingline-auth' });
});

app.post('/api/contact', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const message = String(req.body?.message || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Veuillez renseigner votre nom.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Veuillez renseigner un email valide.' });
    }

    if (!message || message.length < 10) {
      return res.status(400).json({ message: 'Votre message est trop court.' });
    }

    await sendContactEmail({ name, email, message });

    return res.json({
      success: true,
      message: 'Votre message a bien été envoyé. Nous vous répondrons rapidement.',
    });
  } catch (error) {
    console.error('contact form error', error);
    return res.status(500).json({
      message: 'Impossible d’envoyer votre message pour le moment. Réessayez plus tard.',
    });
  }
});

app.get('/api/news/morocco', async (_req, res) => {
  try {
    const items = await fetchMoroccanNews();
    res.json({ items });
  } catch (error) {
    console.error('morocco news error', error);
    res.status(500).json({
      message: 'Unable to load Morocco news right now.',
      items: [
        {
          title: 'Le Maroc avance sur ses projets structurants',
          summary: 'Les investissements publics et privés continuent de dynamiser l’économie locale.',
          link: 'https://news.google.com',
          image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80',
        },
      ],
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (!name) {
      return res.status(400).json({ message: 'Please enter your full name' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    if (await hasAccount(email)) {
      return res.status(409).json({ message: 'An account already exists for this email' });
    }

    const otpCode = generateOtpCode();
    const user = createUser(email, password, name);
    user.emailVerified = false;
    user.approved = false;
    await setAccount(email, user);
    await setPendingOtp(email, {
      otpCode,
      expiresAt: Date.now() + OTP_TTL_MS,
      createdAt: Date.now(),
    });

    const sendResult = await sendOtpEmail({ email, otp: otpCode, minutes: 10 });

    if (sendResult && sendResult.devFallback) {
      console.warn('Using dev fallback OTP for', email, 'code=', sendResult.otp);
      const resp = {
        success: true,
        message: 'Verification code (dev fallback) — logged on server.',
        user: { ...user, password: undefined },
        email,
      };
      if (process.env.NODE_ENV !== 'production') resp.otp = sendResult.otp;
      return res.json(resp);
    }

    return res.json({
      success: true,
      message: 'Verification code sent by email.',
      user: { ...user, password: undefined },
      email,
    });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({
      message: error?.message || 'Unable to send verification email',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const account = await getAccount(email);
    if (!account) {
      return res.status(404).json({ message: 'No account found for this email. Please create an account first.' });
    }

    if (account.password !== password) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    if (account.provider !== 'google' && !account.emailVerified) {
      return res.status(403).json({ message: 'Email not verified. Please verify your email before logging in.' });
    }

    if (account.approved === false) {
      return res.status(403).json({ message: 'Account not approved. Await admin approval before logging in.' });
    }

    if (account.active === false) {
      return res.status(403).json({ message: 'Ce compte a été désactivé.' });
    }

    const accessToken = issueToken(account);
    await setAccount(email, withNewSession(account, accessToken));

    const payload = {
      access_token: accessToken,
      user: { ...account, password: undefined },
    };

    return res.json(payload);
  } catch (error) {
    console.error('login error', error);
    return res.status(500).json({ message: 'Login failed' });
  }
});

app.post('/api/auth/password-reset/request', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const account = await getAccount(email);
    if (!account) {
      return res.json({
        success: true,
        message: 'If the account exists, a password reset email has been sent.',
      });
    }

    const token = createPasswordResetToken();
    await setPasswordResetToken(token, {
      email,
      createdAt: Date.now(),
      expiresAt: Date.now() + PASSWORD_RESET_TTL_MS,
    });

    try {
      await sendResetPasswordEmail({
        email: account.email,
        name: account.name || account.email.split('@')[0],
        resetUrl: buildResetPasswordUrl(token),
        expiresInMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60000),
      });
    } catch (mailError) {
      console.error('password reset email send error', mailError?.message || mailError);
      return res.status(500).json({ message: 'Unable to send the reset email right now.' });
    }

    return res.json({
      success: true,
      message: 'If the account exists, a password reset email has been sent.',
    });
  } catch (error) {
    console.error('password reset request error', error);
    return res.status(500).json({ message: 'Failed to request a password reset.' });
  }
});

app.post('/api/auth/password-reset/confirm', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token) {
      return res.status(400).json({ message: 'Invalid password reset token.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const resetEntry = await getPasswordResetToken(token);
    if (!resetEntry) {
      return res.status(400).json({ message: 'This reset link is invalid or has already been used.' });
    }

    if (Date.now() > resetEntry.expiresAt) {
      await deletePasswordResetToken(token);
      return res.status(400).json({ message: 'This reset link has expired. Please request a new one.' });
    }

    const account = await getAccount(resetEntry.email);
    if (!account) {
      await deletePasswordResetToken(token);
      return res.status(404).json({ message: 'Account not found for this reset link.' });
    }

    const updatedAccount = { ...account, password };
    await setAccount(resetEntry.email, updatedAccount);
    await deletePasswordResetToken(token);

    return res.json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('password reset confirm error', error);
    return res.status(500).json({ message: 'Failed to reset password.' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otpCode = String(req.body?.otpCode || '').trim();
    const pendingOtp = await getPendingOtp(email);
    if (!pendingOtp) {
      return res.status(400).json({ message: 'No verification code found for this email' });
    }

    if (Date.now() > pendingOtp.expiresAt) {
      await deletePendingOtp(email);
      return res.status(410).json({ message: 'Verification code expired. Please request a new one.' });
    }

    if (otpCode !== pendingOtp.otpCode) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const account = await getAccount(email);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const verifiedAccount = {
      ...account,
      emailVerified: true,
    };

    await setAccount(email, verifiedAccount);
    await deletePendingOtp(email);

    // Email de bienvenue — parcours email/mot de passe
    try {
      await sendWelcomeEmail({ email: verifiedAccount.email, name: verifiedAccount.name });
    } catch (mailErr) {
      console.error('welcome email send error', mailErr?.message || mailErr);
    }

    return res.json({
      access_token: issueToken(verifiedAccount),
      user: { ...verifiedAccount, password: undefined },
    });
  } catch (error) {
    console.error('verify error', error);
    return res.status(500).json({ message: 'Verification failed' });
  }
});

app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const account = await getAccount(email);
    if (!account) {
      return res.status(404).json({ message: 'No account found for this email. Please create an account first.' });
    }

    const otpCode = generateOtpCode();

    await setPendingOtp(email, {
      otpCode,
      expiresAt: Date.now() + OTP_TTL_MS,
      createdAt: Date.now(),
    });

    await sendOtpEmail({ email, otp: otpCode, minutes: 10 });

    return res.json({ success: true, message: 'A new verification code has been sent by email.' });
  } catch (error) {
    console.error('resend otp error', error);
    return res.status(500).json({ message: error?.message || 'Unable to resend verification code' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const access_token = String(req.body?.access_token || '');
    if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

    const googleResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!googleResp.ok) {
      const txt = await googleResp.text().catch(() => '');
      console.warn('Google token validation failed', googleResp.status, txt);
      return res.status(401).json({ error: 'Invalid Google access token' });
    }

    const profile = await googleResp.json().catch(() => null);
    const email = normalizeEmail(profile?.email || '');
    const name = profile?.name || (email ? email.split('@')[0] : '');
    const emailVerified = !!profile?.email_verified;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Google account has no valid email' });
    }

    let account = await getAccount(email);
    if (!account) {
      return res.json({ requiresRegistration: true, email, name });
    }

    if (!account.emailVerified && emailVerified) {
      await setAccount(email, { ...account, emailVerified: true });
      account = await getAccount(email);
    }

    if (!account.emailVerified) {
      return res.status(403).json({ error: 'Email not verified. Please verify your email before logging in.' });
    }

    if (account.approved === false) {
      return res.status(403).json({ error: 'Account not approved. Await admin approval before logging in.' });
    }

    if (account.active === false) {
      return res.status(403).json({ error: 'Ce compte a été désactivé.' });
    }

    const accessToken = issueToken(account);
    await setAccount(email, withNewSession(account, accessToken));

    return res.json({ token: accessToken, user: { ...account, password: undefined } });
  } catch (err) {
    console.error('google auth error', err);
    return res.status(500).json({ error: 'Google auth failed' });
  }
});

app.post('/api/auth/register-provider', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const name = String(req.body?.name || '');
    const provider = String(req.body?.provider || '');
    const providerId = String(req.body?.providerId || Date.now());

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (await hasAccount(email)) {
      return res.status(409).json({ message: 'An account already exists for this email' });
    }

    const user = createUser(email, `google:${providerId}`);
    user.name = name || user.name;
    user.provider = provider || 'google';
    user.emailVerified = true;
    user.approved = false;

    await setAccount(email, user);

    // Email de bienvenue — parcours Google (pas d'étape OTP)
    try {
      await sendWelcomeEmail({ email: user.email, name: user.name });
    } catch (mailErr) {
      console.error('welcome email send error', mailErr?.message || mailErr);
    }

    return res.json({ success: true, user: { ...user, password: undefined } });
  } catch (err) {
    console.error('register-provider error', err);
    return res.status(500).json({ message: 'Provider registration failed' });
  }
});

app.post('/api/account/theme', async (req, res) => {
  try {
    const token = String(req.headers['x-session-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing session token' });

    const mode = String(req.body?.mode || '').trim().toLowerCase();
    if (mode !== 'dark' && mode !== 'light') {
      return res.status(400).json({ message: 'Mode d’affichage invalide. Utilisez dark ou light.' });
    }

    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const account = accounts.find((candidate) => hasSession(candidate, token));

    if (!account) {
      return res.status(403).json({ message: 'Invalid or expired session' });
    }

    const updated = { ...account, displayMode: mode };
    await setAccount(account.email, updated);
    return res.json({ success: true, user: { ...updated, password: undefined } });
  } catch (err) {
    console.error('account theme update error', err);
    return res.status(500).json({ message: 'Failed to update display mode' });
  }
});

app.get('/api/admin/pending-users', async (_req, res) => {
  try {
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const pending = accounts.filter((a) => !a.approved);
    return res.json({ pending });
  } catch (err) {
    console.error('pending-users error', err);
    return res.status(500).json({ message: 'Failed to list pending users' });
  }
});

app.post('/api/admin/approve', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Invalid email' });
    const account = await getAccount(email);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    const updated = { ...account, approved: true };
    await setAccount(email, updated);
    return res.json({ success: true, user: { ...updated, password: undefined } });
  } catch (err) {
    console.error('approve error', err);
    return res.status(500).json({ message: 'Failed to approve user' });
  }
});

app.post('/api/approvals/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    const account = await getAccount(email);
    if (!account) return res.status(404).json({ message: 'No account found for this email' });
    if (account.password !== password) return res.status(401).json({ message: 'Incorrect password' });
    if (!account.approver) return res.status(403).json({ message: 'Not authorized for approvals' });

    if (account.active === false) {
      return res.status(403).json({ message: 'Ce compte a été désactivé.' });
    }

    const token = issueToken(account);
    const updated = { ...account, approvalToken: token };
    await setAccount(email, updated);

    return res.json({ token, user: { ...updated, password: undefined } });
  } catch (err) {
    console.error('approvals login error', err);
    return res.status(500).json({ message: 'Approvals login failed' });
  }
});

app.get('/api/approvals/pending-users', async (req, res) => {
  try {
    const token = String(req.headers['x-approvals-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing approvals token' });
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const approver = accounts.find((a) => a.approvalToken === token && a.approver);
    if (!approver) return res.status(403).json({ message: 'Invalid approvals token' });

    const pending = accounts
      .filter((a) => !a.approved && !a.approver)
      .map((a) => ({ ...a, password: undefined }));

    const approved = accounts
      .filter((a) => a.approved && !a.approver)
      .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0))
      .map((a) => ({ ...a, password: undefined }));

    const clientAccounts = accounts
      .filter((a) => isRealAdminAccount(a))
      .map((client) => {
        const agents = accounts
          .filter(
            (account) =>
              isRealAgentAccount(account) &&
              normalizeEmail(account.parentAdminEmail) === normalizeEmail(client.email)
          )
          .map((agent) => {
            const sessionTokens = getRecentSessionTokens(agent);
            return {
              ...agent,
              password: undefined,
              sessionCount: sessionTokens.length,
              sessionTokens,
            };
          });

        return {
          ...client,
          password: undefined,
          agentCount: agents.length,
          activeAgentSessions: agents.reduce((sum, agent) => sum + agent.sessionCount, 0),
          agents,
        };
      });

    const approvers = accounts
      .filter((a) => a.approver)
      .map((approver) => ({ ...approver, password: undefined }));

    return res.json({ pending, approved, clients: clientAccounts, admins: [], approvers });
  } catch (err) {
    console.error('approvals pending error', err);
    return res.status(500).json({ message: 'Failed to list pending users' });
  }
});

app.post('/api/approvals/approve', async (req, res) => {
  try {
    const token = String(req.headers['x-approvals-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing approvals token' });
    const { email } = req.body || {};
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const approver = accounts.find((a) => a.approvalToken === token && a.approver);
    if (!approver) return res.status(403).json({ message: 'Invalid approvals token' });

    const normalized = normalizeEmail(email);
    const account = await getAccount(normalized);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const updated = { ...account, approved: true, approvedAt: Date.now() };
    await setAccount(normalized, updated);

    try {
      await sendApprovalEmail({ email: updated.email, name: updated.name });
    } catch (mailErr) {
      console.error('approval email send error', mailErr?.message || mailErr);
    }

    return res.json({ success: true, user: { ...updated, password: undefined } });
  } catch (err) {
    console.error('approvals approve error', err);
    return res.status(500).json({ message: 'Failed to approve user' });
  }
});

app.post('/api/approvals/set-active', async (req, res) => {
  try {
    const token = String(req.headers['x-approvals-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing approvals token' });
    const { email, active } = req.body || {};
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const approver = accounts.find((a) => a.approvalToken === token && a.approver);
    if (!approver) return res.status(403).json({ message: 'Invalid approvals token' });

    const normalized = normalizeEmail(email);
    const account = await getAccount(normalized);
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const updated = { ...account, active: !!active };
    await setAccount(normalized, updated);

    return res.json({ success: true, user: { ...updated, password: undefined } });
  } catch (err) {
    console.error('approvals set-active error', err);
    return res.status(500).json({ message: 'Failed to update account status' });
  }
});

app.post('/api/approvals/delete-client', async (req, res) => {
  try {
    const token = String(req.headers['x-approvals-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing approvals token' });
    const { email } = req.body || {};
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const approver = accounts.find((a) => a.approvalToken === token && a.approver);
    if (!approver) return res.status(403).json({ message: 'Invalid approvals token' });

    const normalized = normalizeEmail(email);
    const account = await getAccount(normalized);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (account.approver) return res.status(403).json({ message: 'Approver accounts cannot be deleted here' });
    if (normalizeRole(account.role) !== 'admin') return res.status(400).json({ message: 'Only client admin accounts can be deleted here' });

    const relatedEmails = accounts
      .filter((candidate) =>
        normalizeEmail(candidate.email) === normalized ||
        (normalizeRole(candidate.role) === 'agent' && normalizeEmail(candidate.parentAdminEmail) === normalized)
      )
      .map((candidate) => normalizeEmail(candidate.email));

    for (const relatedEmail of relatedEmails) {
      await deleteAccount(relatedEmail);
    }

    return res.json({ success: true, deleted: relatedEmails.length });
  } catch (err) {
    console.error('approvals delete-client error', err);
    return res.status(500).json({ message: 'Failed to delete client account' });
  }
});

app.post('/api/approvals/create-approver', async (req, res) => {
  try {
    const token = String(req.headers['x-approvals-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing approvals token' });
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const approver = accounts.find((a) => a.approvalToken === token && a.approver);
    if (!approver) return res.status(403).json({ message: 'Invalid approvals token' });

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();

    if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (!name) return res.status(400).json({ message: 'Please enter a name' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    if (await hasAccount(email)) return res.status(409).json({ message: 'An account already exists for this email' });

    const newAdmin = createUser(email, password, name);
    newAdmin.approver = true;
    newAdmin.approved = true;
    newAdmin.active = true;
    newAdmin.emailVerified = true;

    await setAccount(email, newAdmin);

    try {
      await sendAdminWelcomeEmail({ email, name });
    } catch (mailErr) {
      console.error('admin welcome email send error', mailErr?.message || mailErr);
    }

    return res.json({ success: true, user: { ...newAdmin, password: undefined } });
  } catch (err) {
    console.error('create-approver error', err);
    return res.status(500).json({ message: 'Failed to create approver account' });
  }
});

app.get('/api/admin/agents', async (req, res) => {
  try {
    const token = String(req.headers['x-session-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing session token' });

    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const adminAccount = accounts.find((a) => hasSession(a, token));
    if (!adminAccount) return res.status(403).json({ message: 'Invalid session' });
    if (normalizeRole(adminAccount.role) !== 'admin' && !adminAccount.approver) {
      return res.status(403).json({ message: 'Only administrators can manage agents' });
    }

    const agents = accounts
      .filter(
        (account) =>
          isRealAgentAccount(account) &&
          normalizeEmail(account.parentAdminEmail) === normalizeEmail(adminAccount.email)
      )
      .map((account) => ({ ...account, password: undefined }));

    return res.json({ agents, count: agents.length });
  } catch (err) {
    console.error('admin agents error', err);
    return res.status(500).json({ message: 'Failed to list agents' });
  }
});

app.post('/api/admin/create-agent', async (req, res) => {
  try {
    const token = String(req.headers['x-session-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing session token' });

    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const adminAccount = accounts.find((a) => hasSession(a, token));
    if (!adminAccount) return res.status(403).json({ message: 'Invalid session' });
    if (normalizeRole(adminAccount.role) !== 'admin' && !adminAccount.approver) {
      return res.status(403).json({ message: 'Only administrators can create agents' });
    }

    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();
    const assignedServiceIds = Array.isArray(req.body?.assignedServiceIds)
      ? req.body.assignedServiceIds.filter(Boolean)
      : Array.isArray(req.body?.assignedCounterIds)
        ? req.body.assignedCounterIds.filter(Boolean)
        : [];

    if (!isValidEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address' });
    if (!name) return res.status(400).json({ message: 'Please enter a name' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    if (await hasAccount(email)) return res.status(409).json({ message: 'An account already exists for this email' });

    const newAgent = createUser(email, password, name, 'agent', adminAccount.email);
    newAgent.emailVerified = true;
    newAgent.approved = true;
    newAgent.active = true;
    newAgent.parentAdminEmail = adminAccount.email;
    newAgent.assignedServiceIds = assignedServiceIds;
    newAgent.assignedCounterIds = assignedServiceIds;

    await setAccount(email, newAgent);

    try {
      await sendAgentWelcomeEmail({ email, name, password, parentAdminEmail: adminAccount.email });
    } catch (mailErr) {
      console.error('agent welcome email send error', mailErr?.message || mailErr);
    }

    return res.json({ success: true, user: { ...newAgent, password: undefined } });
  } catch (err) {
    console.error('create-agent error', err);
    return res.status(500).json({ message: 'Failed to create agent account' });
  }
});

app.post('/api/admin/update-agent-service', async (req, res) => {
  try {
    const token = String(req.headers['x-session-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing session token' });

    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const adminAccount = accounts.find((a) => hasSession(a, token));
    if (!adminAccount) return res.status(403).json({ message: 'Invalid session' });
    if (normalizeRole(adminAccount.role) !== 'admin' && !adminAccount.approver) {
      return res.status(403).json({ message: 'Only administrators can update agents' });
    }

    const email = normalizeEmail(req.body?.email);
    const rawServiceIds = Array.isArray(req.body?.serviceIds)
      ? req.body.serviceIds
      : Array.isArray(req.body?.assignedServiceIds)
        ? req.body.assignedServiceIds
        : req.body?.serviceId
          ? [req.body.serviceId]
          : [];

    if (!email) return res.status(400).json({ message: 'Missing agent email' });

    const account = await getAccount(email);
    if (!account) return res.status(404).json({ message: 'Agent not found' });
    if (normalizeRole(account.role) !== 'agent') return res.status(400).json({ message: 'Only agent accounts can be updated here' });
    if (normalizeEmail(account.parentAdminEmail) !== normalizeEmail(adminAccount.email)) {
      return res.status(403).json({ message: 'This agent is not attached to your account' });
    }

    const assignedServiceIds = [...new Set(rawServiceIds.filter(Boolean).map(String))];
    const updated = {
      ...account,
      assignedServiceIds,
      assignedCounterIds: assignedServiceIds,
    };

    await setAccount(email, updated);
    return res.json({ success: true, agent: { ...updated, password: undefined } });
  } catch (err) {
    console.error('update-agent-service error', err);
    return res.status(500).json({ message: 'Failed to update agent service' });
  }
});

app.post('/api/admin/delete-agent', async (req, res) => {
  try {
    const token = String(req.headers['x-session-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing session token' });

    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const adminAccount = accounts.find((a) => hasSession(a, token));
    if (!adminAccount) return res.status(403).json({ message: 'Invalid session' });
    if (normalizeRole(adminAccount.role) !== 'admin' && !adminAccount.approver) {
      return res.status(403).json({ message: 'Only administrators can delete agents' });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: 'Missing agent email' });

    const account = await getAccount(email);
    if (!account) return res.status(404).json({ message: 'Agent not found' });
    if (normalizeRole(account.role) !== 'agent') return res.status(400).json({ message: 'Only agent accounts can be deleted here' });
    if (normalizeEmail(account.parentAdminEmail) !== normalizeEmail(adminAccount.email)) {
      return res.status(403).json({ message: 'This agent is not attached to your account' });
    }

    await deleteAccount(email);
    return res.json({ success: true, deleted: email });
  } catch (err) {
    console.error('delete-agent error', err);
    return res.status(500).json({ message: 'Failed to delete agent account' });
  }
});
// Approvals: se connecter temporairement en tant qu'un client (impersonation)
app.post('/api/approvals/impersonate', async (req, res) => {
  try {
    const token = String(req.headers['x-approvals-token'] || '');
    if (!token) return res.status(401).json({ message: 'Missing approvals token' });
    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const approver = accounts.find((a) => a.approvalToken === token && a.approver);
    if (!approver) return res.status(403).json({ message: 'Invalid approvals token' });

    const normalized = normalizeEmail(req.body?.email);
    const account = await getAccount(normalized);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (account.active === false) return res.status(403).json({ message: 'Ce compte est désactivé.' });

    const impersonationToken = issueToken(account);
    const updated = withNewSession(account, impersonationToken);
    await setAccount(normalized, updated);

    return res.json({ token: impersonationToken, user: { ...updated, password: undefined } });
  } catch (err) {
    console.error('impersonate error', err);
    return res.status(500).json({ message: 'Failed to impersonate account' });
  }
});
const resolveOwner = async (req) => {
  const token = String(req.headers['x-session-token'] || '');
  if (!token) return null;
  const { listAccounts } = await import('./storage.js');
  const accounts = await listAccounts();
  const account = accounts.find((a) => hasSession(a, token)) || null;
  if (!account) return null;

  if (normalizeRole(account.role) === 'agent' && account.parentAdminEmail) {
    const parentAccount = accounts.find((candidate) => normalizeEmail(candidate.email) === normalizeEmail(account.parentAdminEmail));
    return parentAccount || account;
  }

  return account;
};

app.get('/api/entities/:type', async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return res.status(401).json({ message: 'Invalid or missing session' });

    const items = await listEntities(req.params.type, owner.email);
    return res.json({ items });
  } catch (err) {
    console.error('list entities error', err);
    return res.status(err.status || 500).json({ message: err.message || 'Failed to list entities' });
  }
});

app.post('/api/entities/:type', async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return res.status(401).json({ message: 'Invalid or missing session' });

    const entity = await createEntity(req.params.type, owner.email, req.body || {});
    return res.json({ item: entity });
  } catch (err) {
    console.error('create entity error', err);
    return res.status(err.status || 500).json({ message: err.message || 'Failed to create entity' });
  }
});

app.put('/api/entities/:type/:id', async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return res.status(401).json({ message: 'Invalid or missing session' });

    const entity = await updateEntity(req.params.type, req.params.id, owner.email, req.body || {});
    return res.json({ item: entity });
  } catch (err) {
    console.error('update entity error', err);
    return res.status(err.status || 500).json({ message: err.message || 'Failed to update entity' });
  }
});

app.delete('/api/entities/:type/:id', async (req, res) => {
  try {
    const owner = await resolveOwner(req);
    if (!owner) return res.status(401).json({ message: 'Invalid or missing session' });

    await deleteEntity(req.params.type, req.params.id, owner.email);
    return res.json({ success: true });
  } catch (err) {
    console.error('delete entity error', err);
    return res.status(err.status || 500).json({ message: err.message || 'Failed to delete entity' });
  }
});
app.get('/api/session-check', async (req, res) => {
  try {
    const token = String(req.headers['x-session-token'] || '');
    if (!token) return res.status(401).json({ valid: false, message: 'Missing token' });

    const { listAccounts } = await import('./storage.js');
    const accounts = await listAccounts();
    const account = accounts.find(
      (a) => hasSession(a, token) || a.approvalToken === token
    );

    if (!account) return res.status(401).json({ valid: false, message: 'Session inconnue' });
    if (account.active === false) return res.status(401).json({ valid: false, message: 'Compte désactivé' });
    if (account.approved === false) return res.status(401).json({ valid: false, message: 'Compte non approuvé' });

    return res.json({ valid: true });
  } catch (err) {
    console.error('session-check error', err);
    return res.status(500).json({ valid: false, message: 'Erreur serveur' });
  }
});

app.listen(PORT, () => {
  console.log(`Waiting Line auth server running on http://localhost:${PORT}`);
});