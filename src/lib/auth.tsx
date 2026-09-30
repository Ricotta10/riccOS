import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface UserProfile {
  idx?: number;
  user_id?: string;
  user_nome?: string;
  user_email?: string;
  user_telefone?: string;
  user_avatar?: string;
  dia_vencimento?: number | null;
  criado_em?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  updateDiaVencimento: (day: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    try {
      // Multiusuário: o perfil é sempre o do usuário logado (linha criada pelo trigger
      // handle_new_user). Nunca cair em outro registro, para não exibir o perfil de outra pessoa.
      const { data } = await supabase
        .from("usuarios")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      setProfile((data as UserProfile) ?? null);
    } catch (err) {
      console.error("Erro ao buscar perfil na tabela 'usuarios':", err);
      setProfile(null);
    }
  };

  useEffect(() => {
    // Obter sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      fetchProfile(currentUser).finally(() => setLoading(false));
    });

    // Escutar mudanças no estado de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      fetchProfile(currentUser).finally(() => setLoading(false));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const updateDiaVencimento = async (day: number) => {
    if (!profile) return;
    setProfile((prev) => (prev ? { ...prev, dia_vencimento: day } : null));

    try {
      if (profile.user_id) {
        await supabase.from("usuarios").update({ dia_vencimento: day }).eq("user_id", profile.user_id);
      }
    } catch (err) {
      console.error("Erro ao atualizar dia_vencimento do usuário:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signIn, signOut, updateDiaVencimento }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
