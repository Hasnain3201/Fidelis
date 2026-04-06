import Link from "next/link";

type GuestAccessPanelProps = {
  description: string;
};

export function GuestAccessPanel({ description }: GuestAccessPanelProps) {
  return (
    <div className="guestAccessCard" role="region" aria-label="Guest browsing option">
      <p className="guestAccessEyebrow">Not ready to sign in?</p>
      <div className="guestAccessBody">
        <h2>Continue as guest</h2>
        <p>{description}</p>
      </div>

      <div className="guestAccessActions">
        <Link href="/search" className="guestAccessPrimary">
          Continue as Guest
        </Link>
        <Link href="/" className="guestAccessSecondary">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
