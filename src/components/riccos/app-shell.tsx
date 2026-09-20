import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  AudioLines,
  BarChart3,
  Bell,
  BellOff,
  CalendarCog,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import {
  getPushSubscriptionState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from "@/lib/push";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { formatBRL, monthNames, summarize } from "@/lib/finance-data";
import { cn } from "@/lib/utils";
import { LogoMark, LogoTile, Wordmark } from "./brand";
import { IosInstallPrompt } from "./ios-install-prompt";
import { useRiccos } from "./store";
import { ThemeToggle } from "./theme";

const centralItems = [{ title: "Comando de voz", url: "/", icon: AudioLines }];

const financialItems = [
  { title: "Visão Geral", url: "/visao-geral", icon: LayoutGrid },
  { title: "Transações", url: "/transacoes", icon: ArrowLeftRight },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Missões", url: "/missoes", icon: Trophy },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

/** Itens da bottom nav mobile (Relatórios fica no menu lateral) */
const mobileNavItems = financialItems.filter((i) => i.url !== "/relatorios");

function getInitials(name?: string) {
  if (!name) return "R";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function UserAvatar({ className }: { className?: string }) {
  const { profile } = useAuth();
  return (
    <Avatar className={cn("size-9 shrink-0 ring-2 ring-primary/30", className)}>
      <AvatarImage src={profile?.user_avatar} alt={profile?.user_nome ?? "Usuário"} />
      <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
        {getInitials(profile?.user_nome)}
      </AvatarFallback>
    </Avatar>
  );
}

const menuButtonClass =
  "h-11 rounded-xl px-3 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-semibold group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:[&>span]:hidden [&>svg]:size-[18px]";

/**
 * Botão redondo minimalista de expandir/colapsar (desktop).
 * Fica logo abaixo do item "Comando de voz", alinhado à coluna de ícones.
 */
function SidebarCollapseToggle() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <div className="hidden pt-1 md:flex group-data-[collapsible=icon]:justify-center">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="ml-[7px] grid size-7 place-items-center rounded-full border border-brand-snow/10 bg-brand-black text-brand-snow/60 transition-all hover:scale-110 hover:border-brand-mint/60 hover:bg-brand-mint hover:text-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:ml-0"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="size-3.5" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}

export function AppSidebar() {
  const state = useRouterState();
  const { profile, signOut } = useAuth();
  const { setOpenMobile } = useSidebar();
  const currentPath = state.location.pathname;

  const isActive = (url: string) =>
    currentPath === url || (url === "/" && currentPath === "/riccos");

  const renderItems = (items: typeof financialItems) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          isActive={isActive(item.url)}
          tooltip={item.title}
          className={menuButtonClass}
        >
          <Link to={item.url} onClick={() => setOpenMobile(false)}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon" variant="inset" className="border-none">
      {/* Escopo `dark`: a sidebar é sempre preta, então os tokens internos seguem o tema escuro */}
      <div className="dark flex h-full w-full flex-col">
        <SidebarHeader className="px-3 pt-4 pb-2 group-data-[collapsible=icon]:px-0">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <Link
              to="/"
              className="flex min-w-0 items-center gap-2.5 outline-none"
              onClick={() => setOpenMobile(false)}
            >
              <LogoTile tone="light" className="size-10" />
              <div className="flex min-w-0 flex-col">
                <Wordmark className="text-lg text-brand-snow" />
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/60">
                  Gestão pessoal
                </span>
              </div>
            </Link>
          </div>
          <div className="hidden justify-center group-data-[collapsible=icon]:flex">
            <LogoTile tone="light" className="size-10 rounded-xl" />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 group-data-[collapsible=icon]:px-0">
          <SidebarGroup>
            <SidebarGroupLabel>Central</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{renderItems(centralItems)}</SidebarMenu>
            </SidebarGroupContent>
            <SidebarCollapseToggle />
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">{renderItems(financialItems)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-3 group-data-[collapsible=icon]:p-2">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-2 group-data-[collapsible=icon]:border-none group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:flex-col">
              <UserAvatar className="size-9 group-data-[collapsible=icon]:size-10" />
              <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold leading-tight text-brand-snow">
                  {profile?.user_nome ?? "Usuário RiccOS"}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] leading-tight text-sidebar-foreground/70">
                  <span className="size-1.5 rounded-full bg-brand-mint shadow-[0_0_8px_var(--brand-mint)]" />
                  Conectado
                </span>
              </div>
              <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
                <ThemeToggle
                  size="icon-sm"
                  className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-brand-snow group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:rounded-xl"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-sidebar-foreground hover:bg-danger/15 hover:text-danger group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:rounded-xl"
                  onClick={() => signOut()}
                  title="Sair da conta"
                  aria-label="Sair da conta"
                >
                  <LogOut />
                </Button>
              </div>
            </div>
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}

export function PeriodFilter({ showBalance = true }: { showBalance?: boolean }) {
  const { month, year, nextMonth, prevMonth, monthTransactions } = useRiccos();
  const { profile, user, updateDiaVencimento } = useAuth();
  const { balanco } = summarize(monthTransactions);
  const positive = balanco >= 0;

  const currentCutoff = profile?.dia_vencimento ?? 3;

  const [pushState, setPushState] = useState<PushState>("no-window");
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    getPushSubscriptionState()
      .then(setPushState)
      .catch((err) => {
        console.error("[push] erro ao checar estado da inscrição:", err);
        toast.error(
          err instanceof Error
            ? `Erro ao checar notificações: ${err.message}`
            : "Erro ao checar notificações push.",
        );
      });
  }, []);

  const handlePushToggle = async (checked: boolean) => {
    const userId = profile?.user_id ?? user?.id;
    if (!userId) return;

    setPushLoading(true);
    try {
      if (checked) {
        await subscribeToPush(userId);
        setPushState("subscribed");
        toast.success("Notificações push ativadas.");
      } else {
        await unsubscribeFromPush();
        setPushState("unsubscribed");
        toast.success("Notificações push desativadas.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar as notificações.");
    } finally {
      setPushLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <div className="flex h-11 min-w-[200px] flex-1 items-center justify-between gap-1 rounded-xl border bg-card p-1 shadow-soft sm:h-10 sm:flex-none">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg"
          onClick={prevMonth}
          aria-label="Mês anterior"
        >
          <ChevronLeft />
        </Button>
        <span className="flex-1 text-center text-sm font-semibold tabular-nums">
          {monthNames[month]} <span className="text-muted-foreground font-medium">/ {year}</span>
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 rounded-lg"
          onClick={nextMonth}
          aria-label="Próximo mês"
        >
          <ChevronRight />
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-11 flex-1 justify-center gap-1.5 px-3 text-xs sm:h-10 sm:flex-none"
            title="Alterar dia de vencimento do cartão"
          >
            <CalendarCog className="text-muted-foreground" />
            <span>Vencimento · dia {currentCutoff}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Dia de vencimento
              </h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Define o dia de corte do ciclo financeiro das suas contas e faturas.
              </p>
            </div>
            <Select
              value={String(currentCutoff)}
              onValueChange={(val) => updateDiaVencimento(Number(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Dia {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shrink-0 sm:size-10"
            title="Notificações push"
            aria-label="Notificações push"
          >
            {pushState === "subscribed" ? (
              <Bell className="text-primary" />
            ) : (
              <BellOff className="text-muted-foreground" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-3">
            <div className="space-y-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Notificações push
              </h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Receba um aviso no seu iPhone quando o agente de IA gerar as metas do próximo mês.
              </p>
            </div>
            {pushState !== "subscribed" && pushState !== "unsubscribed" ? (
              <p className="text-xs text-muted-foreground">
                {pushState === "no-push-manager" &&
                  "Push não suportado neste navegador. No iPhone, abra o RICC OS pelo ícone da tela de início (não pelo Safari) — é preciso iOS 16.4 ou mais recente."}
                {pushState === "no-service-worker" &&
                  "Este navegador não suporta notificações push."}
                {pushState === "no-vapid-key" &&
                  "Configuração pendente no servidor (chave pública ausente). Avise o suporte."}
                {pushState === "timeout" &&
                  "O navegador não respondeu a tempo (o service worker pode estar travado). Feche o app por completo e abra de novo."}
                {pushState === "no-window" && "Carregando..."}
              </p>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Ativar notificações</span>
                <Switch
                  checked={pushState === "subscribed"}
                  disabled={pushLoading}
                  onCheckedChange={handlePushToggle}
                />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {showBalance && (
        <div
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold sm:h-10 sm:w-auto",
            positive
              ? "border-success/20 bg-success-soft text-success"
              : "border-danger/20 bg-danger-soft text-danger",
          )}
        >
          <span className="size-2 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
          Saldo {formatBRL(balanco)}
        </div>
      )}
    </div>
  );
}

function MobileHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="pt-safe sticky top-0 z-30 w-full md:hidden">
      <div className="glass mx-3 mt-2 flex h-14 items-center justify-between rounded-2xl px-2 pr-3">
        <Link to="/" className="flex items-center gap-2.5 pl-1">
          <LogoTile tone="dark" className="size-9 rounded-xl" />
          <Wordmark className="text-base" />
        </Link>

        <div className="flex items-center gap-1">
          <ThemeToggle size="icon-sm" />
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Abrir menu"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UserAvatar className="size-8" />
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const state = useRouterState();
  const currentPath = state.location.pathname;

  const left = mobileNavItems.slice(0, 2);
  const right = mobileNavItems.slice(2);
  const coreActive = currentPath === "/" || currentPath === "/riccos";

  const NavItem = ({ item }: { item: (typeof financialItems)[number] }) => {
    const active = currentPath === item.url;
    const Icon = item.icon;
    return (
      <Link
        to={item.url}
        className={cn(
          "flex h-full flex-col items-center justify-center gap-1 rounded-2xl text-center transition-all active:scale-95",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "grid size-8 place-items-center rounded-xl transition-colors",
            active && "bg-primary/12",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <span className="text-[10px] font-medium leading-none">{item.title}</span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-3 z-40 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
      aria-label="Navegação principal"
    >
      <div className="glass relative grid h-[68px] grid-cols-5 items-stretch rounded-[28px] px-1.5 shadow-2xl">
        {left.map((item) => (
          <NavItem key={item.url} item={item} />
        ))}

        {/* Núcleo central elevado */}
        <div className="relative">
          <Link
            to="/"
            aria-label="Comando de voz"
            className={cn(
              "absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-[62%] place-items-center rounded-full border-4 border-background transition-all active:scale-95",
              coreActive
                ? "bg-primary text-primary-foreground shadow-glow"
                : "bg-brand-black text-brand-mint shadow-soft ring-1 ring-brand-snow/10",
            )}
          >
            <LogoMark className="h-5" />
          </Link>
        </div>

        {right.map((item) => (
          <NavItem key={item.url} item={item} />
        ))}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="min-w-0 flex-1 md:min-h-[calc(100svh-1rem)]">
        <MobileHeader />
        <div className="flex-1 px-3 pb-32 pt-4 sm:px-6 md:px-8 md:pb-10 md:pt-8">{children}</div>
      </SidebarInset>
      <MobileBottomNav />
      <IosInstallPrompt />
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  description,
  children,
  showPeriodFilter = true,
  showBalance = true,
  eyebrow,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  showPeriodFilter?: boolean;
  showBalance?: boolean;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col flex-wrap items-stretch gap-3 sm:flex-row sm:items-center">
        {showPeriodFilter && <PeriodFilter showBalance={showBalance} />}
        {children && <div className="w-full sm:w-auto">{children}</div>}
      </div>
    </div>
  );
}
