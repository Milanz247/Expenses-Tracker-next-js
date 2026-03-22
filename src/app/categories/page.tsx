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
  TagIcon,
  LogOutIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightLeftIcon,
  Trash2Icon,
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
import { getMe, getCategories, createCategory, deleteCategory, AuthError } from "@/lib/api"

interface Category {
  id: number
  name: string
  type: "income" | "expense" | "transfer"
}

const TYPE_CONFIG = {
  income: {
    label: "Income",
    icon: TrendingUpIcon,
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  expense: {
    label: "Expense",
    icon: TrendingDownIcon,
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  transfer: {
    label: "Transfer",
    icon: ArrowRightLeftIcon,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
} as const

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
  type: z.enum(["income", "expense", "transfer"]),
})

type CategoryFormData = z.infer<typeof categorySchema>

export default function CategoriesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [now, setNow] = useState(new Date())

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema) as Resolver<CategoryFormData>,
    defaultValues: { name: "", type: "expense" },
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [meRes, catRes] = await Promise.all([getMe(), getCategories()])
      setUser(meRes.user)
      setCategories(catRes.categories ?? [])
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

  async function onSubmit(data: CategoryFormData) {
    try {
      await createCategory({ name: data.name, type: data.type })
      toast.success("Category added!")
      setOpen(false)
      form.reset({ name: "", type: "expense" })
      fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create category")
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    try {
      await deleteCategory(id)
      toast.success("Category deleted")
      setCategories((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category")
    } finally {
      setDeletingId(null)
    }
  }

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

  // Group by type for display
  const grouped = (["income", "expense", "transfer"] as const).map((type) => ({
    type,
    items: categories.filter((c) => c.type === type),
  }))

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
                <BreadcrumbPage>Categories</BreadcrumbPage>
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
              <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
              <p className="text-sm text-muted-foreground">
                Organise your transactions with custom categories
              </p>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" className="gap-2" />}>
                <PlusIcon className="size-4" />
                Add Category
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Category</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cat-name">Name</Label>
                    <Input
                      id="cat-name"
                      placeholder="e.g. Groceries"
                      {...form.register("name")}
                      autoFocus
                    />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cat-type">Type</Label>
                    <select
                      id="cat-type"
                      {...form.register("type")}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </div>

                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Adding…" : "Add Category"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Category sections */}
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
              <TagIcon className="size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">No categories yet</p>
              <p className="text-xs text-muted-foreground">Click "Add Category" to get started.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.map(({ type, items }) => {
                if (items.length === 0) return null
                const cfg = TYPE_CONFIG[type]
                const Icon = cfg.icon
                return (
                  <div key={type}>
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.badge}`}
                      >
                        <Icon className="size-3" />
                        {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? "category" : "categories"}</span>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <tbody>
                          {items.map((cat) => (
                            <tr
                              key={`${type}-${cat.id}`}
                              className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 font-medium">{cat.name}</td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  disabled={deletingId === cat.id}
                                  onClick={() => handleDelete(cat.id)}
                                  aria-label={`Delete ${cat.name}`}
                                >
                                  <Trash2Icon className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
