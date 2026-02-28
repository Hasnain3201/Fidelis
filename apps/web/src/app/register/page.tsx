"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ACCOUNT_ROLES = ["user", "artist", "venue"] as const;

function validateEmail(email: string): string {
  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  return "";
}

function validatePassword(password: string): string {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password needs at least one letter and one number.";
  return "";
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<(typeof ACCOUNT_ROLES)[number]>("user");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      nextErrors.fullName = "Enter your full name.";
    }

    const emailError = validateEmail(email.trim().toLowerCase());
    if (emailError) nextErrors.email = emailError;

    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    if (confirmPassword && confirmPassword !== password) nextErrors.confirmPassword = "Passwords do not match.";
    if (!acceptedTerms) nextErrors.terms = "You must accept the terms to continue.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    if (!validateForm()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    setStatusMessage("Registration form validated. Account creation API integration is planned for Week 3.");
    setPassword("");
    setConfirmPassword("");
    setIsSubmitting(false);
  }

  return (
    <section className="siteSection pageAuth">
      <div className="siteContainer">
        <div className="authCard">
          <h1>Create Account</h1>
          <p className="meta">Register as a user, artist, or venue owner.</p>

          <form className="authForm" onSubmit={handleSubmit} noValidate>
            <Input
              type="text"
              label="Full Name"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => setFullName(event.target.value.slice(0, 80))}
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              required
            />
            {errors.fullName ? (
              <p className="fieldError" role="alert">
                {errors.fullName}
              </p>
            ) : null}

            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value.slice(0, 160))}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email ? (
              <p className="fieldError" role="alert">
                {errors.email}
              </p>
            ) : null}

            <Input
              type="password"
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value.slice(0, 80))}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password ? (
              <p className="fieldError" role="alert">
                {errors.password}
              </p>
            ) : null}

            <Input
              type="password"
              label="Confirm Password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value.slice(0, 80))}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              required
            />
            {errors.confirmPassword ? (
              <p className="fieldError" role="alert">
                {errors.confirmPassword}
              </p>
            ) : null}

            <label className="uiInputWrap">
              <span className="uiInputLabel">Account Role</span>
              <select className="uiSelect" value={role} onChange={(event) => setRole(event.target.value as (typeof ACCOUNT_ROLES)[number])}>
                <option value="user">User</option>
                <option value="artist">Artist</option>
                <option value="venue">Venue</option>
              </select>
            </label>

            <label className="checkItem legalCheck">
              <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
              I agree to the platform terms and privacy policy.
            </label>
            {errors.terms ? (
              <p className="fieldError" role="alert">
                {errors.terms}
              </p>
            ) : null}

            <Button type="submit" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          {statusMessage ? <p className="statusBanner success">{statusMessage}</p> : null}

          <p className="authSwitch">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
