import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "@/components/ui/use-toast";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isProviderRegister, setIsProviderRegister] = useState(false);
  const [providerName, setProviderName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const resp = await base44.auth.register({ name, email, password });
      setShowOtp(true);
      if (resp?.otp) {
        toast({ title: 'Dev OTP', description: `OTP (dev fallback): ${resp.otp}` });
      }
      toast({
        title: "Verification code sent",
        description: "Check your email inbox for the code.",
      });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // Prefill email/name when coming from provider login that requires registration
  React.useEffect(() => {
    try {
      const oauth = sessionStorage.getItem('waitingline_oauth');
      if (oauth) {
        const obj = JSON.parse(oauth);
        if (obj?.email) setEmail(obj.email);
        if (obj?.name) setName(obj.name);
        if (obj?.provider) {
          setIsProviderRegister(true);
          setProviderName(obj.provider);
        }
      }
    } catch (e) {}
  }, []);

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.message || result?.error || 'Invalid verification code');
      }

      // ⚠️ base44.auth.logout() sait où est réellement stockée la session
      // (sessionStorage) : ne jamais faire localStorage.removeItem(...) ici.
      base44.auth.logout();
      sessionStorage.removeItem('waitingline_oauth');
      window.location.href = "/login";
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "New code sent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");
      setLoading(true);
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenResponse.access_token }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Google login failed");
        }

        const payload = await res.json();
        if (payload?.requiresRegistration) {
          const oauthProfile = {
            email: payload.email,
            name: payload.name,
            provider: 'google',
          };
          sessionStorage.setItem('waitingline_oauth', JSON.stringify(oauthProfile));
          setEmail(payload.email || email);
          setName(payload.name || name);
          setProviderName('Google');
          setIsProviderRegister(true);
          return;
        }

        if (payload?.requiresVerification && payload.otp) {
          toast({ title: 'Dev OTP', description: `OTP (dev fallback): ${payload.otp}` });
        }
        if (payload?.token || payload?.access_token) {
          const user = payload.user || payload;
          const token = payload.token || payload.access_token || payload.token;
          // ⚠️ Idem : toujours passer par base44.auth.setSession().
          base44.auth.setSession(token, user);
          window.location.href = "/admin";
        }
      } catch (err) {
        setError(err.message || 'Google sign-in failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError("Google login was cancelled or failed"),
  });

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a code to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {!isProviderRegister ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <div className="relative">
              <Input
                id="name"
                type="text"
                autoComplete="name"
                autoFocus
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} readOnly className="h-12" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} readOnly className="h-12" />
          </div>
          <Button
            onClick={async () => {
              setError('');
              setLoading(true);
              try {
                const oauth = JSON.parse(sessionStorage.getItem('waitingline_oauth') || '{}');
                const res = await fetch('/api/auth/register-provider', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: oauth.email || email, name: oauth.name || name, provider: oauth.provider || 'google', providerId: oauth.providerId || '' }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.message || 'Provider registration failed');
                }
                // after successful provider registration redirect to login
                sessionStorage.removeItem('waitingline_oauth');
                window.location.href = '/login';
              } catch (err) {
                setError(err.message || 'Provider registration failed');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full h-12 font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              `Create account with ${providerName || 'Google'}`
            )}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}