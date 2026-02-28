import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

function getVariantClass(variant: ButtonVariant): string {
  if (variant === "secondary") return "uiButtonSecondary";
  if (variant === "ghost") return "uiButtonGhost";
  return "uiButtonPrimary";
}

export function Button({ variant = "primary", fullWidth = false, className = "", ...props }: ButtonProps) {
  const classes = ["uiButton", getVariantClass(variant), fullWidth ? "uiButtonFull" : "", className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}
