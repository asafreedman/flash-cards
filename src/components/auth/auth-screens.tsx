"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const fieldStyle = {
  width: "100%",
  background: "#ffffff",
  border: "1px solid #e8e0d0",
  borderRadius: 12,
  padding: "13px 16px",
  fontSize: 15,
  color: "#1a1035",
  outline: "none",
  fontFamily: "var(--font-sans)",
  boxShadow: "0 1px 3px rgba(26,16,53,0.04)",
  transition: "border-color 0.15s",
} as const;

function AuthLogo({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-10 flex flex-col items-center">
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "#1a1035", boxShadow: "0 8px 24px rgba(26,16,53,0.2)" }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect x="2" y="2" width="10" height="14" rx="2.5" fill="white" fillOpacity="0.9" />
          <rect x="14" y="10" width="10" height="14" rx="2.5" fill="white" fillOpacity="0.4" />
        </svg>
      </div>
      <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.2em" }}>
        Flash Cards
      </p>
      <p className="mt-1.5 text-sm" style={{ color: "#8b7355" }}>
        {subtitle}
      </p>
    </div>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Login failed. Please try again.");
        return;
      }

      router.push("/study");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6" style={{ background: "#f5f0e8", fontFamily: "var(--font-sans)" }}>
      <AuthLogo subtitle="Sign in to your study deck" />
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-3xl p-7" style={{ background: "#ffffff", border: "1px solid #e8e0d0", boxShadow: "0 4px 24px rgba(26,16,53,0.07)" }}>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.15em" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e0d0")}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.15em" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e0d0")}
            />
          </div>
          {error && (
            <p className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "#fff5f5", color: "#e57373", border: "1px solid #fecaca" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-2xl py-3.5 text-sm font-semibold transition-all duration-150 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.75 : 1,
              boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
            }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
        <p className="text-center text-xs" style={{ color: "#c4b89a" }}>
          Don&apos;t have an account? {" "}
          <Link href="/create-user" className="font-semibold" style={{ color: "#7c3aed" }}>
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}

export function CreateUserScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password || !confirm) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to create your account.");
        return;
      }

      router.push("/study");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-12" style={{ background: "#f5f0e8", fontFamily: "var(--font-sans)" }}>
      <AuthLogo subtitle="Create your free account" />
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-3xl p-7" style={{ background: "#ffffff", border: "1px solid #e8e0d0", boxShadow: "0 4px 24px rgba(26,16,53,0.07)" }}>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.15em" }}>
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Smith"
              autoComplete="name"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e0d0")}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.15em" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e0d0")}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.15em" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              style={fieldStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e8e0d0")}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: "#8b7355", letterSpacing: "0.15em" }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              style={{
                ...fieldStyle,
                borderColor: confirm && confirm !== password ? "#f87171" : "#e8e0d0",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = confirm !== password ? "#f87171" : "#7c3aed")}
              onBlur={(e) => (e.currentTarget.style.borderColor = confirm && confirm !== password ? "#f87171" : "#e8e0d0")}
            />
          </div>
          {error && (
            <p className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "#fff5f5", color: "#e57373", border: "1px solid #fecaca" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-2xl py-3.5 text-sm font-semibold transition-all duration-150 active:scale-95"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.75 : 1,
              boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
            }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>
        <p className="text-center text-xs" style={{ color: "#c4b89a" }}>
          Already have an account? {" "}
          <Link href="/login" className="font-semibold" style={{ color: "#7c3aed" }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
