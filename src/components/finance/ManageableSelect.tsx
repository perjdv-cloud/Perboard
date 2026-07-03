"use client";

import * as React from "react";
import { Plus, Trash2, Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
 * A Select dropdown paired with a "+" button that opens a popover
 * for adding new options and deleting existing ones.
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
    const ok = onAdd(newName);
    if (ok) {
      onValueChange(newName.trim());
      setNewName("");
    }
  };

  return (
    <div className={cn("flex w-full items-center gap-1", className)}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger size="sm" className="h-9 min-w-0 flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item} value={item}>
              {renderItem ? renderItem(item) : item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label={`Manage ${placeholder ?? "options"}`}
            title={`Add / delete ${placeholder ?? "options"}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Manage {placeholder ?? "options"}
          </p>
          <div className="flex items-center gap-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Add new…"
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleAdd}
              disabled={!newName.trim()}
              aria-label="Add"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
            {items.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Nothing yet
              </p>
            )}
            {items.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate">
                  {renderItem ? renderItem(item) : null}
                  <span className="truncate">{item}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(item);
                    if (value === item && items.length > 1) {
                      const fallback = items.find((x) => x !== item);
                      if (fallback) onValueChange(fallback);
                    }
                  }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${item}`}
                  title={`Delete ${item}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
