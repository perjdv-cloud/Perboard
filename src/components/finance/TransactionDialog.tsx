"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2, Check, TrendingDown, TrendingUp, ImagePlus, Receipt } from "lucide-react";
import { api, formatCurrency, formatDateTime, readFileAsDataURL } from "@/lib/api";
import type { Transaction, TransactionType } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export const ACCOUNTS = ["Cash", "Bank", "Card", "UPI", "Other"];
export const CATEGORIES = [
  "Salary",
  "Food",
  "Rent",
  "Shopping",
  "Transport",
  "General",
  "Other",
];

/** Convert an ISO date string to the YYYY-MM-DD value used by <input type="date">. */
export function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert a YYYY-MM-DD input value to an ISO string (noon to avoid TZ edges). */
export function fromDateInput(s: string): string {
  if (!s) return new Date().toISOString();
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

interface Props {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Transaction) => void;
  onDeleted: (id: string) => void;
}

export default function TransactionDialog({
  transaction,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: Props) {
  const [form, setForm] = React.useState<Transaction | null>(transaction);
  const [saving, setSaving] = React.useState(false);
  const [savedFlash, setSavedFlash] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [imageBusy, setImageBusy] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // Sync local form when the incoming transaction changes.
  React.useEffect(() => {
    setForm(transaction);
  }, [transaction]);

  // Reset transient UI flags whenever the dialog opens/closes.
  React.useEffect(() => {
    if (!open) {
      setSaving(false);
      setSavedFlash(false);
      setDeleting(false);
    }
  }, [open]);

  // Persist the current form to the API.
  const persist = React.useCallback(
    async (override?: Partial<Transaction>) => {
      if (!form) return;
      const payload = { ...form, ...override };
      setSaving(true);
      try {
        const updated = await api<Transaction>(
          `/api/transactions/${form.id}`,
          { method: "PUT", body: JSON.stringify(payload) }
        );
        setForm(updated);
        onSaved(updated);
        setSaving(false);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1200);
      } catch (e) {
        setSaving(false);
        toast({
          title: "Could not save",
          description: (e as Error).message,
        });
      }
    },
    [form, onSaved]
  );

  // Delete the current transaction.
  const handleDelete = React.useCallback(async () => {
    if (!form) return;
    setDeleting(true);
    try {
      await api(`/api/transactions/${form.id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Transaction removed" });
      onDeleted(form.id);
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not delete",
        description: (e as Error).message,
      });
    } finally {
      setDeleting(false);
    }
  }, [form, onDeleted, onOpenChange]);

  if (!form) return null;

  const isIncome = form.type === "income";

  const updateField = <K extends keyof Transaction>(key: K, value: Transaction[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // Image upload / clear
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImageBusy(true);
    try {
      const d = await readFileAsDataURL(f);
      const next = { ...form, imageData: d };
      setForm(next);
      await persist({ imageData: d });
    } catch {
      toast({ title: "Could not read image", variant: "destructive" });
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveImage = async () => {
    const next = { ...form, imageData: null };
    setForm(next);
    await persist({ imageData: null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isIncome ? (
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-rose-600" />
            )}
            Transaction details
          </DialogTitle>
          <DialogDescription>
            Changes save automatically. Created {formatDateTime(form.createdAt)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="space-y-1.5">
            <Label htmlFor="dlg-type">Type</Label>
            <ToggleGroup
              id="dlg-type"
              type="single"
              value={form.type}
              onValueChange={(v) => {
                if (v === "income" || v === "expense") {
                  const next = { ...form, type: v as TransactionType };
                  setForm(next);
                  void persist({ type: v });
                }
              }}
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem
                value="income"
                aria-label="Income"
                className={cn(
                  "h-10 data-[state=on]:bg-emerald-500 data-[state=on]:text-white data-[state=on]:hover:bg-emerald-500/90"
                )}
              >
                <TrendingUp className="h-4 w-4" /> Income
              </ToggleGroupItem>
              <ToggleGroupItem
                value="expense"
                aria-label="Expense"
                className={cn(
                  "h-10 data-[state=on]:bg-rose-500 data-[state=on]:text-white data-[state=on]:hover:bg-rose-500/90"
                )}
              >
                <TrendingDown className="h-4 w-4" /> Expense
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Amount + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dlg-amount">Amount</Label>
              <Input
                id="dlg-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={Number.isFinite(form.amount) ? form.amount : 0}
                onChange={(e) =>
                  updateField("amount", parseFloat(e.target.value) || 0)
                }
                onBlur={() => void persist()}
                className={cn(
                  "text-base font-semibold",
                  isIncome ? "text-emerald-700" : "text-rose-700"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select
                value={form.account}
                onValueChange={(v) => {
                  const next = { ...form, account: v };
                  setForm(next);
                  void persist({ account: v });
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Receipt image upload */}
          <div className="space-y-1.5">
            <Label>Receipt image</Label>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
            {form.imageData ? (
              <div className="group relative overflow-hidden rounded-lg border">
                <img
                  src={form.imageData}
                  alt="Receipt"
                  className="max-h-56 w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-white">
                    <Receipt className="h-3.5 w-3.5" /> Receipt attached
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={imageBusy}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {imageBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                      Replace
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="h-7 gap-1 px-2 text-xs"
                      disabled={imageBusy}
                      onClick={handleRemoveImage}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageBusy}
                className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 disabled:opacity-60"
              >
                {imageBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
                <span>{imageBusy ? "Uploading…" : "Add receipt image"}</span>
              </button>
            )}
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => {
                  const next = { ...form, category: v };
                  setForm(next);
                  void persist({ category: v });
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dlg-date">Date</Label>
              <Input
                id="dlg-date"
                type="date"
                value={toDateInput(form.date)}
                onChange={(e) =>
                  updateField("date", fromDateInput(e.target.value))
                }
                onBlur={() => void persist()}
              />
            </div>
          </div>

          {/* Live preview + save indicator */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Amount</span>
              <span
                className={cn(
                  "text-lg font-bold",
                  isIncome ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {isIncome ? "+" : "−"}
                {formatCurrency(form.amount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {form.account}
              </Badge>
              {saving ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </span>
              ) : savedFlash ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer: delete (with confirm) + close */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                className="gap-1.5"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The {form.type} of{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(form.amount)}
                  </span>{" "}
                  ({form.category}) will be permanently
                  removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
