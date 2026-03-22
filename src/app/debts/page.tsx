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
    HandCoinsIcon,
    LogOutIcon,
    Trash2Icon,
    CheckCircleIcon,
    LoaderIcon,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
    getMe,
    getAccounts,
    getDebts,
    createDebt,
    repayDebt,
    deleteDebt,
    getDebtSummary,
    AuthError,
} from "@/lib/api"
import { usePreferences } from "@/lib/preferences"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Account {
    id: number
    name: string
    type: string
    balance: number
}

interface Debt {
    id: number
    user_id: number
    account_id: number
    account_name: string
    person_name: string
    description: string
    amount: number
    paid_amount: number
    type: "LEND" | "BORROW"
    due_date: string | null
    status: "OPEN" | "CLOSED"
    created_at: string
}

interface DebtSummaryData {
    to_pay: number
    to_receive: number
}

// ─── Form schemas ─────────────────────────────────────────────────────────────
const debtSchema = z.object({
    account_id: z.coerce.number().positive("Account is required"),
    person_name: z.string().min(1, "Person name is required"),
    description: z.string().optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    type: z.enum(["LEND", "BORROW"]),
    due_date: z.string().optional(),
})

type DebtFormData = z.infer<typeof debtSchema>

const repaySchema = z.object({
    account_id: z.coerce.number().positive("Account is required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
})

type RepayFormData = z.infer<typeof repaySchema>

const nativeSelectClass =
    "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

// ─── Component ────────────────────────────────────────────────────────────────
export default function DebtsPage() {
    const router = useRouter()
    const [user, setUser] = useState<{ name: string; email: string } | null>(null)
    const { formatCurrency } = usePreferences()
    const [accounts, setAccounts] = useState<Account[]>([])
    const [debts, setDebts] = useState<Debt[]>([])
    const [summary, setSummary] = useState<DebtSummaryData>({ to_pay: 0, to_receive: 0 })
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<"BORROW" | "LEND">("BORROW")
    const [open, setOpen] = useState(false)
    const [repayOpen, setRepayOpen] = useState(false)
    const [repayingDebt, setRepayingDebt] = useState<Debt | null>(null)
    const [deletingId, setDeletingId] = useState<number | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null)
    const [now, setNow] = useState(new Date())

    const form = useForm<DebtFormData>({
        resolver: zodResolver(debtSchema) as Resolver<DebtFormData>,
        defaultValues: { account_id: 0, person_name: "", description: "", amount: 0, type: "BORROW", due_date: "" },
    })

    const repayForm = useForm<RepayFormData>({
        resolver: zodResolver(repaySchema) as Resolver<RepayFormData>,
        defaultValues: { account_id: 0, amount: 0 },
    })

    console.log("ACCOUNTS IN RENDER:", accounts)

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const [meRes, accRes, debtRes, summaryRes] = await Promise.all([
                getMe(),
                getAccounts(),
                getDebts(),
                getDebtSummary(),
            ])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setUser((meRes as any)?.user ?? null)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setAccounts((accRes as any)?.accounts ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setDebts((debtRes as any)?.debts ?? [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSummary((summaryRes as any) ?? { to_pay: 0, to_receive: 0 })
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
        form.reset({ account_id: 0, person_name: "", description: "", amount: 0, type: activeTab, due_date: "" })
        setOpen(true)
    }

    async function onSubmit(data: DebtFormData) {
        try {
            await createDebt({
                account_id: data.account_id,
                person_name: data.person_name,
                description: data.description,
                amount: data.amount,
                type: data.type,
                due_date: data.due_date || undefined,
            })
            toast.success(data.type === "LEND" ? "Lending recorded!" : "Borrowing recorded!")
            setOpen(false)
            form.reset()
            fetchData()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save debt")
        }
    }

    function openRepay(debt: Debt) {
        setRepayingDebt(debt)
        repayForm.reset({ account_id: debt.account_id, amount: 0 })
        setRepayOpen(true)
    }

    async function onRepay(data: RepayFormData) {
        if (!repayingDebt) return
        try {
            await repayDebt(repayingDebt.id, { account_id: data.account_id, amount: data.amount })
            toast.success("Repayment recorded!")
            setRepayOpen(false)
            setRepayingDebt(null)
            repayForm.reset()
            fetchData()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to record repayment")
        }
    }

    async function onDeleteDebt() {
        if (!deleteTarget) return
        setDeletingId(deleteTarget.id)
        try {
            await deleteDebt(deleteTarget.id)
            toast.success("Debt and all associated transactions deleted")
            setDebts((prev) => prev.filter((d) => d.id !== deleteTarget.id))
            setDeleteTarget(null)
            fetchData()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete debt")
        } finally {
            setDeletingId(null)
        }
    }

    const filteredDebts = debts.filter((d) => d.type === activeTab)
    const openDebts = filteredDebts.filter((d) => d.status === "OPEN")
    const closedDebts = filteredDebts.filter((d) => d.status === "CLOSED")

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
                                <BreadcrumbPage>Debts &amp; Lending</BreadcrumbPage>
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
                    {/* Summary cards */}
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
                                    {formatCurrency(summary.to_pay)}
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
                                    {formatCurrency(summary.to_receive)}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">Outstanding lendings</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tab bar + Add button */}
                    <div className="flex items-center justify-between">
                        <div className="flex gap-1 rounded-lg bg-muted p-1">
                            <button
                                onClick={() => setActiveTab("BORROW")}
                                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "BORROW"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                Money I Owe
                            </button>
                            <button
                                onClick={() => setActiveTab("LEND")}
                                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "LEND"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                Money Owed to Me
                            </button>
                        </div>

                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger render={<Button size="sm" className="gap-2" />}>
                                <PlusIcon className="size-4" />
                                Add {activeTab === "LEND" ? "Lending" : "Borrowing"}
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        New {form.watch("type") === "LEND" ? "Lending" : "Borrowing"}
                                    </DialogTitle>
                                </DialogHeader>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Type</Label>
                                        <select {...form.register("type")} className={nativeSelectClass}>
                                            <option value="BORROW">Borrow (I owe)</option>
                                            <option value="LEND">Lend (They owe me)</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="debt-person">Person Name</Label>
                                        <Input id="debt-person" placeholder="e.g. John" {...form.register("person_name")} autoFocus />
                                        {form.formState.errors.person_name && (
                                            <p className="text-xs text-destructive">{form.formState.errors.person_name.message}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="debt-amount">Amount</Label>
                                        <Input id="debt-amount" type="number" step="0.01" min="0.01" placeholder="0.00" {...form.register("amount")} />
                                        {form.formState.errors.amount && (
                                            <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                                        )}
                                        {(() => {
                                            const debtType = form.watch("type");
                                            const amt = form.watch("amount");
                                            const accId = form.watch("account_id");
                                            const sel = accounts.find((a) => a.id === Number(accId));
                                            if (debtType === "LEND" && sel && amt > sel.balance) {
                                                return <p className="text-xs text-destructive">Insufficient balance (available: {formatCurrency(sel.balance)})</p>;
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="debt-account">Account</Label>
                                        <select id="debt-account" {...form.register("account_id")} className={nativeSelectClass}>
                                            <option value={0}>Select account</option>
                                            {accounts.map((a) => (
                                                <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>
                                            ))}
                                        </select>
                                        {(() => {
                                            const accId = form.watch("account_id");
                                            const sel = accounts.find((a) => a.id === Number(accId));
                                            return sel ? (
                                                <p className="text-xs text-muted-foreground">Available Balance: <span className="font-semibold text-foreground">{formatCurrency(sel.balance)}</span></p>
                                            ) : null;
                                        })()}
                                        {form.formState.errors.account_id && (
                                            <p className="text-xs text-destructive">{form.formState.errors.account_id.message}</p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="debt-desc">Description (optional)</Label>
                                        <Input id="debt-desc" placeholder="Note..." {...form.register("description")} />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label htmlFor="debt-due">Due Date (optional)</Label>
                                        <Input id="debt-due" type="date" {...form.register("due_date")} />
                                    </div>

                                    <Button type="submit" disabled={form.formState.isSubmitting || (() => {
                                        const debtType = form.watch("type");
                                        const amt = form.watch("amount");
                                        const accId = form.watch("account_id");
                                        const sel = accounts.find((a) => a.id === Number(accId));
                                        return debtType === "LEND" && !!sel && amt > sel.balance;
                                    })()}>
                                        {form.formState.isSubmitting ? "Saving…" : "Save"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Repay dialog */}
                    <Dialog open={repayOpen} onOpenChange={setRepayOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    Record Repayment {repayingDebt ? `— ${repayingDebt.person_name}` : ""}
                                </DialogTitle>
                            </DialogHeader>
                            {repayingDebt && (
                                <div className="mb-2 text-sm text-muted-foreground">
                                    Remaining: <span className="font-semibold text-foreground">{formatCurrency(repayingDebt.amount - repayingDebt.paid_amount)}</span> of {formatCurrency(repayingDebt.amount)}
                                </div>
                            )}
                            <form onSubmit={repayForm.handleSubmit(onRepay)} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="repay-account">Account</Label>
                                    <select id="repay-account" {...repayForm.register("account_id")} className={nativeSelectClass}>
                                        <option value={0}>Select account</option>
                                        {accounts.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.balance)}</option>
                                        ))}
                                    </select>
                                    {(() => {
                                        const accId = repayForm.watch("account_id");
                                        const sel = accounts.find((a) => a.id === Number(accId));
                                        return sel ? (
                                            <p className="text-xs text-muted-foreground">Available Balance: <span className="font-semibold text-foreground">{formatCurrency(sel.balance)}</span></p>
                                        ) : null;
                                    })()}
                                    {repayForm.formState.errors.account_id && (
                                        <p className="text-xs text-destructive">{repayForm.formState.errors.account_id.message}</p>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="repay-amount">Repay Amount</Label>
                                    <Input
                                        id="repay-amount"
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={repayingDebt ? repayingDebt.amount - repayingDebt.paid_amount : undefined}
                                        placeholder="0.00"
                                        {...repayForm.register("amount")}
                                        autoFocus
                                    />
                                    {repayForm.formState.errors.amount && (
                                        <p className="text-xs text-destructive">{repayForm.formState.errors.amount.message}</p>
                                    )}
                                    {(() => {
                                        const amt = repayForm.watch("amount");
                                        const accId = repayForm.watch("account_id");
                                        const sel = accounts.find((a) => a.id === Number(accId));
                                        if (repayingDebt?.type === "BORROW" && sel && amt > sel.balance) {
                                            return <p className="text-xs text-destructive">Insufficient balance (available: {formatCurrency(sel.balance)})</p>;
                                        }
                                        return null;
                                    })()}
                                </div>

                                <Button type="submit" disabled={repayForm.formState.isSubmitting || (() => {
                                    const amt = repayForm.watch("amount");
                                    const accId = repayForm.watch("account_id");
                                    const sel = accounts.find((a) => a.id === Number(accId));
                                    return repayingDebt?.type === "BORROW" && !!sel && amt > sel.balance;
                                })()}>
                                    {repayForm.formState.isSubmitting ? "Processing…" : "Record Repayment"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>

                    {/* Debt list */}
                    {filteredDebts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
                            <HandCoinsIcon className="size-10 text-muted-foreground/40" />
                            <p className="text-sm font-medium">
                                {activeTab === "BORROW" ? "No borrowings" : "No lendings"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Click the button above to record a new {activeTab === "BORROW" ? "borrowing" : "lending"}.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Open debts */}
                            {openDebts.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
                                    {openDebts.map((debt) => {
                                        const percentage = debt.amount > 0 ? (debt.paid_amount / debt.amount) * 100 : 0
                                        const remaining = debt.amount - debt.paid_amount
                                        const isOverdue = debt.due_date && new Date(debt.due_date) < new Date()

                                        return (
                                            <div
                                                key={debt.id}
                                                className={`rounded-lg border p-4 transition-colors ${isOverdue
                                                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
                                                    : "bg-card"
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold">{debt.person_name}</span>
                                                            {isOverdue && (
                                                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                                                                    Overdue
                                                                </span>
                                                            )}
                                                        </div>
                                                        {debt.description && (
                                                            <p className="mt-0.5 text-xs text-muted-foreground">{debt.description}</p>
                                                        )}
                                                        <div className="mt-1 flex items-baseline gap-1">
                                                            <span className={`text-lg font-bold tabular-nums ${activeTab === "BORROW" ? "text-red-500" : "text-green-600"}`}>
                                                                {formatCurrency(remaining)}
                                                            </span>
                                                            <span className="text-sm text-muted-foreground">remaining of {formatCurrency(debt.amount)}</span>
                                                        </div>
                                                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                                            <span>Account: {debt.account_name}</span>
                                                            {debt.due_date && (
                                                                <span>Due: {new Date(debt.due_date).toLocaleDateString()}</span>
                                                            )}
                                                        </div>
                                                        {/* Progress bar */}
                                                        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                                                            <div
                                                                className={`h-full transition-all duration-300 ${activeTab === "BORROW" ? "bg-red-500" : "bg-green-500"
                                                                    }`}
                                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                                            />
                                                        </div>
                                                        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                                                            <span>{percentage.toFixed(0)}% repaid</span>
                                                            <span>{formatCurrency(debt.paid_amount)} paid</span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-3 flex flex-col gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1.5 text-xs"
                                                            onClick={() => openRepay(debt)}
                                                        >
                                                            <CheckCircleIcon className="size-3.5" />
                                                            Repay
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-7 text-muted-foreground hover:text-destructive"
                                                            disabled={deletingId === debt.id}
                                                            onClick={() => setDeleteTarget(debt)}
                                                            aria-label={`Delete debt for ${debt.person_name}`}
                                                        >
                                                            <Trash2Icon className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Closed debts */}
                            {closedDebts.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Settled</h2>
                                    {closedDebts.map((debt) => (
                                        <div
                                            key={debt.id}
                                            className="rounded-lg border bg-muted/30 p-4 opacity-70"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold">{debt.person_name}</span>
                                                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/50 dark:text-green-300">
                                                            Settled
                                                        </span>
                                                    </div>
                                                    {debt.description && (
                                                        <p className="mt-0.5 text-xs text-muted-foreground">{debt.description}</p>
                                                    )}
                                                    <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                                                        {formatCurrency(debt.amount)} — fully repaid
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7 text-muted-foreground hover:text-destructive"
                                                    disabled={deletingId === debt.id}
                                                    onClick={() => setDeleteTarget(debt)}
                                                    aria-label={`Delete debt for ${debt.person_name}`}
                                                >
                                                    <Trash2Icon className="size-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </SidebarInset>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Debt</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget && deleteTarget.paid_amount > 0
                                ? `Warning: This debt has ${deleteTarget.paid_amount > 0 ? "repayment history" : ""}. Deleting it will permanently remove the debt, all repayment transactions, and the original transaction, and will reverse all balance changes. This cannot be undone.`
                                : "This will permanently delete the debt and its initial transaction, reversing the balance change. This cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={deletingId !== null}
                            onClick={onDeleteDebt}
                        >
                            {deletingId !== null ? <><LoaderIcon className="size-4 animate-spin" /> Deleting…</> : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SidebarProvider>
    )
}
