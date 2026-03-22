"use client"

import { useEffect, useState } from "react"
import Cookies from "js-cookie"
import { LogOutIcon, RefreshCwIcon } from "lucide-react"
import { invalidateCache } from "@/lib/api"

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

interface PageShellProps {
  user: { name: string; email: string } | null
  title: string
  children: React.ReactNode
  /** Extra elements rendered on the right side of the header (before logout) */
  headerActions?: React.ReactNode
}

export function PageShell({ user, title, children, headerActions }: PageShellProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // Update once per minute — seconds not shown, avoids constant re-renders
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar user={{ name: user?.name ?? "", email: user?.email ?? "", avatar: "" }} />
      <SidebarInset>
        <header className="flex h-14 md:h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1 hidden md:flex" />
          <Separator
            orientation="vertical"
            className="mr-2 hidden md:block data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-3">
            {headerActions}
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-semibold tabular-nums leading-none">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {now.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground hidden lg:flex"
              onClick={() => {
                invalidateCache()
                localStorage.clear()
                sessionStorage.clear()
                // Also clear the SW API cache
                caches.delete("expense-tracker-api-v1").catch(() => {})
                globalThis.location.reload()
              }}
            >
              <RefreshCwIcon className="size-4" />
              <span className="hidden sm:inline">Clear Cache</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                Cookies.remove("token")
                invalidateCache()
                // Hard navigation so middleware sees the cleared cookie
                globalThis.location.replace("/login")
              }}
            >
              <LogOutIcon className="size-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 page-content">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** Skeleton version of PageShell for loading states */
export function PageShellSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar user={{ name: "", email: "", avatar: "" }} />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-6 p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
