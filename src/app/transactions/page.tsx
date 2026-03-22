"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Cookies from "js-cookie"
import { toast } from "sonner"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightLeftIcon,
  SearchIcon,
  XIcon,
  PlusIcon,
  Trash2Icon,
  LoaderIcon,
} from "lucide-react"

import { PageShell, PageShellSkeleton } from "@/components/page-shell"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getMe, getAccounts, getTransactions, createTransaction, deleteTransaction, getCategories, AuthError } from "@/lib/api"
import { usePreferences } from "@/lib/preferences"

interface Account {
  id: number
  name: string
  type: "wallet" | "bank" | "card"
  balance: number
}

interface Transaction {
  id: number
  account_id: number
  account_name: string
  to_account_id?: number
  amount: number
  type: "income" | "expense" | "transfer"
  category: string
  description: string
  date: string
}

interface Category {
  id: number
  name: string
  type: "income" | "expense" | "transfer"
}

const txSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
})

type TxFormData = z.infer<typeof txSchema>

const TX_LABELS: Record<"income" | "expense" | "transfer", string> = {
  income: "📈 Income",
  expense: "📉 Expense",
  transfer: "🔄 Transfer",
}

const nativeSelectClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

const TYPE_CONFIG = {
  income: {
    label: "Income",
    icon: TrendingUpIcon,
    color: "text-green-600",
    bg: "bg-green-500/10",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  expense: {
    label: "Expense",
    icon: TrendingDownIcon,
    color: "text-red-500",
    bg: "bg-red-500/10",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  transfer: {
    label: "Transfer",
    icon: ArrowRightLeftIcon,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
} as const

export default function TransactionsPage() {
  const router = useRouter()
  const { formatCurrency } = usePreferences()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // New Transaction dialog
  const [addTxOpen, setAddTxOpen] = useState(false)
  const [txType, setTxType] = useState<"income" | "expense" | "transfer">("expense")
  const [fromAccountId, setFromAccountId] = useState<number>(0)
  const [toAccountId, setToAccountId] = useState<number>(0)
  const [categories, setCategories] = useState<Category[]>([])

  const txForm = useForm<TxFormData>({
    resolver: zodResolver(txSchema) as Resolver<TxFormData>,
    defaultValues: {
      amount: 0,
      category: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    },
  })

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filters
  const [filterType, setFilterType] = useState("")
  const [filterAccount, setFilterAccount] = useState("")
  const [filterCategory, setFilterCategory] = useState("")
  const [filterStart, setFilterStart] = useState("")
  const [filterEnd, setFilterEnd] = useState("")

  useEffect(() => {
    getCategories()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res) => setCategories((res as any)?.categories ?? []))
      .catch(() => {})
  }, [])

  const fetchData = useCallback(async (filters?: {
    type?: string
    account_id?: number
    category?: string
    start_date?: string
    end_date?: string
  }) => {
    try {
      const [meRes, accRes, txRes] = await Promise.all([
        getMe(),
        getAccounts(),
        getTransactions(filters),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((meRes as any)?.user ?? null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAccounts((accRes as any)?.accounts ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTransactions((txRes as any)?.transactions ?? [])
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

  function applyFilters() {
    fetchData({
      type: filterType || undefined,
      account_id: filterAccount ? Number(filterAccount) : undefined,
      category: filterCategory || undefined,
      start_date: filterStart || undefined,
      end_date: filterEnd || undefined,
    })
  }

  function clearFilters() {
    setFilterType("")
    setFilterAccount("")
    setFilterCategory("")
    setFilterStart("")
    setFilterEnd("")
    fetchData()
  }

  async function onAddTransaction(data: TxFormData) {
    if (!fromAccountId) {
      toast.error("Please select an account")
      return
    }
    if (txType === "transfer") {
      if (!toAccountId) {
        toast.error("Please select a destination account")
        return
      }
      if (fromAccountId === toAccountId) {
        toast.error("Source and destination accounts must be different")
        return
      }
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
      txForm.reset({
        amount: 0,
        category: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
      })
      setFromAccountId(0)
      setToAccountId(0)
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add transaction")
    }
  }

  async function onDeleteTransaction() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTransaction(deleteTarget.id)
      if (deleteTarget.category === "Lending" || deleteTarget.category === "Borrowing") {
        toast.success("Debt record, all repayment history, and transaction deleted. Balances reversed.")
      } else if (deleteTarget.category === "Debt Repayment") {
        toast.success("Repayment deleted. Debt status updated and balance reversed.")
      } else {
        toast.success("Transaction deleted and balance updated!")
      }
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete transaction"
      if (msg.toLowerCase().includes("funds") || msg.toLowerCase().includes("negative") || msg.toLowerCase().includes("cannot delete")) {
        toast.error("Action Denied", {
          description: msg,
          duration: 6000,
        })
      } else {
        toast.error(msg)
      }
    } finally {
      setDeleting(false)
    }
  }

  const hasFilters = filterType || filterAccount || filterCategory || filterStart || filterEnd

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += t.amount
      else if (t.type === "expense") acc.expense += t.amount
      return acc
    },
    { income: 0, expense: 0 }
  )

  if (loading) {
    return (
      <PageShellSkeleton>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageShellSkeleton>
    )
  }

  return (
    <PageShell user={user} title="Transactions">
      {/* Page title + summary + action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
              <p className="text-sm text-muted-foreground">
                {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
                {hasFilters ? " (filtered)" : ""}
                {transactions.length > 0 && (
                  <span>
                    {" "}— <span className="text-green-600">+{formatCurrency(totals.income)}</span>{" "}
                    <span className="text-red-500">-{formatCurrency(totals.expense)}</span>
                  </span>
                )}
              </p>
            </div>

            {/* New Transaction Dialog */}
            <Dialog open={addTxOpen} onOpenChange={setAddTxOpen}>
              <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
                <PlusIcon className="size-4" />
                New Transaction
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>New Transaction</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={txForm.handleSubmit(onAddTransaction)}
                  className="flex flex-col gap-4"
                >
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

                  {/* From / Account */}
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
                      const sel = accounts.find((a) => a.id === fromAccountId);
                      return sel ? (
                        <p className="text-xs text-muted-foreground">Available Balance: <span className="font-semibold text-foreground">{formatCurrency(sel.balance)}</span></p>
                      ) : null;
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
                              {a.name}
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
                      <p className="text-xs text-destructive">
                        {txForm.formState.errors.amount.message}
                      </p>
                    )}
                    {(() => {
                      const amt = txForm.watch("amount");
                      const sel = accounts.find((a) => a.id === fromAccountId);
                      if ((txType === "expense" || txType === "transfer") && sel && amt > sel.balance) {
                        return <p className="text-xs text-destructive">Insufficient balance (available: {formatCurrency(sel.balance)})</p>;
                      }
                      return null;
                    })()}
                  </div>

                  {/* Category dropdown */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-category">Category</Label>
                    <select
                      id="tx-category"
                      {...txForm.register("category")}
                      className={nativeSelectClass}
                    >
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
                    <Input
                      id="tx-desc"
                      placeholder="Optional note"
                      {...txForm.register("description")}
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tx-date">Date</Label>
                    <Input
                      id="tx-date"
                      type="date"
                      {...txForm.register("date")}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={txForm.formState.isSubmitting || (() => {
                      const amt = txForm.watch("amount");
                      const sel = accounts.find((a) => a.id === fromAccountId);
                      return (txType === "expense" || txType === "transfer") && !!sel && amt > sel.balance;
                    })()}
                  >
                    {txForm.formState.isSubmitting ? "Adding…" : "Add Transaction"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Type */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
              </select>

              {/* Account */}
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option key="all" value="">All Accounts</option>
                {accounts.map((a) => (
                  <option key={`account-${a.id}`} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              {/* Category search */}
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Category…"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  className="pl-8"
                />
              </div>

              {/* Date range */}
              <Input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                title="From date"
              />
              <Input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                title="To date"
              />
            </div>

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={applyFilters} className="gap-1.5">
                <SearchIcon className="size-3.5" />
                Apply Filters
              </Button>
              {hasFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                  <XIcon className="size-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Table / Cards */}
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <ArrowRightLeftIcon className="size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs text-muted-foreground">
                {hasFilters ? "Try adjusting your filters." : "Add your first transaction using the button above."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-hidden rounded-lg border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                        <th className="w-12 px-4 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, i) => {
                        const cfg = TYPE_CONFIG[tx.type]
                        const Icon = cfg.icon
                        return (
                          <tr
                            key={tx.id}
                            className={`border-b border-border last:border-0 transition-colors hover:bg-muted/30 ${
                              i % 2 === 0 ? "" : "bg-muted/10"
                            }`}
                          >
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                              {new Date(tx.date).toLocaleDateString([], {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}
                              >
                                <Icon className="size-3" />
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium">{tx.account_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {tx.category || <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                              {tx.description || <span className="text-muted-foreground/40">—</span>}
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
                              {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{formatCurrency(tx.amount)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(tx)}
                              >
                                <Trash2Icon className="size-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col gap-2.5 md:hidden">
                {transactions.map((tx) => {
                  const cfg = TYPE_CONFIG[tx.type]
                  const Icon = cfg.icon
                  return (
                    <div
                      key={tx.id}
                      className="rounded-lg border border-border bg-card p-4 active:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.badge}`}
                            >
                              <Icon className="size-3" />
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {new Date(tx.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium truncate">{tx.account_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {tx.category && <span>{tx.category}</span>}
                            {tx.category && tx.description && <span>·</span>}
                            {tx.description && <span className="truncate">{tx.description}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              tx.type === "income"
                                ? "text-green-600"
                                : tx.type === "expense"
                                ? "text-red-500"
                                : "text-blue-500"
                            }`}
                          >
                            {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}{formatCurrency(tx.amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(tx)}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}


        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.category === "Lending" || deleteTarget?.category === "Borrowing"
                  ? "Warning: This is the initial record for a debt. Deleting this will permanently remove the entire debt record and all payment history. Are you sure?"
                  : deleteTarget?.category === "Debt Repayment"
                  ? "Deleting this repayment will reopen the debt as unsettled and adjust your account balance. Continue?"
                  : "Are you sure? This will delete the transaction and reverse its impact on your account balance."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleting}
                onClick={onDeleteTransaction}
              >
                {deleting ? <><LoaderIcon className="size-4 animate-spin" /> Deleting…</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </PageShell>
  )
}
