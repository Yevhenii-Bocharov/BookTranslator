import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. HARD CORRECTION FOR OAUTH/PKCE REDIRECT CODES:
    // This intercepts the login response before standard routers can clear the URL parameters.
    const params = new URLSearchParams(window.location.search);
    const hasPkceCode = params.has("code");

    if (hasPkceCode) {
      console.log(
        "[Auth Context] PKCE login authorization token detected in URL parameter!",
      );
    }

    // 2. Fetch or resolve the current user session layout
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      console.log("[Auth Context] initial getSession response:", {
        session: data.session,
        error,
      });

      if (data.session) {
        setSession(data.session);
      }

      // If we don't have a PKCE code in the URL, we can safely turn off loading now.
      // If we DO have a code, let the onAuthStateChange listener process the exchange.
      if (!hasPkceCode) {
        setLoading(false);
      }
    });

    // 3. Listen continuously for auth state modifications
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        console.log("[Auth Context] onAuthStateChange event received:", {
          event,
          userId: newSession?.user?.id ?? "No User",
        });

        setSession(newSession);
        setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail: AuthContextValue["signUpWithEmail"] = async (
    email,
    password,
  ) => {
    try {
      console.log("[Auth Context] Initiating signUpWithEmail...");
      const { data, error } = await supabase.auth.signUp({ email, password });
      console.log("[Auth Context] signUpWithEmail response raw:", {
        data,
        error,
      });
      return { error: error?.message ?? null };
    } catch (err: any) {
      console.error("[Auth Context] Native crash in signUpWithEmail:", err);
      return { error: err.message || "An unexpected error occurred." };
    }
  };

  const signInWithEmail: AuthContextValue["signInWithEmail"] = async (
    email,
    password,
  ) => {
    try {
      console.log("[Auth Context] Initiating signInWithEmail...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log("[Auth Context] signInWithEmail response raw:", {
        data,
        error,
      });
      return { error: error?.message ?? null };
    } catch (err: any) {
      console.error("[Auth Context] Native crash in signInWithEmail:", err);
      return { error: err.message || "An unexpected error occurred." };
    }
  };

  const signInWithGoogle: AuthContextValue["signInWithGoogle"] = async () => {
    try {
      console.log("[Auth Context] Redirecting to Google OAuth flow...");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err.message || "Failed to initialize Google login." };
    }
  };

  const signInWithApple: AuthContextValue["signInWithApple"] = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: window.location.origin },
      });
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err.message || "Failed to initialize Apple login." };
    }
  };

  const signOut = async () => {
    console.log("[Auth Context] Logging out session...");
    await supabase.auth.signOut();
    setSession(null);
  };

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
