import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Lock, Mail, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acesso Exclusivo — RiccOS" },
      { name: "description", content: "Acesso exclusivo do Rodrigo ao RiccOS." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="dark flex min-h-screen items-center justify-center bg-[#0B0F17]">
        <Loader2 className="size-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="dark relative flex min-h-screen w-full items-center justify-center bg-[#090D16] text-slate-100 p-4 md:p-8 overflow-hidden font-sans">
      {/* Background Orbs & Effects */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute size-[350px] rounded-full bg-indigo-500/10 blur-[100px] -top-10 -right-10" />
      </div>

      <Card className="relative z-10 w-full max-w-md border border-slate-800/80 bg-slate-900/90 p-2 shadow-2xl shadow-emerald-950/20 backdrop-blur-md">
        <CardHeader className="space-y-3 text-center pb-4 pt-6">
          <div className="mx-auto flex size-13 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-inner">
            <Sparkles className="size-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-white">RiccOS</CardTitle>
            <CardDescription className="mt-1.5 text-xs font-medium text-emerald-400/90 bg-emerald-500/10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20">
              <ShieldCheck className="size-3.5" />
              Acesso exclusivo do Rodrigo
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 px-6 pb-6">
          {errorMessage && (
            <Alert
              variant="destructive"
              className="py-2.5 text-xs bg-red-950/50 border-red-900/60 text-red-200"
            >
              <AlertCircle className="size-4 text-red-400" />
              <AlertTitle className="font-semibold text-red-300">Falha de Acesso</AlertTitle>
              <AlertDescription className="text-red-300/90">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-300">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 text-sm bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-300">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 text-sm bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-2 w-full font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 transition-all duration-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                "Entrar no Sistema"
              )}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-1.5 border-t border-slate-800/80 pt-4 text-center text-[11px] text-slate-500">
            <span>RiccOS · Painel de Gestão Pessoal</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
