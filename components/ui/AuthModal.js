"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthModal({ isOpen, onClose, authError }) {
  const supabase = createClient();
  const MAGIC_LINK_COOLDOWN_SECONDS = 60;
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [status, setStatus] = useState("");
  const [preferOtpMode, setPreferOtpMode] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  const normalizedAuthError = (authError || "").toLowerCase();
  const shouldRecommendOtpMode =
    normalizedAuthError.includes("code verifier") ||
    normalizedAuthError.includes("exchange_code_failed") ||
    normalizedAuthError.includes("magic link session expired");

  useEffect(() => {
    if (!isOpen) return;

    const stored = window.localStorage.getItem("magic_link_cooldown_until");
    const parsed = Number(stored || "0");

    if (Number.isFinite(parsed) && parsed > Date.now()) {
      setCooldownUntil(parsed);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (shouldRecommendOtpMode) {
      setPreferOtpMode(true);
      setStatus(
        "Magic link callback failed earlier. OTP mode is enabled, use the code from email to sign in."
      );
    }
  }, [isOpen, shouldRecommendOtpMode]);

  useEffect(() => {
    if (!cooldownUntil) return;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const secondsRemaining = useMemo(() => {
    const remaining = Math.ceil((cooldownUntil - now) / 1000);
    return Math.max(0, remaining);
  }, [cooldownUntil, now]);

  const isCooldownActive = secondsRemaining > 0;

  const validateEmail = () => {
    if (!email.trim()) {
      setStatus("Please enter your email.");
      return false;
    }

    return true;
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setStatus("");
      const { origin } = window.location;

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
    } catch (error) {
      setStatus(error.message || "Could not start Google sign in.");
      setIsLoading(false);
    }
  };

  const handleSendMagicLinkOrOtp = async () => {
    if (!validateEmail()) return;

    if (isCooldownActive) {
      setStatus(`Please wait ${secondsRemaining}s before requesting another email.`);
      return;
    }

    try {
      setIsLoading(true);
      setStatus("");
      const { origin } = window.location;

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          ...(preferOtpMode
            ? {}
            : { emailRedirectTo: `${origin}/auth/callback?next=/` }),
        },
      });

      if (error) throw error;

      const nextCooldownUntil = Date.now() + MAGIC_LINK_COOLDOWN_SECONDS * 1000;
      setCooldownUntil(nextCooldownUntil);
      window.localStorage.setItem(
        "magic_link_cooldown_until",
        String(nextCooldownUntil)
      );

      setEmailSent(true);
      if (preferOtpMode) {
        setStatus(
          "We sent a login code. Enter the OTP code below to sign in (recommended), instead of using the email link."
        );
      } else {
        setStatus(
          "Check your inbox for a magic link or one-time code. Open the magic link in this same browser, or enter the OTP code here."
        );
      }
    } catch (error) {
      const message = error?.message || "Could not send login email.";
      if (message.toLowerCase().includes("rate limit")) {
        setStatus(
          "Too many email requests. Wait about a minute and then try again, or use the OTP from your latest email."
        );
      } else {
        setStatus(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateEmail()) return;

    if (!otp.trim()) {
      setStatus("Enter the OTP code from your email.");
      return;
    }

    try {
      setIsVerifying(true);
      setStatus("");

      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });

      if (error) throw error;

      onClose(false);
      window.location.reload();
    } catch (error) {
      setStatus(error.message || "Invalid OTP. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
          <DialogDescription>
            Track product prices and get alerts on price drops
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full gap-2"
            size="lg"
            disabled={isLoading || isVerifying}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-3">
            {shouldRecommendOtpMode && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                We detected a previous magic-link callback issue. OTP mode is enabled and recommended.
              </div>
            )}

            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || isVerifying}
            />

            <Button
              onClick={handleSendMagicLinkOrOtp}
              className="w-full"
              disabled={isLoading || isVerifying || isCooldownActive}
            >
              {isLoading
                ? "Sending..."
                : isCooldownActive
                  ? `Resend in ${secondsRemaining}s`
                  : preferOtpMode
                    ? "Send OTP Code"
                    : "Send Magic Link / OTP"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setPreferOtpMode((prev) => !prev)}
              disabled={isLoading || isVerifying}
            >
              {preferOtpMode
                ? "Using OTP mode (switch to magic-link mode)"
                : "Having link issues? Switch to OTP mode"}
            </Button>

            {emailSent && (
              <>
                <Input
                  type="text"
                  placeholder="Enter OTP code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={isLoading || isVerifying}
                />
                <Button
                  onClick={handleVerifyOtp}
                  variant="secondary"
                  className="w-full"
                  disabled={isLoading || isVerifying}
                >
                  {isVerifying ? "Verifying..." : "Verify OTP"}
                </Button>
              </>
            )}

            {status && (
              <p className="text-sm text-muted-foreground text-center">{status}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}