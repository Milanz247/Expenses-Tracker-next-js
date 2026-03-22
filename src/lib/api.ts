import Cookies from "js-cookie";

const API_URL = "http://localhost:8081";

export class AuthError extends Error {
  constructor(message = "Session expired. Please log in again.") {
    super(message);
    this.name = "AuthError";
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = Cookies.get("token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data: Record<string, string> | null = null;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (text) throw new Error(text);
  }

  if (res.status === 401 || res.status === 403) {
    throw new AuthError(data.error || "Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}

// Auth
export async function register(name: string, email: string, password: string) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function login(email: string, password: string) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return request("/api/me");
}

// Accounts
export async function getAccounts() {
  return request("/api/accounts");
}

export async function createAccount(data: {
  name: string;
  type: "wallet" | "bank" | "card";
  balance: number;
}) {
  return request("/api/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Transactions
export async function createTransaction(data: {
  account_id: number;
  to_account_id?: number;
  amount: number;
  type: "income" | "expense" | "transfer";
  category?: string;
  description?: string;
  date?: string;
}) {
  return request("/api/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTransactions(params?: {
  type?: string;
  account_id?: number;
  category?: string;
  start_date?: string;
  end_date?: string;
}) {
  const qs = params
    ? "?" + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : "";
  return request(`/api/transactions${qs}`);
}

export async function deleteTransaction(id: number) {
  return request(`/api/transactions/${id}`, { method: "DELETE" });
}

// Categories
export async function getCategories() {
  return request("/api/categories");
}

export async function createCategory(data: { name: string; type: "income" | "expense" | "transfer" }) {
  return request("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(id: number) {
  return request(`/api/categories/${id}`, { method: "DELETE" });
}

// Budgets
export async function createBudget(data: {
  category_id: number;
  amount: number;
  month: number;
  year: number;
}) {
  return request("/api/budgets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getBudgets(params?: { month?: number; year?: number }) {
  const qs = params
    ? "?" + new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : "";
  return request(`/api/budgets${qs}`);
}

export async function deleteBudget(id: number) {
  return request(`/api/budgets/${id}`, { method: "DELETE" });
}

// Summary
export async function getSummary() {
  return request("/api/summary");
}

// Debts
export async function createDebt(data: {
  account_id: number;
  person_name: string;
  description?: string;
  amount: number;
  type: "LEND" | "BORROW";
  due_date?: string;
}) {
  return request("/api/debts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getDebts(params?: { type?: string; status?: string }) {
  const qs = params
    ? "?" +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)])
        )
      ).toString()
    : "";
  return request(`/api/debts${qs}`);
}

export async function repayDebt(id: number, data: { account_id: number; amount: number }) {
  return request(`/api/debts/${id}/repay`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getDebtSummary() {
  return request("/api/debts/summary");
}

export async function deleteDebt(id: number) {
  return request(`/api/debts/${id}`, { method: "DELETE" });
}

// User Profile & Preferences
export async function updateProfile(data: {
  name: string;
  email: string;
  profile_pic?: string;
}) {
  return request("/api/user/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function changePassword(data: {
  old_password: string;
  new_password: string;
}) {
  return request("/api/user/password", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updatePreferences(data: {
  currency: string;
  language: string;
}) {
  return request("/api/user/preferences", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

