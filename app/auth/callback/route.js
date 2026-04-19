import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

function getSafeNextPath(nextValue) {
  if (!nextValue || typeof nextValue !== "string") {
    return "/";
  }

  // Allow only same-site relative paths to prevent open redirects.
  if (!nextValue.startsWith("/")) {
    return "/";
  }

  if (nextValue.startsWith("//")) {
    return "/";
  }

  return nextValue;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const callbackError = searchParams.get("error");
  const callbackErrorCode = searchParams.get("error_code");
  const callbackErrorDescription = searchParams.get("error_description");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const token = searchParams.get("token");
  const type = searchParams.get("type");
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const next = getSafeNextPath(searchParams.get("next"));
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

  // Some templates/providers include token instead of token_hash.
  if (token && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token,
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
          ? "Magic link opened in a different browser/app context. Use OTP code, or update Supabase email template to use token_hash links for cross-browser magic-link sign-in."
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
