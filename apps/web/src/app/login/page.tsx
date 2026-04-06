"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuestAccessPanel } from "@/components/guest-access-panel";
import { saveAuthSession, signInWithSupabase } from "@/lib/auth";

function validateEmail(email: string): string {
  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  return "";
}

function validatePassword(password: string): string {
  if (!password) return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  return "";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    const nextEmailError = validateEmail(normalizedEmail);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) return;

    try {
      setIsSubmitting(true);
      const session = await signInWithSupabase(normalizedEmail, password);
      saveAuthSession(session);
      setStatusMessage({ type: "success", text: "Signed in successfully." });
      setPassword("");

      const destination =
        session.role === "venue"
          ? "/venues/dashboard"
          : session.role === "artist"
            ? "/artists/dashboard"
            : "/dashboard";

      router.push(destination);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="siteSection pageAuth">
      <div className="siteContainer">
        <div className="authCard">
          <h1>Login</h1>
          <p className="meta">Sign in to save favorites, follow artists, and manage venue workflows.</p>

          <GuestAccessPanel
            description="Browse events, artists, and venues now. Create an account any time to save favorites and follows."
          />

          <form className="authForm" onSubmit={handleSubmit} noValidate>
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value.slice(0, 160))}
              onBlur={() => setEmailError(validateEmail(email.trim().toLowerCase()))}
              autoComplete="email"
              aria-invalid={Boolean(emailError)}
              required
            />
            {emailError ? (
              <p className="fieldError" role="alert">
                {emailError}
              </p>
            ) : null}

            <Input
              type="password"
              label="Password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value.slice(0, 80))}
              onBlur={() => setPasswordError(validatePassword(password))}
              autoComplete="current-password"
              aria-invalid={Boolean(passwordError)}
              required
            />
            {passwordError ? (
              <p className="fieldError" role="alert">
                {passwordError}
              </p>
            ) : null}

            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Continue"}
            </Button>
          </form>

          {statusMessage ? (
            <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>{statusMessage.text}</p>
          ) : null}

          <p className="authSwitch">
            New to LIVEY? <Link href="/register">Create an account</Link> • Prefer to browse first?{" "}
            <Link href="/search">Continue as guest</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
