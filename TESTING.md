Tests for auth endpoints

1) Register an account (creates data.json entry and sends OTP or returns dev fallback):

curl -X POST http://localhost:3001/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test+gsi@local.dev","password":"secret123"}'

2) If server returns dev fallback, note the OTP in the response. Otherwise, check server logs or email.

3) Verify OTP:

curl -X POST http://localhost:3001/api/auth/verify-otp \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test+gsi@local.dev","otpCode":"123456"}'

4) Login with password:

curl -X POST http://localhost:3001/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test+gsi@local.dev","password":"secret123"}'

5) Provider login simulation (GSI will call frontend; to test server endpoint directly):

curl -X POST http://localhost:3001/api/auth/provider-login \\
  -H "Content-Type: application/json" \\
  -d '{"provider":"google","email":"test+gsi@local.dev","name":"Test GSI"}'

Notes:
- Ensure server is running: `node server/index.js`
- In production configure RESEND_API_KEY or SMTP_* env vars for real email delivery.
