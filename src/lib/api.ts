import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081";

export class AuthError extends Error {
  constructor(message = "Session expired. Please log in again.") {
    super(message);
    this.name = "AuthError";
  }
}

// ─── In-memory GET cache (stale-while-revalidate) ──────────────────────────
const cache = new Map<string, { data: unknown; ts: number }>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL = 15_000; // 15 seconds

/** Bust all cached entries (call after mutations) */
export function invalidateCache() {
  cache.clear();
}

/** Bust entries matching a prefix, e.g. "/api/accounts" */
export function invalidateCachePrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
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

  let data: Record<string, unknown> | null = null;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (text) throw new Error(text);
  }

  if (res.status === 401 || res.status === 403) {
    throw new AuthError((data as Record<string, string>)?.error || "Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error((data as Record<string, string>)?.error || "Something went wrong");
  }

  return data;
}

/** Cached GET — deduplicates in-flight requests and returns stale data while revalidating */
function cachedGet(endpoint: string) {
  const hit = cache.get(endpoint);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return Promise.resolve(hit.data);
  }

  // Deduplicate concurrent requests for the same endpoint
  const existing = inflight.get(endpoint);
  if (existing) return existing;

  const promise = request(endpoint)
    .then((data) => {
      cache.set(endpoint, { data, ts: Date.now() });
      inflight.delete(endpoint);
      return data;
    })
    .catch((err) => {
      inflight.delete(endpoint);
      throw err;
    });

  inflight.set(endpoint, promise);
  return promise;
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
  return cachedGet("/api/me");
}

// Accounts
export async function getAccounts() {
  return cachedGet("/api/accounts");
}

export async function createAccount(data: {
  name: string;
  type: "wallet" | "bank" | "card";
  balance: number;
}) {
  const res = await request("/api/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCachePrefix("/api/accounts");
  invalidateCachePrefix("/api/summary");
  return res;
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
  const res = await request("/api/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCache();
  return res;
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
  return cachedGet(`/api/transactions${qs}`);
}

export async function deleteTransaction(id: number) {
  const res = await request(`/api/transactions/${id}`, { method: "DELETE" });
  invalidateCache();
  return res;
}

// Categories
export async function getCategories() {
  return cachedGet("/api/categories");
}

export async function createCategory(data: { name: string; type: "income" | "expense" | "transfer" }) {
  const res = await request("/api/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCachePrefix("/api/categories");
  return res;
}

export async function deleteCategory(id: number) {
  const res = await request(`/api/categories/${id}`, { method: "DELETE" });
  invalidateCachePrefix("/api/categories");
  return res;
}

// Budgets
export async function createBudget(data: {
  category_id: number;
  amount: number;
  month: number;
  year: number;
}) {
  const res = await request("/api/budgets", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCachePrefix("/api/budgets");
  return res;
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
  return cachedGet(`/api/budgets${qs}`);
}

export async function deleteBudget(id: number) {
  const res = await request(`/api/budgets/${id}`, { method: "DELETE" });
  invalidateCachePrefix("/api/budgets");
  return res;
}

// Summary
export async function getSummary() {
  return cachedGet("/api/summary");
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
  const res = await request("/api/debts", {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCachePrefix("/api/debts");
  invalidateCachePrefix("/api/accounts");
  return res;
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
  return cachedGet(`/api/debts${qs}`);
}

export async function repayDebt(id: number, data: { account_id: number; amount: number }) {
  const res = await request(`/api/debts/${id}/repay`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  invalidateCachePrefix("/api/debts");
  invalidateCachePrefix("/api/accounts");
  return res;
}

export async function getDebtSummary() {
  return cachedGet("/api/debts/summary");
}

export async function deleteDebt(id: number) {
  const res = await request(`/api/debts/${id}`, { method: "DELETE" });
  invalidateCachePrefix("/api/debts");
  invalidateCachePrefix("/api/accounts");
  return res;
}

// User Profile & Preferences
export async function updateProfile(data: {
  name: string;
  email: string;
  profile_pic?: string;
}) {
  const res = await request("/api/user/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  invalidateCachePrefix("/api/me");
  invalidateCachePrefix("/api/user");
  return res;
}

export async function changePassword(data: {
  old_password: string;
  new_password: string;
}) {
  return await request("/api/user/password", {
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

