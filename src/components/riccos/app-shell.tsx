import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarCog,
  ChevronLeft,
  ChevronRight,
  LineChart,
  LogOut,
  PieChart,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

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
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { formatBRL, monthNames, summarize } from "@/lib/finance-data";
import { useRiccos } from "./store";
import { IosInstallPrompt } from "./ios-install-prompt";

const centralItems = [
  { title: "RiccOS", url: "/", icon: Sparkles },
];

const financialItems = [
  { title: "Visão Geral", url: "/visao-geral", icon: PieChart },
  { title: "Transações", url: "/transacoes", icon: Wallet },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Relatórios", url: "/relatorios", icon: LineChart },
];

export function AppSidebar() {
  const state = useRouterState();
  const { profile, signOut } = useAuth();
  const currentPath = state.location.pathname;

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </div>
            <span>RiccOS</span>
          </div>
          <SidebarTrigger />
        </div>
        <div className="hidden group-data-[collapsible=icon]:block">
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Central</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {centralItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Financeiro</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financialItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-3 min-w-0 group-data-[collapsible=icon]:hidden">
            <Avatar className="size-9 shrink-0 border">
              <AvatarImage src={profile?.user_avatar} alt={profile?.user_nome ?? "Usuário"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                {getInitials(profile?.user_nome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-semibold leading-tight">
                {profile?.user_nome ?? "Usuário RiccOS"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">Conectado</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-danger hover:bg-danger/10 group-data-[collapsible=icon]:size-9"
            onClick={() => signOut()}
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function PeriodFilter({ showBalance = true }: { showBalance?: boolean }) {
  const { month, year, nextMonth, prevMonth, monthTransactions } = useRiccos();
  const { profile, updateDiaVencimento } = useAuth();
  const { balanco } = summarize(monthTransactions);
  const positive = balanco >= 0;

  const currentCutoff = profile?.dia_vencimento ?? 3;

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <div className="flex items-center justify-between sm:justify-start gap-1 rounded-xl border bg-card p-1 shadow-xs flex-1 sm:flex-none min-w-[190px]">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          onClick={prevMonth}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="flex-1 text-center text-xs sm:text-sm font-semibold">
          {monthNames[month]} / {year}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 rounded-lg"
          onClick={nextMonth}
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl text-xs font-semibold gap-1.5 px-3 flex-1 sm:flex-none justify-center"
            title="Alterar dia de vencimento do cartão"
          >
            <CalendarCog className="size-3.5 text-muted-foreground" />
            <span>Vencimento: Dia {currentCutoff}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3.5" align="end">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dia de Vencimento
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define o dia de corte do ciclo financeiro das suas contas e faturas.
              </p>
            </div>
            <div className="pt-1">
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
          </div>
        </PopoverContent>
      </Popover>

      {showBalance && (
        <div
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold w-full sm:w-auto ${
            positive ? "bg-success-soft text-success border-success/20" : "bg-danger-soft text-danger border-danger/20"
          }`}
        >
          <span className="size-2 rounded-full bg-current" />
          Saldo: {formatBRL(balanco)}
        </div>
      )}
    </div>
  );
}

function MobileHeader() {
  const { profile } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur-md md:hidden pt-safe">
      <div className="flex h-14 items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="size-10 rounded-xl" />
          <div className="flex items-center gap-2 font-bold text-base">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="size-3.5" />
            </div>
            <span className="tracking-tight">RiccOS</span>
          </div>
        </div>

        <Avatar className="size-8 border">
          <AvatarImage src={profile?.user_avatar} alt={profile?.user_nome ?? "Usuário"} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-[11px]">
            {getInitials(profile?.user_nome)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  const state = useRouterState();
  const currentPath = state.location.pathname;

  const navItems = [
    { title: "RiccOS", url: "/", icon: Sparkles },
    { title: "Visão Geral", url: "/visao-geral", icon: PieChart },
    { title: "Transações", url: "/transacoes", icon: Wallet },
    { title: "Metas", url: "/metas", icon: Target },
    { title: "Relatórios", url: "/relatorios", icon: LineChart },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-xl md:hidden pb-safe">
      <div className="grid h-16 grid-cols-5 items-center px-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.url;
          const Icon = item.icon;
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex flex-col items-center justify-center gap-1 py-1 text-center transition-colors rounded-xl mx-0.5 ${
                isActive
                  ? "text-primary font-semibold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground active:scale-95"
              }`}
            >
              <Icon className={`size-5 ${isActive ? "text-primary scale-110" : ""}`} />
              <span className="text-[10px] leading-none truncate max-w-full px-0.5">
                {item.title}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full flex-col md:flex-row bg-background">
        <AppSidebar />
        <MobileHeader />
        <SidebarInset className="min-w-0 flex-1">
          <div className="flex-1 px-3 py-4 sm:px-6 sm:py-8 pb-24 md:pb-8">{children}</div>
        </SidebarInset>
        <MobileBottomNav />
        <IosInstallPrompt />
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  description,
  children,
  showPeriodFilter = true,
  showBalance = true,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  showPeriodFilter?: boolean;
  showBalance?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold sm:text-2xl md:text-3xl tracking-tight">{title}</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        {showPeriodFilter && <PeriodFilter showBalance={showBalance} />}
        {children && <div className="w-full sm:w-auto">{children}</div>}
      </div>
    </div>
  );
}
