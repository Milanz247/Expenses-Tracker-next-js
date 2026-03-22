"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Cookies from "js-cookie"
import { toast } from "sonner"
import dynamic from "next/dynamic"
import {
  ArrowRightLeftIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  WalletIcon,
  PlusIcon,
  MinusIcon,
  HandCoinsIcon,
} from "lucide-react"

import { PageShell, PageShellSkeleton } from "@/components/page-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getMe,
  getAccounts,
  createTransaction,
  getCategories,
  getSummary,
  AuthError,
} from "@/lib/api"
import { usePreferences } from "@/lib/preferences"

const DashboardCharts = dynamic(() => import("./dashboard-charts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: number
  name: string
  email: string
}

interface Account {
  id: number
  name: string
  type: "wallet" | "bank" | "card"
  balance: number
}

interface Category {
  id: number
  name: string
  type: "income" | "expense" | "transfer"
}

interface RecentTx {
  id: number
  date: string
  account_name: string
  category: string
  description: string
  amount: number
  type: "income" | "expense" | "transfer"
}

interface Summary {
  total_balance: number
  monthly_income: number
  monthly_expenses: number
  expense_breakdown: { category: string; amount: number }[]
  recent_transactions: RecentTx[]
  weekly_spending: { day: string; amount: number }[]
  debt_to_pay: number
  debt_to_receive: number
}

// ─── Form schema ──────────────────────────────────────────────────────────────
const txSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
})

type TxFormData = z.infer<typeof txSchema>

// ─── Constants ────────────────────────────────────────────────────────────────
const TX_LABELS: Record<"income" | "expense" | "transfer", string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
}

const nativeSelectClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

const defaultSummary: Summary = {
  total_balance: 0,
  monthly_income: 0,
  monthly_expenses: 0,
  expense_breakdown: [],
  recent_transactions: [],
  weekly_spending: [],
  debt_to_pay: 0,
  debt_to_receive: 0,
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const { formatCurrency, currencySymbol } = usePreferences()
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [summary, setSummary] = useState<Summary>(defaultSummary)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState("")

  // Transaction dialog state
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense")
  const [fromAccountId, setFromAccountId] = useState<number>(0)
  const [toAccountId, setToAccountId] = useState<number>(0)

  const txForm = useForm<TxFormData>({
    resolver: zodResolver(txSchema) as Resolver<TxFormData>,
    defaultValues: {
      amount: 0,
      category: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    },
  })

  const fetchData = useCallback(async () => {
    try {
      // Core data — if this fails the page can't function
      const [meRes, accRes, catRes] = await Promise.all([
        getMe(),
        getAccounts(),
        getCategories(),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((meRes as any)?.user ?? null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAccounts((accRes as any)?.accounts ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCategories((catRes as any)?.categories ?? [])
      setFetchError("")
    } catch (err) {
      if (err instanceof AuthError) {
        Cookies.remove("token")
        router.push("/login")
      } else {
        setFetchError(err instanceof Error ? err.message : "Failed to load data")
      }
    } finally {
      setLoading(false)
    }

    // Summary is fetched independently so a backend restart doesn't
    // break the account/category dropdowns in the dialog
    try {
      const sumRes = await getSummary()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setSummary((sumRes as any) ?? defaultSummary)
    } catch {
      // leave defaultSummary in place — charts show empty state
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  function openDialog(type: "income" | "expense" | "transfer") {
    setTxType(type)
    setFromAccountId(0)
    setToAccountId(0)
    txForm.reset({
      amount: 0,
      category: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    })
    setAddTxOpen(true)
  }

  async function onAddTransaction(data: TxFormData) {
    if (!fromAccountId) { toast.error("Please select an account"); return }
    if (txType === "transfer") {
      if (!toAccountId) { toast.error("Please select a destination account"); return }
      if (fromAccountId === toAccountId) { toast.error("Source and destination must differ"); return }
    }
    try {
      await createTransaction({
        account_id: fromAccountId,
        to_account_id: txType === "transfer" ? toAccountId : undefined,
        amount: data.amount,
        type: txType,
        category: data.category,
        description: data.description,
        date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
      })
      toast.success("Transaction added!")
      setAddTxOpen(false)
      txForm.reset({ amount: 0, category: "", description: "", date: new Date().toISOString().split("T")[0] })
      setFromAccountId(0)
      setToAccountId(0)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add transaction")
    }
  }

  const hour = new Date().getHours()
  const greeting = hour >= 17 ? "evening" : hour >= 12 ? "afternoon" : "morning"

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShellSkeleton>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-48" />
      </PageShellSkeleton>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageShell user={user} title="Dashboard">
      {fetchError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{fetchError}</div>
          )}

          {/* Welcome + quick action buttons */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Good {greeting}, {user?.name?.split(" ")[0]} 👋
              </h1>
              <p className="text-sm text-muted-foreground">Here&apos;s your financial overview</p>
            </div>
            <div className="hidden sm:flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-600"
                onClick={() => openDialog("income")}
              >
                <PlusIcon className="size-3.5" />
                Income
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                onClick={() => openDialog("expense")}
              >
                <MinusIcon className="size-3.5" />
                Expense
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-blue-500/50 text-blue-500 hover:bg-blue-500/10 hover:text-blue-500"
                onClick={() => openDialog("transfer")}
              >
                <ArrowRightLeftIcon className="size-3.5" />
                Transfer
              </Button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="min-w-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                  <WalletIcon className="size-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${summary.total_balance < 0 ? "text-destructive" : ""}`}>
                  {formatCurrency(summary.total_balance)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Across all accounts</p>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Income</CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-green-500/10">
                  <TrendingUpIcon className="size-4 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-green-600">
                  +{formatCurrency(summary.monthly_income)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Expenses</CardTitle>
                <div className="flex size-9 items-center justify-center rounded-full bg-red-500/10">
                  <TrendingDownIcon className="size-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-red-500">
                  -{formatCurrency(summary.monthly_expenses)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Debt summary cards */}
          {(summary.debt_to_pay > 0 || summary.debt_to_receive > 0) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">To Pay</CardTitle>
                  <div className="flex size-9 items-center justify-center rounded-full bg-red-500/10">
                    <HandCoinsIcon className="size-4 text-red-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums text-red-500">
                    {formatCurrency(summary.debt_to_pay)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Outstanding borrowings</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">To Receive</CardTitle>
                  <div className="flex size-9 items-center justify-center rounded-full bg-green-500/10">
                    <HandCoinsIcon className="size-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums text-green-600">
                    {formatCurrency(summary.debt_to_receive)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Outstanding lendings</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts row */}
          <DashboardCharts
            expenseBreakdown={summary.expense_breakdown}
            weeklySpending={summary.weekly_spending}
            formatCurrency={formatCurrency}
            currencySymbol={currencySymbol}
          />

          {/* Recent Transactions */}
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">Last 5 transactions</p>
            </CardHeader>
            <CardContent className="p-0">
              {summary.recent_transactions.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                  No transactions yet
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Account</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Category</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.recent_transactions.map((tx) => (
                          <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                              {new Date(tx.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </td>
                            <td className="px-4 py-3 font-medium">{tx.account_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {tx.category || <span className="opacity-40">—</span>}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                              {tx.description || <span className="opacity-40">—</span>}
                            </td>
                            <td
                              className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${
                                tx.type === "income"
                                  ? "text-green-600"
                                  : tx.type === "expense"
                                  ? "text-red-500"
                                  : "text-blue-500"
                              }`}
                            >
                              {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile cards */}
                  <div className="flex flex-col gap-2.5 p-4 md:hidden">
                    {summary.recent_transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{tx.category || tx.account_name}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {new Date(tx.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          {tx.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.description}</p>
                          )}
                        </div>
                        <span
                          className={`ml-3 text-sm font-semibold tabular-nums shrink-0 ${
                            tx.type === "income"
                              ? "text-green-600"
                              : tx.type === "expense"
                              ? "text-red-500"
                              : "text-blue-500"
                          }`}
                        >
                          {tx.type === "income" ? "+" : tx.type === "expense" ? "−" : ""}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        {/* FAB for mobile — quick add transaction */}
        <button
          onClick={() => openDialog("expense")}
          className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform md:hidden"
          aria-label="Add transaction"
        >
          <PlusIcon className="size-6" />
        </button>

        {/* Transaction Dialog (controlled) */}
        <Dialog open={addTxOpen} onOpenChange={setAddTxOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={txForm.handleSubmit(onAddTransaction)} className="flex flex-col gap-4">
              {/* Type selector */}
              <div className="flex gap-1 rounded-lg border border-border p-1">
                {(["income", "expense", "transfer"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTxType(t)
                      setToAccountId(0)
                      txForm.setValue("category", "")
                    }}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                      txType === t
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {TX_LABELS[t]}
                  </button>
                ))}
              </div>

              {/* Account */}
              <div className="space-y-1.5">
                <Label>{txType === "transfer" ? "From Account" : "Account"}</Label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(Number(e.target.value))}
                  className={nativeSelectClass}
                >
                  <option value={0}>Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatCurrency(a.balance)}
                    </option>
                  ))}
                </select>
                {fromAccountId > 0 && (() => {
                  const sel = accounts.find((a) => a.id === fromAccountId)
                  return sel ? (
                    <p className="text-xs text-muted-foreground">Available Balance: <span className="font-semibold text-foreground">{formatCurrency(sel.balance)}</span></p>
                  ) : null
                })()}
              </div>

              {/* To Account (transfer only) */}
              {txType === "transfer" && (
                <div className="space-y-1.5">
                  <Label>To Account</Label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(Number(e.target.value))}
                    className={nativeSelectClass}
                  >
                    <option value={0}>Select account</option>
                    {accounts
                      .filter((a) => a.id !== fromAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} — {formatCurrency(a.balance)}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-amount">Amount</Label>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  {...txForm.register("amount")}
                />
                {txForm.formState.errors.amount && (
                  <p className="text-xs text-destructive">{txForm.formState.errors.amount.message}</p>
                )}
                {(() => {
                  const amt = txForm.watch("amount")
                  const sel = accounts.find((a) => a.id === fromAccountId)
                  if ((txType === "expense" || txType === "transfer") && sel && amt > sel.balance) {
                    return <p className="text-xs text-destructive">Insufficient balance (available: {formatCurrency(sel.balance)})</p>
                  }
                  return null
                })()}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-cat">Category</Label>
                <select id="tx-cat" {...txForm.register("category")} className={nativeSelectClass}>
                  <option value="">No category</option>
                  {categories
                    .filter((c) => c.type === txType)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-desc">Description</Label>
                <Input id="tx-desc" placeholder="Optional note" {...txForm.register("description")} />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-date">Date</Label>
                <Input id="tx-date" type="date" {...txForm.register("date")} />
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={txForm.formState.isSubmitting || (() => {
                  const amt = txForm.watch("amount")
                  const sel = accounts.find((a) => a.id === fromAccountId)
                  return (txType === "expense" || txType === "transfer") && !!sel && amt > sel.balance
                })()}
              >
                {txForm.formState.isSubmitting ? "Adding…" : "Add Transaction"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
    </PageShell>
  )
}
