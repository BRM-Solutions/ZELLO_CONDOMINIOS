import { highestRole, meResponseSchema, type Membership, type Role } from "@app/shared";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMatch } from "react-router-dom";
import { apiFetch, setActiveOrganizationId } from "../api";
import { getSupabase } from "../supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  email: string | null;
  memberships: Membership[];
  organizationId: string | undefined;
  role: Role | undefined;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const orgMatch = useMatch("/o/:organizationId/*");

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!next) queryClient.clear();
      setSession(next);
      setSessionLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id;
  const me = useQuery({
    queryKey: ["me", userId],
    enabled: Boolean(userId),
    queryFn: async () => meResponseSchema.parse(await apiFetch("/me")).data,
  });

  const memberships = useMemo(() => me.data?.memberships ?? [], [me.data]);
  const requestedOrg = orgMatch?.params.organizationId;
  const organizationId = memberships.some((m) => m.organizationId === requestedOrg) ? requestedOrg : undefined;
  setActiveOrganizationId(organizationId);
  const role = useMemo(
    () =>
      highestRole(memberships.filter((m) => m.organizationId === organizationId).map((m) => m.role)),
    [memberships, organizationId],
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      session,
      loading: sessionLoading || (Boolean(userId) && me.isPending),
      email: me.data?.email ?? session?.user.email ?? null,
      memberships,
      organizationId,
      role,
      signInWithPassword,
      signInWithMagicLink,
      signOut,
    }),
    [session, sessionLoading, userId, me.isPending, me.data, memberships, organizationId, role, signInWithPassword, signInWithMagicLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return value;
}
