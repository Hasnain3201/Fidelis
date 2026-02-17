import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  wrapperClassName?: string;
};

export function Input({ label, className = "", wrapperClassName = "", ...props }: InputProps) {
  if (label) {
    return (
      <label className={["uiInputWrap", wrapperClassName].filter(Boolean).join(" ")}>
        <span className="uiInputLabel">{label}</span>
        <input className={["uiInput", className].filter(Boolean).join(" ")} {...props} />
      </label>
    );
  }

  return <input className={["uiInput", className].filter(Boolean).join(" ")} {...props} />;
}
