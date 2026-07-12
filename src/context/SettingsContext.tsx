import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

export type Theme = "light" | "dark";

type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  theme: Theme;
  app_language: string;
};

type SettingsContextValue = {
  profile: Profile | null;
  loading: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  setAppLanguage: (lang: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "avatar_url">>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const LOCAL_THEME_KEY = "booktranslator-theme";
const FALLBACK_PROFILE: Profile = {
  display_name: null,
  avatar_url: null,
  theme: (localStorage.getItem(LOCAL_THEME_KEY) as Theme) || "light",
  app_language: "en",
};

function applyThemeToDocument(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Logged out: fall back to a local-only theme so the site still respects
  // the visitor's preference before they ever create an account.
  useEffect(() => {
    if (!user) {
      setProfile(FALLBACK_PROFILE);
      applyThemeToDocument(FALLBACK_PROFILE.theme);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("display_name, avatar_url, theme, app_language")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error("Failed to load profile settings", error);
          setProfile(FALLBACK_PROFILE);
          applyThemeToDocument(FALLBACK_PROFILE.theme);
        } else {
          setProfile(data as Profile);
          applyThemeToDocument(data.theme as Theme);
        }
        setLoading(false);
      });
  }, [user]);

  const persist = async (patch: Partial<Profile>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.theme) applyThemeToDocument(patch.theme);

    if (!user) {
      if (patch.theme) localStorage.setItem(LOCAL_THEME_KEY, patch.theme);
      return;
    }

    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) console.error("Failed to save settings", error);
  };

  const value: SettingsContextValue = {
    profile,
    loading,
    setTheme: (theme) => persist({ theme }),
    setAppLanguage: (app_language) => persist({ app_language }),
    updateProfile: (patch) => persist(patch),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
