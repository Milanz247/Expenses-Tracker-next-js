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
  WalletIcon,
  BanknoteIcon,
  CreditCardIcon,
} from "lucide-react"

import { PageShell, PageShellSkeleton } from "@/components/page-shell"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { getMe, getAccounts, createAccount, AuthError } from "@/lib/api"
import { usePreferences } from "@/lib/preferences"

interface Account {
  id: number
  name: string
  type: "wallet" | "bank" | "card"
  balance: number
}

const ACCOUNT_TYPE_CONFIG = {
  wallet: { Icon: WalletIcon, label: "Wallet", color: "text-blue-500 bg-blue-500/10" },
  bank: { Icon: BanknoteIcon, label: "Bank Account", color: "text-green-500 bg-green-500/10" },
  card: { Icon: CreditCardIcon, label: "Card", color: "text-purple-500 bg-purple-500/10" },
} as const

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  balance: z.coerce.number().min(0, "Balance must be 0 or more"),
})

type AccountFormData = z.infer<typeof accountSchema>

export default function AccountsPage() {
  const router = useRouter()
  const { formatCurrency } = usePreferences()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState("")
  const [addAccOpen, setAddAccOpen] = useState(false)
  const [accountType, setAccountType] = useState<"wallet" | "bank" | "card">("wallet")

  const accountForm = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema) as Resolver<AccountFormData>,
    defaultValues: { name: "", balance: 0 },
  })

  const fetchData = useCallback(async () => {
    try {
      const [meRes, accRes] = await Promise.all([getMe(), getAccounts()])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((meRes as any)?.user ?? null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setAccounts((accRes as any)?.accounts ?? [])
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
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function onAddAccount(data: AccountFormData) {
    try {
      await createAccount({ name: data.name, type: accountType, balance: data.balance })
      toast.success("Account created!")
      setAddAccOpen(false)
      accountForm.reset()
      setAccountType("wallet")
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account")
    }
  }

  if (loading) {
    return (
      <PageShellSkeleton>
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </PageShellSkeleton>
    )
  }

  return (
    <PageShell user={user} title="Accounts">
      {fetchError && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fetchError}
            </div>
          )}

          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your wallets, bank accounts, and cards
                </p>
              </div>
              <Dialog open={addAccOpen} onOpenChange={setAddAccOpen}>
                <DialogTrigger render={<Button className="gap-2" />}>
                  <PlusIcon className="size-4" />
                  Add Account
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Account</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={accountForm.handleSubmit(onAddAccount)}
                    className="flex flex-col gap-4"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="acc-name">Account Name</Label>
                      <Input
                        id="acc-name"
                        placeholder="e.g. My Wallet"
                        {...accountForm.register("name")}
                      />
                      {accountForm.formState.errors.name && (
                        <p className="text-xs text-destructive">
                          {accountForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <div className="flex gap-2">
                        {(["wallet", "bank", "card"] as const).map((t) => {
                          const { Icon, label } = ACCOUNT_TYPE_CONFIG[t]
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setAccountType(t)}
                              className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-3 text-xs font-medium transition-colors ${
                                accountType === t
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border text-muted-foreground hover:border-muted-foreground/40"
                              }`}
                            >
                              <Icon className="size-5" />
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="acc-balance">Initial Balance</Label>
                      <Input
                        id="acc-balance"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...accountForm.register("balance")}
                      />
                      {accountForm.formState.errors.balance && (
                        <p className="text-xs text-destructive">
                          {accountForm.formState.errors.balance.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={accountForm.formState.isSubmitting}
                    >
                      {accountForm.formState.isSubmitting ? "Creating…" : "Create Account"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {accounts.length === 0 ? (
            <Card>
              <CardContent>
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                    <WalletIcon className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No accounts yet</p>
                  <p className="text-xs text-muted-foreground">
                    Click &ldquo;Add Account&rdquo; to get started.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const cfg = ACCOUNT_TYPE_CONFIG[account.type] ?? ACCOUNT_TYPE_CONFIG.wallet
                const { Icon, label, color } = cfg
                return (
                  <Card key={`account-${account.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div>
                        <CardTitle className="text-base">{account.name}</CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
                      </div>
                      <div
                        className={`flex size-9 items-center justify-center rounded-lg ${color}`}
                      >
                        <Icon className="size-4" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-2xl font-bold tabular-nums ${
                          account.balance < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {formatCurrency(account.balance)}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
    </PageShell>
  )
}
