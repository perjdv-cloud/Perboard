"use client";

import * as React from "react";
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

  // Income section state
  const [accountTab, setAccountTab] = React.useState<string>("All");
  const [sort, setSort] = React.useState<SortKey>("recent");

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
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

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
    <div className="space-y-5">
      {/* ---------- Summary cards ---------- */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total Income"
          value={totalIncome}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="emerald"
          loading={loading}
        />
        <SummaryCard
          label="Total Expense"
          value={totalExpense}
          icon={<TrendingDown className="h-4 w-4" />}
          tone="rose"
          loading={loading}
        />
        <SummaryCard
          label="Net Balance"
          value={net}
          icon={<Wallet className="h-4 w-4" />}
          tone={net >= 0 ? "emerald" : "rose"}
          loading={loading}
          prefix={net >= 0 ? "" : "−"}
        />
      </section>

      {/* ---------- Inline entry ---------- */}
      <Card className="gap-0 py-0">
        <CardContent className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Type toggle */}
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
                className="h-9 flex-1 data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:hover:bg-emerald-500/90 sm:flex-none"
              >
                <TrendingUp className="h-4 w-4" /> Income
              </ToggleGroupItem>
              <ToggleGroupItem
                value="expense"
                aria-label="Expense"
                className="h-9 flex-1 data-[state=on]:bg-rose-500 data-[state=on]:text-white data-[state=on]:hover:bg-rose-500/90 sm:flex-none"
              >
                <TrendingDown className="h-4 w-4" /> Expense
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Account (manageable) */}
            <div className="w-full min-w-[8rem] sm:w-40">
              <ManageableSelect
                value={entry.account}
                onValueChange={(v) =>
                  setEntry((prev) => ({ ...prev, account: v }))
                }
                items={accounts}
                onAdd={addAccount}
                onDelete={removeAccount}
                placeholder="Account"
                renderItem={(a) => <AccountIcon account={a} className="h-4 w-4" />}
              />
            </div>

            {/* Category (manageable) */}
            <div className="w-full min-w-[8rem] sm:w-44">
              <ManageableSelect
                value={entry.category}
                onValueChange={(v) =>
                  setEntry((prev) => ({ ...prev, category: v }))
                }
                items={categories}
                onAdd={addCategory}
                onDelete={removeCategory}
                placeholder="Category"
                renderItem={(c) => <CategoryIcon category={c} className="h-4 w-4" />}
              />
            </div>

            {/* Amount */}
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
                "h-9 w-full font-semibold sm:w-32",
                isIncomeEntry ? "text-emerald-700" : "text-rose-700"
              )}
            />

            {/* Date */}
            <Input
              type="date"
              value={entry.date}
              onChange={(e) =>
                setEntry((prev) => ({ ...prev, date: e.target.value }))
              }
              onKeyDown={handleKeyDown}
              className="h-9 w-full sm:w-40"
            />

            {/* Image uploads (2 receipt images) */}
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

            {/* Add button */}
            <Button
              type="button"
              onClick={() => void saveEntry()}
              disabled={inlineSaving}
              className={cn(
                "h-9 w-full gap-1.5 sm:w-auto",
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
          {error && (
            <p className="mt-2 text-xs text-rose-600">Failed to load: {error}</p>
          )}
        </CardContent>
      </Card>

      {/* ---------- Income section (with account tabs + grid) ---------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">Income</h2>
            <Badge variant="secondary" className="font-medium">
              {incomes.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Sort by
            </span>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger size="sm" className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="date">Date created</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Account tabs (swipable, hidden scrollbar, scroll-snap) */}
        <div
          className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              icon={<AccountIcon account={a} className="h-3.5 w-3.5" />}
            />
          ))}
        </div>

        {/* Income grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : displayedIncomes.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="No income yet"
            description="Add your first income using the row above. Income entries appear here grouped by account."
            tone="emerald"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {displayedIncomes.map((t) => (
              <IncomeCard
                key={t.id}
                transaction={t}
                onClick={() => openTransaction(t)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---------- Expense section ---------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-rose-600" />
          <h2 className="text-sm font-semibold">Recent Expenses</h2>
          <Badge variant="secondary" className="font-medium">
            {expenses.length}
          </Badge>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<TrendingDown className="h-6 w-6" />}
            title="No expenses recorded"
            description="Track where your money goes — add an expense using the row above."
            tone="rose"
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <ul
              role="list"
              className="max-h-96 divide-y divide-border overflow-y-auto"
            >
              {expenses.slice(0, 30).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openTransaction(t)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 sm:px-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                        <CategoryIcon category={t.category} className="h-4 w-4" />
                        {t.imageData && (
                          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-background text-rose-500 shadow-sm">
                            <Receipt className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize">
                          {t.category}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="capitalize">{t.category}</span>
                          <span className="mx-1">·</span>
                          {formatDate(t.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="hidden capitalize sm:inline-flex">
                        {t.account}
                      </Badge>
                      <span className="text-sm font-semibold text-rose-600">
                        −{formatCurrency(t.amount)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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

function SummaryCard({
  label,
  value,
  icon,
  tone,
  loading,
  prefix = "",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "emerald" | "rose";
  loading?: boolean;
  prefix?: string;
}) {
  const toneClasses =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
  const iconBg =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
      : "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300";
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
          iconBg
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-6 w-24" />
        ) : (
          <p
            className={cn(
              "truncate text-xl font-bold tracking-tight",
              toneClasses
            )}
          >
            {prefix}
            {formatCurrency(value)}
          </p>
        )}
      </div>
    </div>
  );
}

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

function IncomeCard({
  transaction,
  onClick,
}: {
  transaction: Transaction;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-2 overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
    >
      {/* Receipt images (up to 2) */}
      {(transaction.imageData || transaction.imageData2) && (
        <div className="relative flex w-full gap-0.5 overflow-hidden bg-muted">
          {transaction.imageData && (
            <div className="relative aspect-[4/3] flex-1 overflow-hidden">
              <img
                src={transaction.imageData}
                alt="Receipt 1"
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}
          {transaction.imageData2 && (
            <div className="relative aspect-[4/3] flex-1 overflow-hidden">
              <img
                src={transaction.imageData2}
                alt="Receipt 2"
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}
          <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-emerald-600 shadow-sm">
            <Receipt className="h-3 w-3" />
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            <AccountIcon account={transaction.account} className="h-3 w-3" />
            {transaction.account}
          </Badge>
          <span className="text-base font-bold text-emerald-600">
            +{formatCurrency(transaction.amount)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium capitalize">
            {transaction.category}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CategoryIcon category={transaction.category} className="h-3 w-3" />
            <span className="capitalize">{transaction.category}</span>
            <span className="mx-0.5">·</span>
            {formatDate(transaction.date)}
          </p>
        </div>
      </div>
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
        "h-9 shrink-0 gap-1.5 px-3",
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
