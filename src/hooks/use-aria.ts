import { useEffect, useState } from "react";
import { getAuthUser, getSession, loadSessions, subscribe, type AuthUser, type Session } from "@/lib/aria-store";

/** null = still hydrating from localStorage (render a loading state). */
export function useSessions(): Session[] | null {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    const sync = () => setSessions(loadSessions());
    sync();
    return subscribe(sync);
  }, []);
  return sessions;
}

export function useSession(id: string): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sync = () => {
      setSession(getSession(id) ?? null);
      setLoading(false);
    };
    sync();
    return subscribe(sync);
  }, [id]);
  return { session, loading };
}

export function useAuthUser(): { user: AuthUser | null; loading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sync = () => {
      setUser(getAuthUser());
      setLoading(false);
    };
    sync();
    return subscribe(sync);
  }, []);
  return { user, loading };
}
