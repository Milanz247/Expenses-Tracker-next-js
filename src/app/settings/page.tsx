"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Cookies from "js-cookie"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import {
  LogOutIcon,
  UserIcon,
  ShieldIcon,
  SettingsIcon,
  SunIcon,
  MoonIcon,
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
  getMe,
  updateProfile,
  changePassword,
  updatePreferences,
  AuthError,
} from "@/lib/api"
import { usePreferences } from "@/lib/preferences"

// ─── Form schemas ─────────────────────────────────────────────────────────────
const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  profile_pic: z.string().optional(),
})
type ProfileFormData = z.infer<typeof profileSchema>

const passwordSchema = z
  .object({
    old_password: z.string().min(6, "Must be at least 6 characters"),
    new_password: z.string().min(6, "Must be at least 6 characters"),
    confirm_password: z.string().min(6, "Must be at least 6 characters"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })
type PasswordFormData = z.infer<typeof passwordSchema>

const nativeSelectClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { currency, language, setCurrency, setLanguage } = usePreferences()
  const [user, setUser] = useState<{ name: string; email: string; profile_pic?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [activeTab, setActiveTab] = useState<"profile" | "preferences">("profile")

  // Preferences local state (synced with context)
  const [prefCurrency, setPrefCurrency] = useState(currency)
  const [prefLanguage, setPrefLanguage] = useState(language)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormData>,
    defaultValues: { name: "", email: "", profile_pic: "" },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema) as Resolver<PasswordFormData>,
    defaultValues: { old_password: "", new_password: "", confirm_password: "" },
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setPrefCurrency(currency)
    setPrefLanguage(language)
  }, [currency, language])

  const fetchUser = useCallback(async () => {
    try {
      const res = await getMe()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = (res as any)?.user
      if (u) {
        setUser(u)
        profileForm.reset({
          name: u.name ?? "",
          email: u.email ?? "",
          profile_pic: u.profile_pic ?? "",
        })
        if (u.currency) setPrefCurrency(u.currency)
        if (u.language) setPrefLanguage(u.language)
      }
    } catch (err) {
      if (err instanceof AuthError) {
        Cookies.remove("token")
        router.push("/login")
      }
    } finally {
      setLoading(false)
    }
  }, [router, profileForm])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  async function onUpdateProfile(data: ProfileFormData) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = (await updateProfile(data)) as any
      setUser(res?.user ?? null)
      toast.success("Profile updated successfully!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile")
    }
  }

  async function onChangePassword(data: PasswordFormData) {
    try {
      await changePassword({
        old_password: data.old_password,
        new_password: data.new_password,
      })
      toast.success("Password changed! Please log in again.")
      passwordForm.reset()
      // Logout for security
      Cookies.remove("token")
      router.push("/login")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password")
    }
  }

  async function onSavePreferences() {
    setSavingPrefs(true)
    try {
      await updatePreferences({ currency: prefCurrency, language: prefLanguage })
      setCurrency(prefCurrency)
      setLanguage(prefLanguage)
      toast.success("Preferences updated!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update preferences")
    } finally {
      setSavingPrefs(false)
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar user={{ name: "", email: "", avatar: "" }} />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-6">
            <Skeleton className="h-8 w-48" />
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
                <BreadcrumbPage>Settings</BreadcrumbPage>
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
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

          {/* Tab bar */}
          <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "profile"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserIcon className="size-4" />
              Profile & Security
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === "preferences"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SettingsIcon className="size-4" />
              Preferences
            </button>
          </div>

          {/* ─── Profile & Security Tab ────────────────────────────────── */}
          {activeTab === "profile" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Update Profile */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserIcon className="size-4" />
                    Update Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={profileForm.handleSubmit(onUpdateProfile)}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="profile-name">Name</Label>
                      <Input
                        id="profile-name"
                        placeholder="Your name"
                        {...profileForm.register("name")}
                      />
                      {profileForm.formState.errors.name && (
                        <p className="text-xs text-destructive">
                          {profileForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="profile-email">Email</Label>
                      <Input
                        id="profile-email"
                        type="email"
                        placeholder="you@example.com"
                        {...profileForm.register("email")}
                      />
                      {profileForm.formState.errors.email && (
                        <p className="text-xs text-destructive">
                          {profileForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="profile-pic">Profile Picture URL</Label>
                      <Input
                        id="profile-pic"
                        placeholder="https://example.com/avatar.jpg"
                        {...profileForm.register("profile_pic")}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={profileForm.formState.isSubmitting}
                    >
                      {profileForm.formState.isSubmitting ? "Saving…" : "Save Profile"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldIcon className="size-4" />
                    Change Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={passwordForm.handleSubmit(onChangePassword)}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pw-old">Current Password</Label>
                      <Input
                        id="pw-old"
                        type="password"
                        placeholder="••••••"
                        {...passwordForm.register("old_password")}
                      />
                      {passwordForm.formState.errors.old_password && (
                        <p className="text-xs text-destructive">
                          {passwordForm.formState.errors.old_password.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pw-new">New Password</Label>
                      <Input
                        id="pw-new"
                        type="password"
                        placeholder="••••••"
                        {...passwordForm.register("new_password")}
                      />
                      {passwordForm.formState.errors.new_password && (
                        <p className="text-xs text-destructive">
                          {passwordForm.formState.errors.new_password.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="pw-confirm">Confirm New Password</Label>
                      <Input
                        id="pw-confirm"
                        type="password"
                        placeholder="••••••"
                        {...passwordForm.register("confirm_password")}
                      />
                      {passwordForm.formState.errors.confirm_password && (
                        <p className="text-xs text-destructive">
                          {passwordForm.formState.errors.confirm_password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      disabled={passwordForm.formState.isSubmitting}
                    >
                      {passwordForm.formState.isSubmitting ? "Changing…" : "Change Password"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You will be logged out after changing your password.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── Preferences Tab ───────────────────────────────────────── */}
          {activeTab === "preferences" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Currency & Language */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">System Preferences</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pref-currency">Currency</Label>
                    <select
                      id="pref-currency"
                      value={prefCurrency}
                      onChange={(e) => setPrefCurrency(e.target.value)}
                      className={nativeSelectClass}
                    >
                      <option value="LKR">LKR (රු.)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="pref-language">Language</Label>
                    <select
                      id="pref-language"
                      value={prefLanguage}
                      onChange={(e) => setPrefLanguage(e.target.value)}
                      className={nativeSelectClass}
                    >
                      <option value="English">English</option>
                      <option value="Sinhala">Sinhala</option>
                    </select>
                  </div>

                  <Button
                    onClick={onSavePreferences}
                    className="w-full"
                    disabled={savingPrefs}
                  >
                    {savingPrefs ? "Saving…" : "Save Preferences"}
                  </Button>
                </CardContent>
              </Card>

              {/* Theme */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Appearance</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred theme for the application.
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      className="flex-1 gap-2"
                      onClick={() => setTheme("light")}
                    >
                      <SunIcon className="size-4" />
                      Light
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      className="flex-1 gap-2"
                      onClick={() => setTheme("dark")}
                    >
                      <MoonIcon className="size-4" />
                      Dark
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setTheme("system")}
                    >
                      System
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
