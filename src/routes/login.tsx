import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { LogoMark, LogoTile, Wordmark } from "@/components/riccos/brand";
import { ThemeToggle } from "@/components/riccos/theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso — RiccOS" },
      { name: "description", content: "Acesso exclusivo ao RiccOS." },
    ],
  }),
  component: LoginPage,
});

const highlights = [
  "Comando de voz para o dia a dia",
  "Um módulo para cada área da vida",
  "No navegador ou como app no celular",
];

function LoginPage() {
  const { user, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Redirecionar se o usuário já estiver autenticado
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/" });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("E-mail ou senha incorretos. Verifique suas credenciais.");
        } else {
          setErrorMessage(error.message || "Erro ao efetuar login. Tente novamente.");
        }
      } else {
        navigate({ to: "/" });
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Ocorreu um erro inesperado ao autenticar.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ---------- Painel de marca (desktop) ---------- */}
      <aside className="dark relative hidden overflow-hidden bg-brand-black text-brand-snow lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-70" />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-1/3 size-[520px] rounded-full bg-brand-mint/20 blur-[140px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 size-[420px] rounded-full bg-brand-sage/15 blur-[120px]"
        />

        <div className="relative flex items-center gap-3">
          <LogoTile tone="light" className="size-11" />
          <Wordmark className="text-xl text-brand-snow" />
        </div>

        <div className="relative max-w-md">
          <LogoMark className="mb-8 h-24 text-brand-mint drop-shadow-[0_0_30px_rgba(207,255,226,0.35)]" />
          <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            Seu assistente <span className="text-gradient animate-shimmer">pessoal.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-brand-snow/65">
            Fale, registre, acompanhe. O RiccOS organiza o que importa em um painel só — e cresce
            junto com a sua rotina.
          </p>
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-brand-snow/80">
                <span className="grid size-6 place-items-center rounded-full bg-brand-mint/15 ring-1 ring-brand-mint/30">
                  <span className="size-1.5 rounded-full bg-brand-mint shadow-[0_0_10px_var(--brand-mint)]" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-snow/40">
          © {new Date().getFullYear()} RiccOS · Rodrigo Ricotta
        </p>
      </aside>

      {/* ---------- Formulário ---------- */}
      <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:min-h-0">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 size-[380px] rounded-full bg-primary/15 blur-[120px] lg:hidden"
        />
        <div className="pt-safe absolute right-4 top-4">
          <ThemeToggle />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Marca (mobile) */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center lg:hidden">
            <LogoTile tone="dark" className="size-16 rounded-[22px]" />
            <div>
              <Wordmark className="text-2xl" />
              <p className="mt-1 text-sm text-muted-foreground">Seu assistente pessoal</p>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                <ShieldCheck className="size-3.5" />
                Acesso exclusivo
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre com suas credenciais para acessar o painel.
              </p>
            </div>

            {errorMessage && (
              <Alert variant="destructive" className="mb-5 py-3 text-xs">
                <AlertCircle className="size-4" />
                <AlertTitle className="font-semibold">Falha de acesso</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 pl-10"
                    autoComplete="email"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pl-10 pr-11"
                    autoComplete="current-password"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="mt-2 w-full justify-between px-5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span>Autenticando…</span>
                    <Loader2 className="animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Entrar no sistema</span>
                    <ArrowRight />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            RiccOS · Assistente pessoal
          </p>
        </div>
      </main>
    </div>
  );
}
