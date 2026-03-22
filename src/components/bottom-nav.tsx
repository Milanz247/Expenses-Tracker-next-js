"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboardIcon,
  ArrowRightLeftIcon,
  HandCoinsIcon,
  MoreHorizontalIcon,
  WalletIcon,
  PiggyBankIcon,
  TagIcon,
  SettingsIcon,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Transactions", url: "/transactions", icon: ArrowRightLeftIcon },
  { title: "Debts", url: "/debts", icon: HandCoinsIcon },
]

const moreItems = [
  { title: "Accounts", url: "/accounts", icon: WalletIcon },
  { title: "Budgets", url: "/budgets", icon: PiggyBankIcon },
  { title: "Categories", url: "/categories", icon: TagIcon },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
]

const authPages = ["/login", "/register"]

export function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Don't show on auth pages or root
  if (authPages.includes(pathname) || pathname === "/") return null

  const isMoreActive = moreItems.some((item) => pathname === item.url)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md pb-safe md:hidden">
      <div className="flex h-16 items-center justify-around px-4">
        {mainItems.map((item) => {
          const isActive = pathname === item.url
          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <item.icon
                className={`size-5 ${isActive ? "text-primary" : ""}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{item.title}</span>
            </Link>
          )
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
              isMoreActive
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            <MoreHorizontalIcon
              className={`size-5 ${isMoreActive ? "text-primary" : ""}`}
              strokeWidth={isMoreActive ? 2.5 : 2}
            />
            <span>More</span>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-4">
              {moreItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col items-center gap-2.5 rounded-xl p-5 text-sm font-medium transition-colors sm:p-4 sm:text-xs sm:gap-2 ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted active:bg-muted"
                    }`}
                  >
                    <item.icon className="size-6" strokeWidth={isActive ? 2.5 : 1.5} />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
