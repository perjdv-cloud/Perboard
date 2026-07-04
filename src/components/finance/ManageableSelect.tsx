"use client";

import * as React from "react";
import { Check, Plus, Trash2, ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  items: string[];
  onAdd: (name: string) => boolean;
  onDelete: (name: string) => void;
  placeholder?: string;
  renderItem?: (item: string) => React.ReactNode;
  className?: string;
}

/**
 * A select-style dropdown whose trigger shows the current value text.
 * The dropdown itself contains: the list of options (click to select,
 * each with a delete trash button) + an inline "Add new" row at the bottom.
 * Add and delete happen inside the dropdown — no separate popover.
 */
export default function ManageableSelect({
  value,
  onValueChange,
  items,
  onAdd,
  onDelete,
  placeholder,
  renderItem,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");

  const handleAdd = () => {
    const n = newName.trim();
    if (!n) return;
    const ok = onAdd(n);
    if (ok) {
      onValueChange(n);
      setNewName("");
    }
  };

  const handleDelete = (item: string) => {
    onDelete(item);
    if (value === item && items.length > 1) {
      const fallback = items.find((x) => x !== item);
      if (fallback) onValueChange(fallback);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex h-8 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm ring-offset-background transition-colors hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 data-[placeholder]:text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {value && renderItem ? renderItem(value) : null}
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder || "Select…"}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[10rem] p-0"
        align="start"
      >
        <div className="max-h-60 overflow-y-auto p-1">
          {items.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              Nothing yet — add one below
            </p>
          )}
          {items.map((item) => {
            const selected = item === value;
            return (
              <div
                key={item}
                className="group flex items-center gap-1 rounded-sm px-1"
              >
                <button
                  type="button"
                  onClick={() => {
                    onValueChange(item);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent"
                >
                  {renderItem ? renderItem(item) : null}
                  <span className="truncate">{item}</span>
                </button>
                <div className="flex shrink-0 items-center">
                  {selected && (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                    className="grid h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Delete ${item}`}
                    title={`Delete ${item}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new — inside the dropdown */}
        <div className="border-t border-border p-1.5">
          <div className="flex items-center gap-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder={`Add ${placeholder ?? "new"}…`}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleAdd}
              disabled={!newName.trim()}
              aria-label={`Add ${placeholder ?? "item"}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
