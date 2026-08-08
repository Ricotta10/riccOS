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
  { title: "RiccOS", url: "/riccos", icon: Sparkles },
];

const financialItems = [
  { title: "Visão Geral", url: "/", icon: PieChart },
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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border bg-card p-1 shadow-xs">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={prevMonth}
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-32 text-center text-sm font-semibold">
          {monthNames[month]} / {year}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
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
            className="h-10 rounded-xl text-xs font-semibold gap-1.5 px-3"
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
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
            positive ? "bg-success-soft text-success border-success/20" : "bg-danger-soft text-danger border-danger/20"
          }`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          Saldo: {formatBRL(balanco)}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <div className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</div>
        </SidebarInset>
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
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger className="md:hidden shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {showPeriodFilter && <PeriodFilter showBalance={showBalance} />}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
