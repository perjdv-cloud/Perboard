"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Loader2,
  Check,
  Utensils,
  Home as HomeIcon,
  ShoppingBag,
  Car,
  Briefcase,
  CreditCard,
  Banknote,
  Smartphone,
  MoreHorizontal,
  ImagePlus,
  Receipt,
  Camera,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  api,
  formatCurrency,
  formatDate,
  readFileAsDataURL,
  sortItems,
} from "@/lib/api";
import type { Transaction, TransactionType, SortKey } from "@/lib/types";
import { useAccounts, useCategories } from "@/lib/pickers";
import { toast } from "@/hooks/use-toast";
import ManageableSelect from "./ManageableSelect";
import TransactionDialog, {
  toDateInput,
  fromDateInput,
} from "./TransactionDialog";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Salary: Briefcase,
  Food: Utensils,
  Rent: HomeIcon,
  Shopping: ShoppingBag,
  Transport: Car,
  General: CreditCard,
  Other: MoreHorizontal,
};

const ACCOUNT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Cash: Banknote,
  Bank: Briefcase,
  Card: CreditCard,
  UPI: Smartphone,
  Other: MoreHorizontal,
};

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Comp = CATEGORY_ICONS[category] || MoreHorizontal;
  return <Comp className={className} />;
}

function AccountIcon({ account, className }: { account: string; className?: string }) {
  const Comp = ACCOUNT_ICONS[account] || MoreHorizontal;
  return <Comp className={className} />;
}

interface InlineEntry {
  type: TransactionType;
  account: string;
  amount: string; // keep as string for natural input
  description: string;
  category: string;
  imageData: string | null;
  imageData2: string | null;
  date: string; // YYYY-MM-DD
}

function todayDateInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Very short date: e.g. "3 Jul" */
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** ISO week number (1–53) of a date. */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    )
  );
}

/** Monday of the week containing d, as a Date. */
function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

type GroupMode = "none" | "week" | "month" | "year";

interface GroupedIncome {
  key: string;
  label: string;
  sum: number;
  items: Transaction[];
}

/** Group income transactions by week/month/year with summed amounts.
 *  Only RECEIVED items contribute to the group sum. */
function groupIncomes(
  items: Transaction[],
  mode: GroupMode
): GroupedIncome[] {
  if (mode === "none") {
    return [
      {
        key: "all",
        label: "All",
        sum: items
          .filter((t) => t.received)
          .reduce((s, t) => s + t.amount, 0),
        items,
      },
    ];
  }
  const map = new Map<string, GroupedIncome>();
  for (const t of items) {
    const d = new Date(t.date);
    let key: string;
    let label: string;
    if (mode === "week") {
      const ws = getWeekStart(d);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      key = `${ws.getFullYear()}-${ws.getMonth()}-${ws.getDate()}`;
      label = `${ws.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })} – ${we.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      })} (W${getWeekNumber(d)})`;
    } else if (mode === "month") {
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    } else {
      key = `${d.getFullYear()}`;
      label = `${d.getFullYear()}`;
    }
    const addAmount = t.received ? t.amount : 0;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(t);
      existing.sum += addAmount;
    } else {
      map.set(key, { key, label, sum: addAmount, items: [t] });
    }
  }
  // Sort groups by date descending
  return Array.from(map.values()).sort((a, b) => {
    const da = new Date(a.items[0].date).getTime();
    const db = new Date(b.items[0].date).getTime();
    return db - da;
  });
}

/** Check if a grouped-income group represents the CURRENT week/month/year. */
function isCurrentPeriod(group: GroupedIncome, mode: GroupMode): boolean {
  if (mode === "none") return true;
  const now = new Date();
  const first = new Date(group.items[0].date);
  if (mode === "week") {
    return getWeekNumber(now) === getWeekNumber(first) &&
      now.getFullYear() === first.getFullYear();
  }
  if (mode === "month") {
    return now.getFullYear() === first.getFullYear() &&
      now.getMonth() === first.getMonth();
  }
  // year
  return now.getFullYear() === first.getFullYear();
}

export default function FinanceTab() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { accounts, addAccount, removeAccount } = useAccounts();
  const { categories, addCategory, removeCategory } = useCategories();

  // Inline entry state — type/account/category/date are "sticky" defaults.
  const [entry, setEntry] = React.useState<InlineEntry>({
    type: "expense",
    account: "Cash",
    amount: "",
    description: "",
    category: "Food",
    imageData: null,
    imageData2: null,
    date: todayDateInput(),
  });
  const [inlineSaving, setInlineSaving] = React.useState(false);
  const [inlineFlash, setInlineFlash] = React.useState(false);
  const amountRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const image2InputRef = React.useRef<HTMLInputElement>(null);
  const cam1InputRef = React.useRef<HTMLInputElement>(null);
  const cam2InputRef = React.useRef<HTMLInputElement>(null);

  // Income section state
  const [accountTab, setAccountTab] = React.useState<string>("All");
  const [sort, setSort] = React.useState<SortKey>("recent");

  // Top-level view tab: "income" | "expense" (swipable)
  const [viewTab, setViewTab] = React.useState<"income" | "expense">("income");

  // Income grouping mode: "none" | "week" | "month" | "year"
  const [groupMode, setGroupMode] = React.useState<"none" | "week" | "month" | "year">("month");

  // Track manually-toggled groups. A group is expanded if:
  //  - it's the current period (default expanded), OR
  //  - the user explicitly toggled it open.
  // A group is collapsed if:
  //  - it's NOT the current period AND the user hasn't toggled it open.
  const [manualOverrides, setManualOverrides] = React.useState<Record<string, boolean>>({});

  // Dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Transaction | null>(null);

  // ----- Fetch -----
  const fetchAll = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await api<Transaction[]>("/api/transactions");
      setTransactions(items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ----- Derived -----
  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");

  const incomeAccounts = React.useMemo(
    () => Array.from(new Set(incomes.map((t) => t.account))),
    [incomes]
  );

  // If the selected account tab no longer has any income entries, fall back to All.
  React.useEffect(() => {
    if (accountTab !== "All" && !incomeAccounts.includes(accountTab)) {
      setAccountTab("All");
    }
  }, [incomeAccounts, accountTab]);

  const displayedIncomes = React.useMemo(() => {
    const filtered =
      accountTab === "All"
        ? incomes
        : incomes.filter((t) => t.account === accountTab);
    return sortItems(filtered, sort);
  }, [incomes, accountTab, sort]);

  // Income grouped by week/month/year (with summed amounts)
  const groupedIncomes = React.useMemo(
    () => groupIncomes(displayedIncomes, groupMode),
    [displayedIncomes, groupMode]
  );

  // A group is expanded if it's the current period, OR the user manually opened it.
  // Non-current groups start collapsed.
  const isGroupExpanded = React.useCallback(
    (group: GroupedIncome) => {
      if (groupMode === "none") return true;
      if (group.key in manualOverrides) return manualOverrides[group.key];
      return isCurrentPeriod(group, groupMode);
    },
    [groupMode, manualOverrides]
  );

  const toggleGroup = React.useCallback((key: string) => {
    setManualOverrides((prev) => {
      const current = key in prev ? prev[key] : false;
      return { ...prev, [key]: !current };
    });
  }, []);

  // Reset overrides when the group mode changes
  React.useEffect(() => {
    setManualOverrides({});
  }, [groupMode]);

  // ----- Inline save -----
  const saveEntry = React.useCallback(async () => {
    if (inlineSaving) return;
    const amountNum = parseFloat(entry.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return;

    setInlineSaving(true);
    try {
      const created = await api<Transaction>("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: entry.type,
          account: entry.account,
          amount: amountNum,
          description: entry.description.trim(),
          category: entry.category,
          imageData: entry.imageData,
          imageData2: entry.imageData2,
          date: fromDateInput(entry.date),
        }),
      });
      setTransactions((prev) => {
        // insert at the right position to keep date-desc order
        const next = [created, ...prev];
        next.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        return next;
      });
      toast({
        title: "Saved",
        description: `${entry.type === "income" ? "Income" : "Expense"} of ${formatCurrency(
          amountNum
        )} added`,
      });
      // Clear amount + images; keep sticky defaults for fast re-entry.
      setEntry((prev) => ({ ...prev, amount: "", imageData: null, imageData2: null }));
      setInlineFlash(true);
      window.setTimeout(() => setInlineFlash(false), 1200);
      // Refocus amount for rapid entry.
      window.setTimeout(() => amountRef.current?.focus(), 0);
    } catch (e) {
      toast({
        title: "Could not save",
        description: (e as Error).message,
      });
    } finally {
      setInlineSaving(false);
    }
  }, [entry, inlineSaving]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEntry();
    }
  };

  // Blur-of-amount auto-save (only when amount is valid).
  const handleBlurSave = () => {
    const amountNum = parseFloat(entry.amount);
    if (
      !inlineSaving &&
      Number.isFinite(amountNum) &&
      amountNum > 0
    ) {
      void saveEntry();
    }
  };

  // Image upload handler for inline entry (supports 2 slots)
  const handleImagePick = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: 1 | 2
  ) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        const d = await readFileAsDataURL(f);
        const key = slot === 1 ? "imageData" : "imageData2";
        setEntry((prev) => ({ ...prev, [key]: d }));
      } catch {
        toast({ title: "Could not read image", variant: "destructive" });
      }
    }
    e.target.value = "";
  };

  // ----- Dialog handlers -----
  const openTransaction = (t: Transaction) => {
    setSelected(t);
    setDialogOpen(true);
  };

  const handleSaved = (updated: Transaction) => {
    setTransactions((prev) => {
      const next = prev.map((t) => (t.id === updated.id ? updated : t));
      next.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return next;
    });
    setSelected(updated);
  };

  const handleDeleted = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setSelected(null);
  };

  // ----- Render helpers -----
  const isIncomeEntry = entry.type === "income";

  return (
    <div className="space-y-3">
      {/* ---------- Inline entry (compact) ---------- */}
      <Card className="gap-0 py-0">
        <CardContent className="px-2.5 py-2.5 sm:px-3 sm:py-3">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Type toggle (compact) — full width on mobile, auto on desktop */}
            <ToggleGroup
              type="single"
              value={entry.type}
              onValueChange={(v) => {
                if (v === "income" || v === "expense") {
                  setEntry((prev) => ({ ...prev, type: v as TransactionType }));
                }
              }}
              className="w-full sm:w-auto"
            >
              <ToggleGroupItem
                value="income"
                aria-label="Income"
                className="h-8 flex-1 px-3 text-xs data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:hover:bg-emerald-500/90 sm:flex-none"
              >
                <TrendingUp className="h-3.5 w-3.5" /> In
              </ToggleGroupItem>
              <ToggleGroupItem
                value="expense"
                aria-label="Expense"
                className="h-8 flex-1 px-3 text-xs data-[state=on]:bg-rose-500 data-[state=on]:text-white data-[state=on]:hover:bg-rose-500/90 sm:flex-none"
              >
                <TrendingDown className="h-3.5 w-3.5" /> Out
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Row: Account + Category on one line (50/50 on mobile) */}
            <div className="flex w-full items-center gap-1.5 sm:w-auto sm:flex-1">
              <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                <ManageableSelect
                  value={entry.account}
                  onValueChange={(v) =>
                    setEntry((prev) => ({ ...prev, account: v }))
                  }
                  items={accounts}
                  onAdd={addAccount}
                  onDelete={removeAccount}
                  placeholder="Account"
                />
              </div>
              <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                <ManageableSelect
                  value={entry.category}
                  onValueChange={(v) =>
                    setEntry((prev) => ({ ...prev, category: v }))
                  }
                  items={categories}
                  onAdd={addCategory}
                  onDelete={removeCategory}
                  placeholder="Category"
                />
              </div>
            </div>

            {/* Row: Amount + Date on one line (50/50 on mobile) */}
            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <Input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="Amount"
                value={entry.amount}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, amount: e.target.value }))
                }
                onKeyDown={handleKeyDown}
                onBlur={handleBlurSave}
                className={cn(
                  "h-8 min-w-0 flex-1 text-sm font-semibold sm:w-28 sm:flex-none",
                  isIncomeEntry ? "text-emerald-700" : "text-rose-700"
                )}
              />
              <Input
                type="date"
                value={entry.date}
                onChange={(e) =>
                  setEntry((prev) => ({ ...prev, date: e.target.value }))
                }
                onKeyDown={handleKeyDown}
                className="h-8 min-w-0 flex-1 text-sm sm:w-36 sm:flex-none"
              />
            </div>

            {/* Row: Image buttons + Add */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleImagePick(e, 1)}
            />
            <input
              ref={image2InputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleImagePick(e, 2)}
            />
            {/* Camera inputs (capture="environment" opens the camera on mobile) */}
            <input
              ref={cam1InputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleImagePick(e, 1)}
            />
            <input
              ref={cam2InputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleImagePick(e, 2)}
            />
            <div className="flex w-full items-center gap-1.5 sm:w-auto">
              <InlineImageButton
                imageData={entry.imageData}
                slot={1}
                onPick={() => imageInputRef.current?.click()}
                onClear={() => setEntry((prev) => ({ ...prev, imageData: null }))}
              />
              <InlineImageButton
                imageData={entry.imageData2}
                slot={2}
                onPick={() => image2InputRef.current?.click()}
                onClear={() => setEntry((prev) => ({ ...prev, imageData2: null }))}
              />
              {/* Camera capture buttons */}
              <InlineCameraButton
                onPick={() => cam1InputRef.current?.click()}
                label="Cam 1"
              />
              <InlineCameraButton
                onPick={() => cam2InputRef.current?.click()}
                label="Cam 2"
              />
              <Button
                type="button"
                onClick={() => void saveEntry()}
                disabled={inlineSaving}
                className={cn(
                  "ml-auto h-8 gap-1.5 px-4 text-xs sm:ml-0 sm:w-auto",
                  isIncomeEntry
                    ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                    : "bg-rose-600 text-white hover:bg-rose-600/90"
                )}
              >
                {inlineSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : inlineFlash ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {inlineSaving ? "Saving" : inlineFlash ? "Saved" : "Add"}
              </Button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-xs text-rose-600">Failed to load: {error}</p>
          )}
        </CardContent>
      </Card>

      {/* ---------- Top-level Income / Expense tabs (swipable) ---------- */}
      <div className="space-y-2">
        {/* Tab bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewTab("income")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                viewTab === "income"
                  ? "bg-background text-emerald-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Income
              <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {incomes.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab("expense")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                viewTab === "expense"
                  ? "bg-background text-rose-700 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" /> Expense
              <span className="rounded-full bg-rose-100 px-1.5 text-[10px] text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                {expenses.length}
              </span>
            </button>
          </div>
          {viewTab === "income" && (
            <div className="flex items-center gap-1.5">
              {/* Group-by selector */}
              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                {(["none", "week", "month", "year"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setGroupMode(m)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition",
                      groupMode === m
                        ? "bg-background text-emerald-700 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "none" ? "All" : m}
                  </button>
                ))}
              </div>
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger size="sm" className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Swipable content area — drag left/right to switch Income/Expense */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          dragMomentum={false}
          dragTransition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.5 } as any}
          transition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.5 }}
          onDragEnd={(_, info) => {
            const threshold = 32;
            if (info.offset.x < -threshold && viewTab === "income") setViewTab("expense");
            else if (info.offset.x > threshold && viewTab === "expense") setViewTab("income");
          }}
          whileDrag={{ cursor: "grabbing" }}
          className="select-none"
          style={{ cursor: "grab" }}
        >
          {viewTab === "income" ? (
            /* ===== INCOME: account tabs + 11-col grid ===== */
            <div className="space-y-2">
              {/* Account tabs (swipable, drag-to-switch) */}
              <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.1}
                dragMomentum={false}
                dragTransition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.5 } as any}
                transition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.5 }}
                onDragEnd={(_, info) => {
                  const threshold = 32;
                  const order = ["All", ...incomeAccounts];
                  const idx = order.indexOf(accountTab);
                  if (idx === -1) { setAccountTab("All"); return; }
                  if (info.offset.x < -threshold && idx < order.length - 1) setAccountTab(order[idx + 1]);
                  else if (info.offset.x > threshold && idx > 0) setAccountTab(order[idx - 1]);
                }}
                whileDrag={{ cursor: "grabbing" }}
                className="flex cursor-grab gap-1.5 overflow-x-auto pb-0.5 select-none snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Income accounts"
              >
                <AccountTab
                  label="All"
                  active={accountTab === "All"}
                  onClick={() => setAccountTab("All")}
                  count={incomes.length}
                />
                {incomeAccounts.map((a) => (
                  <AccountTab
                    key={a}
                    label={a}
                    active={accountTab === a}
                    onClick={() => setAccountTab(a)}
                    count={incomes.filter((t) => t.account === a).length}
                  />
                ))}
              </motion.div>

              {/* Income grid — grouped by week/month/year (with sums) or flat */}
              {loading ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-md" />
                  ))}
                </div>
              ) : displayedIncomes.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp className="h-6 w-6" />}
                  title="No income yet"
                  description="Add income using the row above."
                  tone="emerald"
                />
              ) : groupMode === "none" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11">
                  {displayedIncomes.map((t) => (
                    <CompactCard
                      key={t.id}
                      transaction={t}
                      tone="income"
                      onClick={() => openTransaction(t)}
                    />
                  ))}
                </div>
              ) : (
                /* Grouped: each group has a clickable header (label + sum) —
                   current period expanded by default, others collapsed.
                   Click the header to toggle. */
                <div className="space-y-2">
                  {groupedIncomes.map((g) => {
                    const expanded = isGroupExpanded(g);
                    const current = groupMode !== "none" && isCurrentPeriod(g, groupMode);
                    return (
                      <div key={g.key} className="overflow-hidden rounded-lg border border-emerald-200/60 dark:border-emerald-900/40">
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors",
                            current
                              ? "bg-emerald-100/80 dark:bg-emerald-950/50"
                              : "bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 text-emerald-600 transition-transform",
                                !expanded && "-rotate-90"
                              )}
                            />
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                              {g.label}
                            </span>
                            {current && (
                              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                NOW
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="rounded-full bg-emerald-200/70 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                              {g.items.length}
                            </span>
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(g.sum)}
                            </span>
                          </span>
                        </button>
                        {expanded && (
                          <div className="grid grid-cols-2 gap-2 p-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11">
                            {g.items.map((t) => (
                              <CompactCard
                                key={t.id}
                                transaction={t}
                                tone="income"
                                onClick={() => openTransaction(t)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ===== EXPENSE: 11-col grid ===== */
            <div className="space-y-2">
              {loading ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 rounded-md" />
                  ))}
                </div>
              ) : expenses.length === 0 ? (
                <EmptyState
                  icon={<TrendingDown className="h-6 w-6" />}
                  title="No expenses"
                  description="Track spending using the row above."
                  tone="rose"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-11">
                  {expenses.map((t) => (
                    <CompactCard
                      key={t.id}
                      transaction={t}
                      tone="expense"
                      onClick={() => openTransaction(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ---------- Dialog ---------- */}
      <TransactionDialog
        transaction={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

/* ---------------- Sub-components ---------------- */

function AccountTab({
  label,
  active,
  onClick,
  count,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
        active
          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
          : "border-border bg-background text-foreground hover:bg-accent"
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          active
            ? "bg-white/20 text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Very compact one-line card: date · category · amount, all in a single row.
 *  When an income card is "received", it enlarges and uses the #B7EDD5 background. */
function CompactCard({
  transaction,
  tone,
  onClick,
}: {
  transaction: Transaction;
  tone: "income" | "expense";
  onClick: () => void;
}) {
  const isIncome = tone === "income";
  const hasImage = !!(transaction.imageData || transaction.imageData2);
  const received = !!transaction.received;
  // Income received → enlarged card with #B7EDD5 background (light mint green)
  // Expense received → darker solid rose
  const enlarged = isIncome && received;
  const cardCls = isIncome
    ? received
      ? "border-emerald-400 focus-visible:ring-emerald-500/50 shadow-md"
      : "border-emerald-200/70 bg-emerald-50/50 hover:border-emerald-400 focus-visible:ring-emerald-500/40 dark:border-emerald-900/50 dark:bg-emerald-950/20"
    : received
      ? "border-rose-500 bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/50 dark:border-rose-400 dark:bg-rose-700"
      : "border-rose-200/70 bg-rose-50/50 hover:border-rose-400 focus-visible:ring-rose-500/40 dark:border-rose-900/50 dark:bg-rose-950/20";
  // Text colors
  const dateCls = isIncome
    ? received
      ? "text-emerald-900"
      : "text-muted-foreground"
    : received
      ? "text-white/80"
      : "text-muted-foreground";
  const catCls = isIncome
    ? received
      ? "text-emerald-900"
      : "text-emerald-700 dark:text-emerald-300"
    : received
      ? "text-white"
      : "text-rose-700 dark:text-rose-300";
  const amtCls = isIncome
    ? received
      ? "text-emerald-900"
      : "text-emerald-600 dark:text-emerald-400"
    : received
      ? "text-white"
      : "text-rose-600 dark:text-rose-400";
  const iconCls = isIncome
    ? received
      ? "text-emerald-700"
      : "text-emerald-500"
    : received
      ? "text-white/90"
      : "text-rose-500";
  // Font weight: received income cards use normal weight (not bold)
  const catWeight = enlarged ? "font-medium" : "font-semibold";
  const amtWeight = enlarged ? "font-medium" : "font-bold";
  // Small text color for the account/date line
  const subCls = isIncome
    ? received
      ? "text-emerald-700/80"
      : "text-muted-foreground"
    : received
      ? "text-white/70"
      : "text-muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      style={enlarged ? { backgroundColor: "#B7EDD5" } : undefined}
      className={cn(
        "group relative flex flex-col gap-0.5 overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2",
        enlarged && "px-2.5 py-2 ring-1 ring-emerald-400",
        cardCls
      )}
      title={`${transaction.category} · ${transaction.account} · ${formatDate(transaction.date)}${received ? " · received" : ""}`}
    >
      {/* Received indicator dot */}
      {received && (
        <span
          className={cn(
            "absolute right-1 top-1 h-1.5 w-1.5 rounded-full",
            isIncome ? "bg-emerald-700" : "bg-white/90"
          )}
          aria-hidden
        />
      )}
      {/* Line 1: date + account (small) */}
      <span className={cn("flex items-center gap-1 text-[10px] font-medium leading-tight", subCls)}>
        <span className="shrink-0">{formatDateShort(transaction.date)}</span>
        <span className="truncate">· {transaction.account}</span>
      </span>
      {/* Line 2: category + receipt icon + amount */}
      <span className="flex items-center gap-1 leading-tight">
        <span className={cn("min-w-0 flex-1 truncate text-xs capitalize", catWeight, catCls)}>
          {transaction.category}
        </span>
        {hasImage && (
          <Receipt className={cn("h-3 w-3 shrink-0", iconCls)} />
        )}
        <span className={cn("shrink-0 text-xs tabular-nums", amtWeight, amtCls)}>
          {isIncome ? "+" : "−"}
          {formatCurrency(transaction.amount)}
        </span>
      </span>
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "emerald" | "rose";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center",
        tone === "emerald"
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
          : "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-full",
          tone === "emerald"
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-300"
            : "bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300"
        )}
      >
        {icon}
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

/** Compact image attach button for the inline entry (supports 2 slots). */
function InlineImageButton({
  imageData,
  slot,
  onPick,
  onClear,
}: {
  imageData: string | null;
  slot: 1 | 2;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onPick}
      className={cn(
        "h-8 shrink-0 gap-1 px-2.5 text-xs",
        imageData
          ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : ""
      )}
      title={`Attach receipt image ${slot}`}
    >
      {imageData ? (
        <img
          src={imageData}
          alt=""
          className="h-5 w-5 rounded object-cover"
        />
      ) : (
        <ImagePlus className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {imageData ? `Img ${slot}` : `Img ${slot}`}
      </span>
      {imageData && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-200 text-emerald-800 hover:bg-emerald-300 dark:bg-emerald-800 dark:text-emerald-100"
          aria-label={`Remove image ${slot}`}
        >
          ×
        </button>
      )}
    </Button>
  );
}

/** Compact camera capture button for the inline entry. */
function InlineCameraButton({
  onPick,
  label,
}: {
  onPick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onPick}
      className="h-8 shrink-0 gap-1 px-2.5 text-xs"
      title={`Take photo with camera`}
    >
      <Camera className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
