"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import Cookies from "js-cookie"
import { getMe } from "@/lib/api"

const CURRENCY_MAP: Record<string, { symbol: string; code: string }> = {
  LKR: { symbol: "රු.", code: "LKR" },
  USD: { symbol: "$", code: "USD" },
  EUR: { symbol: "€", code: "EUR" },
}

interface PreferencesContextValue {
  currency: string
  language: string
  currencySymbol: string
  setCurrency: (c: string) => void
  setLanguage: (l: string) => void
  formatCurrency: (amount: number) => string
}

const PreferencesContext = createContext<PreferencesContextValue>({
  currency: "LKR",
  language: "English",
  currencySymbol: "රු.",
  setCurrency: () => {},
  setLanguage: () => {},
  formatCurrency: (n) => `රු.${n.toFixed(2)}`,
})

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState("LKR")
  const [language, setLanguageState] = useState("English")

  useEffect(() => {
    const token = Cookies.get("token")
    if (!token) return
    getMe()
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = (res as any)?.user
        if (user?.currency) setCurrencyState(user.currency)
        if (user?.language) setLanguageState(user.language)
      })
      .catch(() => {})
  }, [])

  const setCurrency = useCallback((c: string) => setCurrencyState(c), [])
  const setLanguage = useCallback((l: string) => setLanguageState(l), [])

  const currencySymbol = CURRENCY_MAP[currency]?.symbol ?? currency
  const formatCurrency = useCallback(
    (amount: number) => `${CURRENCY_MAP[currency]?.symbol ?? currency}${amount.toFixed(2)}`,
    [currency]
  )

  const value = useMemo(
    () => ({ currency, language, currencySymbol, setCurrency, setLanguage, formatCurrency }),
    [currency, language, currencySymbol, setCurrency, setLanguage, formatCurrency]
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  return useContext(PreferencesContext)
}
