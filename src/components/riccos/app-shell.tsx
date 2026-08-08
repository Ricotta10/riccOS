import { Link, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  LineChart,
  PieChart,
  Target,
  Wallet,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
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

const items = [
  { title: "Visão Geral", url: "/", icon: PieChart },
  { title: "Transações", url: "/transacoes", icon: Wallet },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Relatórios", url: "/relatorios", icon: LineChart },
];

function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-bold tracking-tight">RiccOS</p>
            <p className="truncate text-xs text-muted-foreground">Gestão financeira</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
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
    </Sidebar>
  );
}

function Topbar() {
  const { month, year, nextMonth, prevMonth, monthTransactions } = useRiccos();
  const { balanco } = summarize(monthTransactions);
  const positive = balanco >= 0;

  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <SidebarTrigger className="shrink-0" />
        <Separator orientation="vertical" className="hidden h-6 md:block" />
        <div className="flex shrink-0 items-center gap-1 rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-30 text-center text-sm font-semibold">
            {monthNames[month]} / {year}
          </span>
          <Button variant="ghost" size="icon" className="size-8" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div
          className={`hidden shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold sm:flex ${
            positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          }`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          Saldo do mês · {formatBRL(balanco)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-semibold">Ricardo Alves</p>
          <p className="text-xs text-muted-foreground">Conta pessoal</p>
        </div>
        <Avatar className="size-9 border">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">RA</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <Topbar />
          <div className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 min-w-0">
      <h1 className="truncate text-2xl font-bold md:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
