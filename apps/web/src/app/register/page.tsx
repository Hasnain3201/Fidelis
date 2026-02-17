import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  return (
    <section className="siteSection pageAuth">
      <div className="siteContainer">
        <div className="authCard">
          <h1>Create Account</h1>
          <p className="meta">Register as a user, artist, or venue owner.</p>

          <div className="authForm">
            <Input type="text" label="Full Name" placeholder="Jane Doe" />
            <Input type="email" label="Email" placeholder="you@example.com" />
            <Input type="password" label="Password" placeholder="At least 8 characters" />
            <Input type="text" label="Role" placeholder="user / artist / venue" />
            <Button type="button" fullWidth>
              Create Account
            </Button>
          </div>

          <p className="authSwitch">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
