import { createClient } from "@supabase/supabase-js";
import { ImportError } from "./types";

/** Model used for AI import. Override with ANTHROPIC_MODEL (e.g. claude-haiku-5-5 to cut cost). */
export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

/** US dollars per million tokens: [input, output]. Unknown models are priced like Opus (conservative). */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function costUsd(model: string, u: TokenUsage): number {
  const [pin, pout] = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const input = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return (input * pin + u.output_tokens * pout) / 1_000_000;
}

export const monthlyCapUsd = () => {
  const n = Number(process.env.AI_MONTHLY_CAP_USD ?? 10);
  return n > 0 ? n : 10;
};

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export interface BudgetStore {
  spent(userId: string, month: string): Promise<number>;
  add(userId: string, month: string, usd: number): Promise<void>;
}

const memory = new Map<string, number>();
const memoryStore: BudgetStore = {
  async spent(u, m) {
    return memory.get(`${u}:${m}`) ?? 0;
  },
  async add(u, m, usd) {
    memory.set(`${u}:${m}`, (memory.get(`${u}:${m}`) ?? 0) + usd);
  },
};

/** Persistent store in Supabase (service role, server only). Falls back to memory in local dev. */
function supabaseStore(): BudgetStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });
  return {
    async spent(userId, month) {
      const { data } = await db.from("ai_usage").select("cost_usd").eq("user_id", userId).eq("month", month).maybeSingle();
      return Number(data?.cost_usd ?? 0);
    },
    async add(userId, month, usd) {
      const current = await this.spent(userId, month);
      await db.from("ai_usage").upsert({ user_id: userId, month, cost_usd: current + usd });
    },
  };
}

export const budgetStore = (): BudgetStore => supabaseStore() ?? memoryStore;

export interface BudgetStatus {
  spentUsd: number;
  capUsd: number;
  /** true once 80% of the cap is used */
  nearLimit: boolean;
}

export async function checkBudget(userId: string, store = budgetStore()): Promise<BudgetStatus> {
  const cap = monthlyCapUsd();
  const spent = await store.spent(userId, monthKey());
  if (spent >= cap)
    throw new ImportError(
      `This month's AI limit ($${cap}) has been reached. AI import is paused until next month; you can still add recipes by hand or import from links with recipe data.`,
      "ai_budget",
    );
  return { spentUsd: spent, capUsd: cap, nearLimit: spent >= cap * 0.8 };
}

export async function recordSpend(userId: string, usd: number, store = budgetStore()): Promise<BudgetStatus> {
  await store.add(userId, monthKey(), usd);
  const cap = monthlyCapUsd();
  const spent = await store.spent(userId, monthKey());
  return { spentUsd: spent, capUsd: cap, nearLimit: spent >= cap * 0.8 };
}
