import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const callbackError = searchParams.get("error");
  const callbackErrorCode = searchParams.get("error_code");
  const callbackErrorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const next = searchParams.get("next") || "/";
  const redirectTo = new URL(next, requestUrl.origin);

  if (callbackError || callbackErrorCode) {
    redirectTo.searchParams.set("auth_error", callbackErrorCode || callbackError || "unknown_error");
    if (callbackErrorDescription) {
      redirectTo.searchParams.set("auth_error_description", callbackErrorDescription);
    }
    return NextResponse.redirect(redirectTo);
  }

  const supabase = await createClient();

  // For email magic links in SSR, token_hash verification is the most reliable
  // path and does not depend on client-side PKCE verifier storage.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      redirectTo.searchParams.set("auth_error", error.code || "verify_otp_failed");
      redirectTo.searchParams.set("auth_error_description", error.message);
      return NextResponse.redirect(redirectTo);
    }

    return NextResponse.redirect(redirectTo);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const message = error.message || "Could not complete sign-in.";
      const isMissingCodeVerifier = message
        .toLowerCase()
        .includes("code verifier not found");

      redirectTo.searchParams.set("auth_error", error.code || "exchange_code_failed");
      redirectTo.searchParams.set(
        "auth_error_description",
        isMissingCodeVerifier
          ? "Magic link session expired or opened in a different browser. Request a new email and open it in the same browser, or use the OTP code."
          : message
      );
      return NextResponse.redirect(redirectTo);
    }

    return NextResponse.redirect(redirectTo);
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      redirectTo.searchParams.set("auth_error", error.code || "set_session_failed");
      redirectTo.searchParams.set("auth_error_description", error.message);
      return NextResponse.redirect(redirectTo);
    }
  }

  return NextResponse.redirect(redirectTo);
}
