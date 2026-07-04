"use client";

import { useMemo } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileType2,
  Image as ImageIcon,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FileItem } from "@/lib/types";
import { formatBytes, formatDateTime } from "@/lib/api";

interface FileViewerProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (file: FileItem) => void;
  deleting?: boolean;
}

const TYPE_META: Record<
  FileItem["type"],
  { label: string; icon: typeof FileText; color: string; ring: string }
> = {
  image: {
    label: "Image",
    icon: ImageIcon,
    color: "text-rose-600 bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300",
    ring: "ring-rose-200 dark:ring-rose-900/60",
  },
  pdf: {
    label: "PDF",
    icon: FileType2,
    color:
      "text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300",
    ring: "ring-amber-200 dark:ring-amber-900/60",
  },
  excel: {
    label: "Spreadsheet",
    icon: FileSpreadsheet,
    color:
      "text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300",
    ring: "ring-emerald-200 dark:ring-emerald-900/60",
  },
  document: {
    label: "Document",
    icon: FileText,
    color:
      "text-slate-700 bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300",
    ring: "ring-slate-200 dark:ring-slate-700",
  },
};

export default function FileViewer({
  file,
  open,
  onOpenChange,
  onDelete,
  deleting,
}: FileViewerProps) {
  const meta = useMemo(
    () => (file ? TYPE_META[file.type] : TYPE_META.document),
    [file]
  );

  if (!file) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          <DialogTitle className="sr-only">File viewer</DialogTitle>
        </DialogContent>
      </Dialog>
    );
  }

  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4 sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${meta.color} ${meta.ring}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate pr-1 text-base sm:text-lg">
                {file.name}
              </DialogTitle>
              <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <span>{formatBytes(file.size)}</span>
                <span aria-hidden>·</span>
                <span>{file.mimeType || meta.label}</span>
                <span aria-hidden>·</span>
                <span>{formatDateTime(file.createdAt)}</span>
              </DialogDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-9 px-2.5"
              title="Download"
            >
              <a href={file.data} download={file.name}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </a>
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="h-9 px-2.5"
                onClick={() => onDelete(file)}
                disabled={deleting}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {deleting ? "Deleting…" : "Delete"}
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-muted/40 p-3 sm:p-5">
          {file.type === "image" && (
            <div className="grid place-items-center">
              <img
                src={file.data}
                alt={file.name}
                className="max-h-[68vh] w-auto max-w-full rounded-lg border border-border/60 bg-background object-contain shadow-sm"
              />
            </div>
          )}

          {file.type === "pdf" && (
            <iframe
              src={file.data}
              title={file.name}
              className="h-[68vh] w-full rounded-lg border border-border/60 bg-white"
            />
          )}

          {(file.type === "excel" || file.type === "document") && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border/70 bg-background p-8 text-center">
              <div
                className={`grid h-16 w-16 place-items-center rounded-2xl ring-1 ${meta.color} ${meta.ring}`}
              >
                <Icon className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Preview not available in-browser
                </p>
                <p className="text-xs text-muted-foreground">
                  Download this {meta.label.toLowerCase()} to view its contents.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild size="sm" className="h-9">
                  <a href={file.data} download={file.name}>
                    <Download className="h-4 w-4" />
                    Download file
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9">
                  <a href={file.data} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
              </div>
              <Badge variant="secondary" className="mt-1">
                {formatBytes(file.size)} · {meta.label}
              </Badge>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
