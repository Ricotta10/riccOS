import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportRiccosError } from "../lib/riccos-error-reporting";
import { AuthProvider, useAuth } from "../lib/auth";
import { AppShell } from "../components/riccos/app-shell";
import { LogoMark, LogoTile } from "../components/riccos/brand";
import { RiccosProvider } from "../components/riccos/store";
import { GamificationProvider } from "../components/riccos/gamification";
import { ThemeProvider, THEME_BOOT_SCRIPT } from "../components/riccos/theme";
import { Button } from "../components/ui/button";
import { Toaster } from "../components/ui/sonner";

function FullscreenLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background">
      <div className="relative grid size-20 place-items-center">
        <span className="animate-orbit absolute inset-0 rounded-full border border-dashed border-primary/40" />
        <span className="ring-gradient animate-orbit-fast absolute inset-2 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),black_calc(100%-2px))] [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%-2px),black_calc(100%-2px))]" />
        <LogoMark className="h-6 text-foreground" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Carregando
      </p>
    </div>
  );
}

function StatusPage({
  code,
  title,
  description,
  actions,
}: {
  code?: string;
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <div aria-hidden className="grid-bg pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]"
      />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-soft">
        <LogoTile tone="dark" className="mx-auto size-14" />
        {code && (
          <p className="mt-6 text-6xl font-semibold tracking-tight text-primary tabular-nums">
            {code}
          </p>
        )}
        <h1 className="mt-3 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <StatusPage
      code="404"
      title="Página não encontrada"
      description="O endereço que você acessou não existe ou foi movido."
      actions={
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportRiccosError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <StatusPage
      title="Esta página não carregou"
      description="Algo deu errado do nosso lado. Você pode tentar novamente ou voltar ao início."
      actions={
        <>
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Tentar novamente
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Voltar ao início</a>
          </Button>
        </>
      }
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "RiccOS — Gestão financeira pessoal" },
      {
        name: "description",
        content:
          "RiccOS: dashboard de gestão financeira pessoal com lançamentos, metas de gastos e relatórios.",
      },
      { property: "og:title", content: "RiccOS — Gestão financeira pessoal" },
      {
        property: "og:description",
        content: "Controle entradas, saídas, tetos de gastos e projeções em um único painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@RiccOS" },
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "RiccOS" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [{ children: THEME_BOOT_SCRIPT }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthenticatedContent() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      navigate({ to: "/login" });
    }
  }, [user, loading, isLoginPage, navigate]);

  if (loading) {
    return <FullscreenLoader />;
  }

  if (isLoginPage) {
    return <Outlet />;
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("ServiceWorker registrado com sucesso:", reg.scope);
          })
          .catch((err) => {
            console.error("Erro ao registrar ServiceWorker:", err);
          });
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RiccosProvider>
            <GamificationProvider>
              <AuthenticatedContent />
              <Toaster richColors closeButton />
            </GamificationProvider>
          </RiccosProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
