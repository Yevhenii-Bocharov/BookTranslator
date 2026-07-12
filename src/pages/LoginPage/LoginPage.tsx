import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const {
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple: _signInWithApple,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If session evaluation is fully complete and user data exists, redirect home immediately
  if (!loading && user) {
    console.log(
      "[LoginPage UI] User authenticated successfully. Redirecting to home layout...",
    );
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    console.log(`[LoginPage UI] Form submitted in "${mode}" layout state.`);

    try {
      const result =
        mode === "signin"
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);

      console.log(
        "[LoginPage UI] Context promise resolved with payload output:",
        result,
      );

      if (result.error) {
        setError(result.error);
      } else if (mode === "signup") {
        setInfo(
          "Registration successful! Please check your email inbox to verify your account credentials.",
        );
      }
    } catch (err: any) {
      console.error(
        "[LoginPage UI] Fatal error processing submit sequence:",
        err,
      );
      setError(err?.message || "An unhandled UI processing error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <p>Verifying authentication session status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{mode === "signin" ? "Log in" : "Create your account"}</h1>

        <div className="oauth-buttons">
          <button
            type="button"
            className="oauth-btn google"
            disabled={submitting}
            onClick={async () => {
              setError(null);
              const res = await signInWithGoogle();
              if (res.error) setError(res.error);
            }}
          >
            Continue with Google
          </button>
        </div>

        <div className="divider">
          <span>or</span>
        </div>

        <form onSubmit={handleSubmit} className="email-form">
          <label>
            Email
            <input
              type="email"
              required
              disabled={submitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              disabled={submitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
            />
          </label>

          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : mode === "signin"
                ? "Log in"
                : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          className="mode-toggle"
          disabled={submitting}
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
