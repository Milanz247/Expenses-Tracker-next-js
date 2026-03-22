"use client"

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const DONUT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6",
]

interface DashboardChartsProps {
  expenseBreakdown: { category: string; amount: number }[]
  weeklySpending: { day: string; amount: number }[]
  formatCurrency: (v: number) => string
  currencySymbol: string
}

export default function DashboardCharts({
  expenseBreakdown,
  weeklySpending,
  formatCurrency,
  currencySymbol,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Donut – Expense Breakdown */}
      <Card className="min-w-0 overflow-hidden pt-2">
        <CardHeader>
          <CardTitle className="text-base">Expense Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Current month by category</p>
        </CardHeader>
        <CardContent>
          {expenseBreakdown.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
              No expenses recorded this month
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="amount"
                    nameKey="category"
                    paddingAngle={2}
                  >
                    {expenseBreakdown.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex w-full flex-wrap justify-center gap-x-4 gap-y-1.5">
                {expenseBreakdown.map((item, i) => (
                  <div key={item.category} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{item.category || "Uncategorized"}</span>
                    <span className="font-medium">{currencySymbol}{item.amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bar – Weekly Spending */}
      <Card className="min-w-0 overflow-hidden pt-2">
        <CardHeader>
          <CardTitle className="text-base">Weekly Spending</CardTitle>
          <p className="text-xs text-muted-foreground">Expenses over the last 7 days</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={weeklySpending} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <RechartsTip
                formatter={(v: number) => [formatCurrency(v), "Spent"]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              />
              <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
