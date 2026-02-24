"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const nextEmailError = validateEmail(normalizedEmail);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) return;

    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    setStatusMessage("Login UI validated. Backend auth integration ships in Week 3.");
    setPassword("");
    setIsSubmitting(false);
  }

  return (
    <section className="siteSection pageAuth">
      <div className="siteContainer">
        <div className="authCard">
          <h1>Login</h1>
          <p className="meta">Sign in to save favorites, follow artists, and manage venue workflows.</p>

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

          {statusMessage ? <p className="statusBanner success">{statusMessage}</p> : null}

          <p className="authSwitch">
            New to LIVEY? <Link href="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
