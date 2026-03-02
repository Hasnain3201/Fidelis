"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyLinkButtonProps = {
    /** If provided, this will be copied. Otherwise we copy window.location.href */
    url?: string;
    label?: string;
};

export function CopyLinkButton({ url, label = "Copy Link" }: CopyLinkButtonProps) {
    const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

    const buttonText = useMemo(() => {
        if (status === "copied") return "Copied!";
        if (status === "failed") return "Copy failed";
        return label;
    }, [label, status]);

    async function handleCopy() {
        try {
            const toCopy = url ?? window.location.href;

            // Preferred clipboard API
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(toCopy);
            } else {
                // Fallback (older browsers)
                const textarea = document.createElement("textarea");
                textarea.value = toCopy;
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                textarea.style.top = "-9999px";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                const ok = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (!ok) throw new Error("execCommand copy failed");
            }

            setStatus("copied");
            window.setTimeout(() => setStatus("idle"), 1500);
        } catch {
            setStatus("failed");
            window.setTimeout(() => setStatus("idle"), 2000);
        }
    }

    return (
        <Button type="button" variant="secondary" onClick={handleCopy} aria-live="polite">
            {buttonText}
        </Button>
    );
}