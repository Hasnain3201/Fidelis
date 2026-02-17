export default function LoginPage() {
  return (
    <section className="page grid" style={{ gap: 18, maxWidth: 520 }}>
      <h1>Login</h1>
      <p className="meta">Placeholder auth screen. Next step is Supabase Auth (email/password + social sign-in).</p>

      <div className="card grid" style={{ gap: 12 }}>
        <label>
          <div className="meta" style={{ marginBottom: 6 }}>
            Email
          </div>
          <input className="input" type="email" placeholder="you@example.com" />
        </label>
        <label>
          <div className="meta" style={{ marginBottom: 6 }}>
            Password
          </div>
          <input className="input" type="password" placeholder="********" />
        </label>
        <button className="button" type="button">
          Continue
        </button>
      </div>
    </section>
  );
}
