export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const OTP_TTL_MS = 10 * 60 * 1000;

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

export const isValidEmail = (email) => EMAIL_REGEX.test(String(email || '').trim());

// ————————————————————————————————————————————————
// Layout commun — utilisé par tous les emails pour une identité cohérente
// ————————————————————————————————————————————————

const BRAND_NAME = 'Waiting Line';
const ACCENT_COLOR = '#4f46e5'; // indigo
const ACCENT_DARK = '#3730a3';
const TEXT_DARK = '#0f172a';
const TEXT_MUTED = '#64748b';
const BORDER_COLOR = '#e2e8f0';
const BG_PAGE = '#f1f5f9';

const emailWrapper = ({ preheader = '', bodyHtml }) => `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${BRAND_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${BG_PAGE}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Preheader (texte d'aperçu invisible, affiché dans la liste de la boîte mail) -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_PAGE}; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color:#ffffff; border-radius: 16px; overflow: hidden; border: 1px solid ${BORDER_COLOR};">

            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(135deg, ${ACCENT_COLOR}, ${ACCENT_DARK}); padding: 32px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="display:inline-block; width: 36px; height: 36px; background-color: rgba(255,255,255,0.15); border-radius: 10px; text-align:center; line-height:36px; font-size:18px; margin-right: 12px; vertical-align: middle;">⏱️</span>
                      <span style="color:#ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; vertical-align: middle;">${BRAND_NAME}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 40px;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid ${BORDER_COLOR};">
                <p style="margin:0; font-size: 12px; color: ${TEXT_MUTED}; line-height: 1.6;">
                  Cet email a été envoyé automatiquement par ${BRAND_NAME}. Si vous n'êtes pas à l'origine de cette action, vous pouvez ignorer ce message en toute sécurité.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const button = ({ label, href = '#' }) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
    <tr>
      <td style="border-radius: 10px; background: linear-gradient(135deg, ${ACCENT_COLOR}, ${ACCENT_DARK});">
        <a href="${href}" style="display:inline-block; padding: 13px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

// ————————————————————————————————————————————————
// Templates
// ————————————————————————————————————————————————

export const resolveEmailSender = ({
  from = process.env.EMAIL_FROM,
  replyTo = process.env.EMAIL_REPLY_TO || process.env.SMTP_USER,
} = {}) => {
  const fallbackFrom = 'Waiting Line <fileattente.team@gmail.com>';
  const rawFrom = String(from || '').trim();
  const hasValidAddress = /<[^>]+@[^>]+\.[^>]+>|^[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(rawFrom);
  const resolvedFrom = hasValidAddress ? rawFrom : fallbackFrom;
  const rawReplyTo = String(replyTo || '').trim();

  return {
    from: resolvedFrom,
    replyTo: rawReplyTo || undefined,
  };
};

export const resolveContactEmailRecipients = ({
  contactEmail = process.env.CONTACT_EMAIL,
  clientEmail = '',
} = {}) => {
  const to = String(contactEmail || process.env.EMAIL_FROM || 'contact@waitingline.app').trim();
  const client = String(clientEmail || '').trim();

  return {
    to: to || 'contact@waitingline.app',
    cc: client ? [client] : [],
    replyTo: client || undefined,
  };
};

export const buildOtpEmailHtml = (otp, minutes = 10) =>
  emailWrapper({
    preheader: `Votre code de vérification : ${otp}`,
    bodyHtml: `
      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: ${ACCENT_COLOR}; text-transform: uppercase; letter-spacing: 0.06em;">Vérification d'email</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Confirmez votre adresse</h1>
      <p style="margin:0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Voici votre code de vérification à usage unique. Entrez-le dans l'application pour valider votre compte.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="background-color: #f8fafc; border: 1px dashed ${BORDER_COLOR}; border-radius: 14px; padding: 24px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 0.3em; color: ${TEXT_DARK}; font-family: 'Courier New', monospace;">${otp}</span>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0 0; font-size: 13px; color: ${TEXT_MUTED};">
        ⏳ Ce code expire dans <strong style="color:${TEXT_DARK};">${minutes} minutes</strong>.
      </p>
    `,
  });

export const buildApprovalEmailHtml = (name = '') =>
  emailWrapper({
    preheader: 'Votre compte a été approuvé',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="width:48px; height:48px; background-color:#ecfdf5; border-radius: 12px; text-align:center; vertical-align:middle; font-size: 24px;">✅</td>
        </tr>
      </table>

      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 0.06em;">Compte approuvé</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Bienvenue${name ? `, ${name}` : ''} 🎉</h1>
      <p style="margin:0 0 8px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Bonne nouvelle : votre compte <strong style="color:${TEXT_DARK};">${BRAND_NAME}</strong> vient d'être validé par un administrateur.
      </p>
      <p style="margin:0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Vous pouvez dès maintenant vous connecter et accéder à votre espace.
      </p>

      ${button({ label: 'Se connecter', href: '#' })}
    `,
  });

export const buildAdminWelcomeEmailHtml = ({ name = '', email }) =>
  emailWrapper({
    preheader: 'Ton accès administrateur a été créé',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="width:48px; height:48px; background-color:#eef2ff; border-radius: 12px; text-align:center; vertical-align:middle; font-size: 24px;">👑</td>
        </tr>
      </table>

      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: ${ACCENT_COLOR}; text-transform: uppercase; letter-spacing: 0.06em;">Accès administrateur</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Bienvenue dans l'équipe${name ? `, ${name}` : ''} 👋</h1>
      <p style="margin:0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Un accès administrateur vient d'être créé pour toi sur <strong style="color:${TEXT_DARK};">${BRAND_NAME}</strong>. Tu peux maintenant te connecter et gérer les demandes d'inscription.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border: 1px solid ${BORDER_COLOR}; border-radius: 12px;">
        <tr>
          <td style="padding: 18px 20px;">
            <p style="margin:0; font-size:11px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.05em;">Email</p>
            <p style="margin:2px 0 0 0; font-size:15px; color:${TEXT_DARK}; font-weight:600;">${email}</p>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0 0; font-size: 13px; color: ${TEXT_MUTED}; line-height: 1.6;">
        🔒 Par mesure de sécurité, le mot de passe n'est pas inclus dans cet email. Contacte ton administrateur ou utilise le mécanisme de réinitialisation si nécessaire.
      </p>
    `,
  });

export const buildAgentWelcomeEmailHtml = ({ name = '', email, password = '', parentAdminEmail = '' }) =>
  emailWrapper({
    preheader: 'Ton accès agent a été créé',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="width:48px; height:48px; background-color:#ecfeff; border-radius: 12px; text-align:center; vertical-align:middle; font-size: 24px;">🧑‍💼</td>
        </tr>
      </table>

      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: ${ACCENT_COLOR}; text-transform: uppercase; letter-spacing: 0.06em;">Accès agent</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Bienvenue${name ? `, ${name}` : ''} 👋</h1>
      <p style="margin:0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Ton compte agent a bien été créé pour le client <strong style="color:${TEXT_DARK};">${parentAdminEmail || BRAND_NAME}</strong>.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border: 1px solid ${BORDER_COLOR}; border-radius: 12px;">
        <tr>
          <td style="padding: 18px 20px; border-bottom: 1px solid ${BORDER_COLOR};">
            <p style="margin:0; font-size:11px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.05em;">Email</p>
            <p style="margin:2px 0 0 0; font-size:15px; color:${TEXT_DARK}; font-weight:600;">${email}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 20px;">
            <p style="margin:0; font-size:11px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.05em;">Mot de passe</p>
            <p style="margin:2px 0 0 0; font-size:15px; color:${TEXT_DARK}; font-weight:700; font-family: 'Courier New', monospace;">${password || 'Non fourni'}</p>
          </td>
        </tr>
      </table>

      <p style="margin:20px 0 0 0; font-size: 13px; color: ${TEXT_MUTED}; line-height: 1.6;">
        🔐 Conservez ce mot de passe en lieu sûr et changez-le à la première connexion si nécessaire.
      </p>
    `,
  });

export const buildWelcomeEmailHtml = (name = '') =>
  emailWrapper({
    preheader: 'Ton compte a bien été créé',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="width:48px; height:48px; background-color:#eef2ff; border-radius: 12px; text-align:center; vertical-align:middle; font-size: 24px;">🎉</td>
        </tr>
      </table>

      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: ${ACCENT_COLOR}; text-transform: uppercase; letter-spacing: 0.06em;">Bienvenue</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Ton compte a été créé${name ? `, ${name}` : ''} !</h1>
      <p style="margin:0 0 8px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Merci de t'être inscrit sur <strong style="color:${TEXT_DARK};">${BRAND_NAME}</strong>. Ton compte a bien été créé et ton adresse email est confirmée.
      </p>
      <p style="margin:0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Il ne reste plus qu'une étape : un administrateur doit valider ton compte avant que tu puisses te connecter. Tu recevras un email dès que ce sera fait.
      </p>
    `,
  });

export const buildContactEmailHtml = ({ name = '', email = '', message = '' }) =>
  emailWrapper({
    preheader: `Nouveau message de contact de ${name || 'un client'}`,
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="width:48px; height:48px; background-color:#ecfeff; border-radius: 12px; text-align:center; vertical-align:middle; font-size: 24px;">📩</td>
        </tr>
      </table>

      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: ${ACCENT_COLOR}; text-transform: uppercase; letter-spacing: 0.06em;">Nouveau message</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Demande de contact Waiting Line</h1>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border: 1px solid ${BORDER_COLOR}; border-radius: 12px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 18px 20px; border-bottom: 1px solid ${BORDER_COLOR};">
            <p style="margin:0; font-size:11px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.05em;">Nom</p>
            <p style="margin:2px 0 0 0; font-size:15px; color:${TEXT_DARK}; font-weight:600;">${name}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 20px; border-bottom: 1px solid ${BORDER_COLOR};">
            <p style="margin:0; font-size:11px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.05em;">Email</p>
            <p style="margin:2px 0 0 0; font-size:15px; color:${TEXT_DARK}; font-weight:600;">${email}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 18px 20px;">
            <p style="margin:0; font-size:11px; font-weight:600; color:${TEXT_MUTED}; text-transform:uppercase; letter-spacing:0.05em;">Message</p>
            <p style="margin:8px 0 0 0; font-size:15px; color:${TEXT_DARK}; line-height:1.7; white-space: pre-wrap;">${message}</p>
          </td>
        </tr>
      </table>
    `,
  });

export const buildResetPasswordEmailHtml = ({ name = '', resetUrl = '#', expiresInMinutes = 60 }) =>
  emailWrapper({
    preheader: 'Réinitialisez votre mot de passe',
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="width:48px; height:48px; background-color:#fef3c7; border-radius: 12px; text-align:center; vertical-align:middle; font-size: 24px;">🔐</td>
        </tr>
      </table>

      <p style="margin:0 0 4px 0; font-size: 13px; font-weight: 600; color: ${ACCENT_COLOR}; text-transform: uppercase; letter-spacing: 0.06em;">Réinitialisation</p>
      <h1 style="margin:0 0 16px 0; font-size: 22px; font-weight: 700; color: ${TEXT_DARK};">Réinitialiser mon mot de passe</h1>
      <p style="margin:0 0 8px 0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Bonjour${name ? ` ${name}` : ''}, nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Waiting Line.
      </p>
      <p style="margin:0; font-size: 15px; line-height: 1.6; color: ${TEXT_MUTED};">
        Cliquez ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans <strong style="color:${TEXT_DARK};">${expiresInMinutes} minutes</strong>.
      </p>

      ${button({ label: 'Réinitialiser mon mot de passe', href: resetUrl })}

      <p style="margin:0; font-size: 12px; color: ${TEXT_MUTED}; line-height: 1.6;">
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email sans aucun impact.
      </p>
    `,
  });
// ————————————————————————————————————————————————
// Envoi (Resend → SMTP → fallback dev)
// ————————————————————————————————————————————————

const sendEmail = async ({ to, subject, html, devFallbackPayload, cc = [], replyTo } = {}) => {
  const resendKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const { from, replyTo: resolvedReplyTo } = resolveEmailSender({
    from: process.env.EMAIL_FROM,
    replyTo: replyTo || process.env.EMAIL_REPLY_TO || smtpUser,
  });

  if (resendKey && from) {
    try {
      const requestPayload = {
        from,
        to: [to],
        subject,
        html,
      };

      if (Array.isArray(cc) && cc.length) requestPayload.cc = cc;
      if (resolvedReplyTo) requestPayload.reply_to = resolvedReplyTo;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) return payload;

      const message = payload?.message || payload?.error || response.statusText || 'Failed to send email';
      console.warn('Resend error', response.status, message);
      if (process.env.NODE_ENV === 'production') {
        const err = new Error(message);
        err.status = response.status;
        throw err;
      }
    } catch (err) {
      console.error('Resend send error:', err?.message || err);
      if (process.env.NODE_ENV === 'production') throw err;
    }
  }

  if (smtpHost && smtpUser && smtpPass && from) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const mailOptions = {
        from,
        to,
        subject,
        html,
      };

      if (Array.isArray(cc) && cc.length) mailOptions.cc = cc;
      if (resolvedReplyTo) mailOptions.replyTo = resolvedReplyTo;

      const info = await transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV !== 'production') console.log('SMTP send info:', info?.messageId || info);
      return { smtp: true, info };
    } catch (err) {
      console.error('SMTP send error:', err?.message || err);
      if (process.env.NODE_ENV === 'production') throw err;
    }
  }

  const missing = [];
  if (!resendKey) missing.push('RESEND_API_KEY');
  if (!smtpHost) missing.push('SMTP_HOST');
  if (!from) missing.push('EMAIL_FROM');
  console.warn('No email sender configured or send failed. Missing:', missing.join(', '));
  if (process.env.NODE_ENV !== 'production') {
    const fallbackPayloadWithDefaults = devFallbackPayload || {};
    console.warn('Falling back to dev email delivery (not actually sent). Payload:', fallbackPayloadWithDefaults);
    return { devFallback: true, ...fallbackPayloadWithDefaults };
  }

  const error = new Error('Failed to send email and no fallback available');
  error.code = 'EMAIL_SEND_FAILED';
  throw error;
};

export const sendOtpEmail = async ({ email, otp, minutes = 10 }) =>
  sendEmail({
    to: email,
    subject: 'Votre code de vérification Waiting Line',
    html: buildOtpEmailHtml(otp, minutes),
    devFallbackPayload: { otp },
  });

export const sendApprovalEmail = async ({ email, name }) =>
  sendEmail({
    to: email,
    subject: 'Votre compte a été approuvé',
    html: buildApprovalEmailHtml(name),
  });

export const sendAdminWelcomeEmail = async ({ email, name, password }) =>
  sendEmail({
    to: email,
    subject: 'Ton accès administrateur Waiting Line',
    html: buildAdminWelcomeEmailHtml({ name, email, password }),
    devFallbackPayload: { email, name, password },
  });

export const sendAgentWelcomeEmail = async ({ email, name, password, parentAdminEmail }) =>
  sendEmail({
    to: email,
    subject: 'Ton accès agent Waiting Line',
    html: buildAgentWelcomeEmailHtml({ name, email, password, parentAdminEmail }),
    devFallbackPayload: { email, name, password, parentAdminEmail },
  });

export const sendWelcomeEmail = async ({ email, name }) =>
  sendEmail({
    to: email,
    subject: `Bienvenue sur ${BRAND_NAME} 🎉`,
    html: buildWelcomeEmailHtml(name),
  });

export const sendResetPasswordEmail = async ({ email, name, resetUrl, expiresInMinutes = 60 }) =>
  sendEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe',
    html: buildResetPasswordEmailHtml({ name, resetUrl, expiresInMinutes }),
    devFallbackPayload: { email, name, resetUrl, expiresInMinutes },
  });

export const sendContactEmail = async ({ name, email, message }) => {
  const { to, cc, replyTo } = resolveContactEmailRecipients({
    contactEmail: process.env.CONTACT_EMAIL,
    clientEmail: email,
  });

  return sendEmail({
    to,
    cc,
    replyTo,
    subject: `Nouveau message de contact - ${name || 'Client'}`,
    html: buildContactEmailHtml({ name, email, message }),
    devFallbackPayload: { name, email, message, to, cc, replyTo },
  });
};