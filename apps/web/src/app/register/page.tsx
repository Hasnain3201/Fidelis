"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuestAccessPanel } from "@/components/guest-access-panel";
import { signUpWithSupabase } from "@/lib/auth";

const ACCOUNT_ROLES = ["user", "artist", "venue"] as const;
type AccountRole = (typeof ACCOUNT_ROLES)[number];

function toAccountRole(value: string | null): AccountRole {
  if (value === "artist" || value === "venue" || value === "user") return value;
  return "user";
}

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
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("user");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const presetRole = toAccountRole(new URLSearchParams(window.location.search).get("role"));
    setRole((current) => (current === presetRole ? current : presetRole));
  }, []);

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
    setStatusMessage(null);
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      await signUpWithSupabase(fullName.trim(), email.trim().toLowerCase(), password, role);

      setPassword("");
      setConfirmPassword("");
      setStatusMessage({ type: "success", text: "Account created. Please sign in." });
      router.push("/login");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create account right now.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  function setFieldError(field: string, message: string) {
    setErrors((current) => {
      if (!message) {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      }

      if (current[field] === message) return current;
      return { ...current, [field]: message };
    });
  }

  return (
    <section className="siteSection pageAuth">
      <div className="siteContainer">
        <div className="authCard">
          <h1>Create Account</h1>
          <p className="meta">Register as a user, artist, or venue owner.</p>

          <GuestAccessPanel
            description="Skip account creation for now and explore public event listings. Sign up later when you want saved features."
          />

          <form className="authForm" onSubmit={handleSubmit} noValidate>
            <Input
              type="text"
              label="Full Name"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(event) => {
                const value = event.target.value.slice(0, 80);
                setFullName(value);
                if (errors.fullName) {
                  setFieldError("fullName", value.trim().length >= 2 ? "" : "Enter your full name.");
                }
              }}
              onBlur={() => setFieldError("fullName", fullName.trim().length >= 2 ? "" : "Enter your full name.")}
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
              onChange={(event) => {
                const value = event.target.value.slice(0, 160);
                setEmail(value);
                if (errors.email) {
                  setFieldError("email", validateEmail(value.trim().toLowerCase()));
                }
              }}
              onBlur={() => setFieldError("email", validateEmail(email.trim().toLowerCase()))}
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
              onChange={(event) => {
                const value = event.target.value.slice(0, 80);
                setPassword(value);
                if (errors.password) {
                  setFieldError("password", validatePassword(value));
                }
                if (errors.confirmPassword && confirmPassword) {
                  setFieldError("confirmPassword", confirmPassword === value ? "" : "Passwords do not match.");
                }
              }}
              onBlur={() => setFieldError("password", validatePassword(password))}
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
              onChange={(event) => {
                const value = event.target.value.slice(0, 80);
                setConfirmPassword(value);
                if (errors.confirmPassword) {
                  setFieldError("confirmPassword", value && value === password ? "" : "Passwords do not match.");
                }
              }}
              onBlur={() =>
                setFieldError(
                  "confirmPassword",
                  !confirmPassword ? "Confirm your password." : confirmPassword === password ? "" : "Passwords do not match.",
                )
              }
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
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setAcceptedTerms(checked);
                  if (errors.terms) {
                    setFieldError("terms", checked ? "" : "You must accept the terms to continue.");
                  }
                }}
              />
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

          {statusMessage ? (
            <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>{statusMessage.text}</p>
          ) : null}

          <p className="authSwitch">
            Already have an account? <Link href="/login">Sign in</Link>
            <br />
            Just browsing? <Link href="/search">Continue as guest</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
