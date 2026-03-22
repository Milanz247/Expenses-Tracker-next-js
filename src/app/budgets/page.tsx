"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Cookies from "js-cookie"
import { toast } from "sonner"
import {
  PlusIcon,
  PiggyBankIcon,
  LogOutIcon,
  Trash2Icon,
  PencilIcon,
} from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getMe, getCategories, getBudgets, createBudget, deleteBudget, AuthError } from "@/lib/api"
import { usePreferences } from "@/lib/preferences"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  id: number
  name: string
  type: "income" | "expense" | "transfer"
}

interface Budget {
  id: number
  user_id: number
  category_id: number
  amount: number
  month: number
  year: number
  category_name: string
  spent: number
  percent_used: number
}

// ─── Form schema ──────────────────────────────────────────────────────────────
const budgetSchema = z.object({
  category_id: z.coerce.number().positive("Category is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
})

type BudgetFormData = z.infer<typeof budgetSchema>

const nativeSelectClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

// ─── Component ────────────────────────────────────────────────────────────────
export default function BudgetsPage() {
  const router = useRouter()
  const { formatCurrency } = usePreferences()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema) as Resolver<BudgetFormData>,
    defaultValues: { category_id: 0, amount: 0 },
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const today = new Date()
      const [meRes, catRes, budgetRes] = await Promise.all([
        getMe(),
        getCategories(),
        getBudgets({ month: today.getMonth() + 1, year: today.getFullYear() }),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((meRes as any)?.user ?? null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCategories((catRes as any)?.categories ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBudgets((budgetRes as any)?.budgets ?? [])
    } catch (err) {
      if (err instanceof AuthError) {
        Cookies.remove("token")
        router.push("/login")
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function openCreate() {
    setEditingBudget(null)
    form.reset({ category_id: 0, amount: 0 })
    setOpen(true)
  }

  function openEdit(budget: Budget) {
    setEditingBudget(budget)
    form.reset({ category_id: budget.category_id, amount: budget.amount })
    setOpen(true)
  }

  async function onSubmit(data: BudgetFormData) {
    try {
      const today = new Date()
      await createBudget({
        category_id: data.category_id,
        amount: data.amount,
        month: today.getMonth() + 1,
        year: today.getFullYear(),
      })
      toast.success(editingBudget ? "Budget updated!" : "Budget added!")
      setOpen(false)
      setEditingBudget(null)
      form.reset({ category_id: 0, amount: 0 })
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save budget")
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      await deleteBudget(id)
      toast.success("Budget deleted")
      setBudgets((prev) => prev.filter((b) => b.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete budget")
    } finally {
      setDeletingId(null)
    }
  }

  // Only expense categories for budget
  const expenseCategories = categories.filter((c) => c.type === "expense")

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar user={{ name: "", email: "", avatar: "" }} />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const currentMonth = new Date().toLocaleDateString([], { month: "long", year: "numeric" })

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: user?.name ?? "", email: user?.email ?? "", avatar: "" }}
      />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Budgets</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-semibold tabular-nums leading-none">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {now.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                Cookies.remove("token")
                router.push("/login")
              }}
            >
              <LogOutIcon className="size-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
          {/* Page heading + add button */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
              <p className="text-sm text-muted-foreground">
                Set monthly spending limits for your categories &mdash; {currentMonth}
              </p>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" className="gap-2" />}>
                <PlusIcon className="size-4" />
                Add Budget
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingBudget ? "Edit Budget" : "New Budget"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="budget-cat">Category</Label>
                    <select
                      id="budget-cat"
                      {...form.register("category_id")}
                      className={nativeSelectClass}
                      disabled={!!editingBudget}
                    >
                      <option value={0}>Select category</option>
                      {expenseCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.category_id && (
                      <p className="text-xs text-destructive">{form.formState.errors.category_id.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="budget-amount">Monthly Limit ($)</Label>
                    <Input
                      id="budget-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...form.register("amount")}
                      autoFocus
                    />
                    {form.formState.errors.amount && (
                      <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                    )}
                  </div>

                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving…" : editingBudget ? "Update Budget" : "Add Budget"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Budget list */}
          {budgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <PiggyBankIcon className="size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No budgets yet</p>
              <p className="text-xs text-muted-foreground">Click &quot;Add Budget&quot; to set spending limits for your categories.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {budgets.map((budget) => {
                const percentage = budget.percent_used
                let statusColor = "bg-green-500"
                let textColor = "text-green-600"
                let bgColor = "bg-green-50 dark:bg-green-950/20"

                if (percentage > 90) {
                  statusColor = "bg-red-500"
                  textColor = "text-red-500"
                  bgColor = "bg-red-50 dark:bg-red-950/20"
                } else if (percentage >= 70) {
                  statusColor = "bg-yellow-500"
                  textColor = "text-yellow-600"
                  bgColor = "bg-yellow-50 dark:bg-yellow-950/20"
                }

                return (
                  <div
                    key={budget.id}
                    className={`rounded-lg border p-4 ${bgColor} transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{budget.category_name}</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                              onClick={() => openEdit(budget)}
                              aria-label={`Edit ${budget.category_name} budget`}
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === budget.id}
                              onClick={() => handleDelete(budget.id)}
                              aria-label={`Delete ${budget.category_name} budget`}
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className={`text-lg font-bold tabular-nums ${textColor}`}>
                            {formatCurrency(budget.spent)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            / {formatCurrency(budget.amount)}
                          </span>
                        </div>
                        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={`h-full ${statusColor} transition-all duration-300`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                          <span>{percentage.toFixed(0)}% used</span>
                          <span>{formatCurrency(Math.max(budget.amount - budget.spent, 0))} remaining</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
