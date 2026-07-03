"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FolderOpen,
  FolderPlus,
  Upload,
  UploadCloud,
  Trash2,
  Download,
  FileText,
  FileSpreadsheet,
  FileType2,
  Image as ImageIcon,
  Folder,
  X,
  ArrowUpDown,
  Check,
  Loader2,
  CloudUpload,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  api,
  formatBytes,
  formatDate,
  readFileAsDataURL,
  sortItems,
} from "@/lib/api";
import {
  FOLDER_COLORS,
  type FileFolder,
  type FileItem,
  type FileType,
  type SortKey,
} from "@/lib/types";
import FileViewer from "./FileViewer";

type FolderFilter = "all" | string; // "all" | folderId

const ACCEPTED_EXT = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "doc",
  "docx",
  "txt",
  "pdf",
  "xls",
  "xlsx",
  "csv",
];

const TYPE_BADGE: Record<
  FileType,
  { label: string; icon: typeof FileText; cls: string }
> = {
  image: {
    label: "Image",
    icon: ImageIcon,
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  pdf: {
    label: "PDF",
    icon: FileType2,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  excel: {
    label: "Sheet",
    icon: FileSpreadsheet,
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  document: {
    label: "Doc",
    icon: FileText,
    cls: "bg-slate-200 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300",
  },
};

function detectType(file: File): FileType {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "text/csv"
  ) {
    return "excel";
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "excel";
  return "document";
}

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isAccepted(file: File): boolean {
  const ext = extOf(file.name);
  return ACCEPTED_EXT.includes(ext);
}

export default function FilesTab() {
  const [folders, setFolders] = useState<FileFolder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(true);

  const [activeFolder, setActiveFolder] = useState<FolderFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [pendingUploads, setPendingUploads] = useState<
    { id: string; name: string; size: number }[]
  >([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  // ---- Fetch folders ----
  const fetchFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const data = await api<FileFolder[]>("/api/file-folders");
      setFolders(data);
    } catch {
      toast({
        title: "Couldn't load folders",
        description: "Please try again in a moment.",
      });
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  // ---- Fetch files (depends on activeFolder) ----
  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const url =
        activeFolder === "all"
          ? "/api/files"
          : `/api/files?folderId=${encodeURIComponent(activeFolder)}`;
      const data = await api<FileItem[]>(url);
      setFiles(data);
    } catch {
      toast({
        title: "Couldn't load files",
        description: "Please try again in a moment.",
      });
    } finally {
      setLoadingFiles(false);
    }
  }, [activeFolder]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // ---- Folder create ----
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast({ title: "Folder needs a name" });
      return;
    }
    setCreatingFolder(true);
    try {
      const created = await api<FileFolder>("/api/file-folders", {
        method: "POST",
        body: JSON.stringify({ name, color: newFolderColor }),
      });
      setFolders((f) => [...f, created]);
      setNewFolderName("");
      setNewFolderColor(FOLDER_COLORS[0]);
      setAddFolderOpen(false);
      setActiveFolder(created.id);
      toast({
        title: "Folder created",
        description: `"${created.name}" is ready for files.`,
      });
    } catch {
      toast({
        title: "Couldn't create folder",
        description: "Please try again.",
      });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder: FileFolder) => {
    setDeletingFolderId(folder.id);
    try {
      await api(`/api/file-folders/${folder.id}`, { method: "DELETE" });
      setFolders((f) => f.filter((x) => x.id !== folder.id));
      if (activeFolder === folder.id) setActiveFolder("all");
      toast({
        title: "Folder removed",
        description: `Files from "${folder.name}" were kept and moved to All Files.`,
      });
      // Refetch files (since they got unassigned)
      fetchFiles();
    } catch {
      toast({ title: "Couldn't delete folder" });
    } finally {
      setDeletingFolderId(null);
    }
  };

  // ---- Upload ----
  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      const accepted = arr.filter(isAccepted);
      const rejected = arr.filter((f) => !isAccepted(f));
      if (rejected.length > 0) {
        toast({
          title: "Some files skipped",
          description: `${rejected.length} file(s) aren't supported. Use images, PDF, Excel, Word or txt.`,
        });
      }
      if (accepted.length === 0) return;

      const folderId = activeFolder === "all" ? null : activeFolder;
      setUploadingCount((n) => n + accepted.length);
      setPendingUploads((p) => [
        ...p,
        ...accepted.map((f, i) => ({
          id: `${f.name}-${Date.now()}-${i}`,
          name: f.name,
          size: f.size,
        })),
      ]);

      let ok = 0;
      let fail = 0;
      // Upload sequentially to avoid overloading the SQLite DB with huge parallel writes.
      for (const file of accepted) {
        try {
          const dataUrl = await readFileAsDataURL(file);
          const payload = {
            folderId,
            name: file.name,
            type: detectType(file),
            mimeType: file.type || "",
            data: dataUrl,
            size: file.size,
          };
          await api<FileItem>("/api/files", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          ok += 1;
          setPendingUploads((p) =>
            p.filter(
              (x) => !(x.name === file.name && x.size === file.size)
            )
          );
        } catch {
          fail += 1;
        }
      }
      setUploadingCount(0);
      setPendingUploads([]);
      if (ok > 0) {
        toast({
          title: `${ok} file${ok > 1 ? "s" : ""} uploaded`,
          description: "Auto-saved to your library.",
        });
        fetchFiles();
        fetchFolders();
      } else if (fail > 0) {
        toast({
          title: "Upload failed",
          description: "Please try again.",
        });
      }
    },
    [activeFolder, fetchFiles, fetchFolders]
  );

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // ---- Delete file ----
  const handleDeleteFile = async (file: FileItem) => {
    setDeletingId(file.id);
    try {
      await api(`/api/files/${file.id}`, { method: "DELETE" });
      setFiles((f) => f.filter((x) => x.id !== file.id));
      if (viewerFile?.id === file.id) {
        setViewerOpen(false);
        setViewerFile(null);
      }
      toast({
        title: "File deleted",
        description: file.name,
      });
    } catch {
      toast({ title: "Couldn't delete file" });
    } finally {
      setDeletingId(null);
    }
  };

  const openViewer = (file: FileItem) => {
    setViewerFile(file);
    setViewerOpen(true);
  };

  const sortedFiles = useMemo(
    () => sortItems(files, sort),
    [files, sort]
  );

  const activeFolderObj = useMemo(
    () => (activeFolder === "all" ? null : folders.find((f) => f.id === activeFolder) ?? null),
    [activeFolder, folders]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Folder pills row (swipable) */}
      <div className="relative -mx-1">
        <div
          className="no-scrollbar flex items-stretch gap-2 overflow-x-auto px-1 pb-1"
          style={{
            scrollSnapType: "x proximity",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <FolderPill
            active={activeFolder === "all"}
            onClick={() => setActiveFolder("all")}
            label="All Files"
            icon={<FolderOpen className="h-4 w-4" />}
            count={undefined}
            accent="#f43f5e"
          />
          {loadingFolders
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
              ))
            : folders.map((f) => (
                <FolderPill
                  key={f.id}
                  active={activeFolder === f.id}
                  onClick={() => setActiveFolder(f.id)}
                  label={f.name}
                  icon={<Folder className="h-4 w-4" />}
                  accent={f.color}
                  onDelete={() => handleDeleteFolder(f)}
                  deleting={deletingFolderId === f.id}
                />
              ))}
          <button
            type="button"
            onClick={() => setAddFolderOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-rose-300 bg-rose-50/60 px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60"
            style={{ scrollSnapAlign: "start" }}
          >
            <FolderPlus className="h-4 w-4" />
            <span>New folder</span>
          </button>
        </div>
      </div>

      {/* Upload zone + sort */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload files"
          className={cn(
            "group relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all sm:flex-row sm:justify-between sm:gap-4 sm:px-6",
            dragOver
              ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
              : "border-rose-200 bg-rose-50/30 hover:border-rose-400 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 dark:hover:border-rose-700 dark:hover:bg-rose-950/40"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXT.map((e) => `.${e}`).join(",")}
            className="hidden"
            onChange={onFileInputChange}
          />
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm transition-transform group-hover:scale-105",
                uploadingCount > 0 && "animate-pulse"
              )}
            >
              {uploadingCount > 0 ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <CloudUpload className="h-6 w-6" />
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">
                {uploadingCount > 0
                  ? `Uploading ${uploadingCount} file${uploadingCount > 1 ? "s" : ""}…`
                  : "Drop files to auto-save"}
              </p>
              <p className="text-xs text-muted-foreground">
                Images, PDF, Excel, Word &amp; txt · saved to{" "}
                <span className="font-medium text-rose-700 dark:text-rose-300">
                  {activeFolder === "all" ? "All Files" : activeFolderObj?.name ?? "folder"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              className="h-9 bg-rose-600 text-white shadow-sm hover:bg-rose-700"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 lg:flex-none">
          <ArrowUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger
              size="sm"
              className="h-9 w-[150px] bg-background"
              aria-label="Sort files"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="date">Date added</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pending uploads skeleton row */}
      <AnimatePresence>
        {pendingUploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving {pendingUploads.length} file(s)…
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9">
              {pendingUploads.map((p) => (
                <div
                  key={p.id}
                  className="flex aspect-[3/4] flex-col gap-2 rounded-xl border border-rose-200/70 bg-rose-50/40 p-2 dark:border-rose-900/50 dark:bg-rose-950/20"
                >
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Files grid */}
      <section
        aria-label="Files"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9"
      >
        {loadingFiles
          ? Array.from({ length: 8 }).map((_, i) => (
              <FileCardSkeleton key={i} />
            ))
          : sortedFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onOpen={() => openViewer(file)}
                onDelete={() => handleDeleteFile(file)}
                deleting={deletingId === file.id}
              />
            ))}
      </section>

      {/* Empty state */}
      {!loadingFiles && sortedFiles.length === 0 && pendingUploads.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <FolderOpen className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">
              {activeFolder === "all"
                ? "No files yet"
                : `Nothing in "${activeFolderObj?.name ?? "this folder"}"`}
            </p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Drag &amp; drop files here, or tap Upload. We&apos;ll auto-save
              them to your library instantly.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload your first file
          </Button>
        </div>
      )}

      {/* Add folder dialog */}
      <Dialog open={addFolderOpen} onOpenChange={setAddFolderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a folder</DialogTitle>
            <DialogDescription>
              Group related files together. You can pick a color to spot it
              quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-1">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="folder-name"
                className="text-xs font-medium text-muted-foreground"
              >
                Folder name
              </label>
              <Input
                id="folder-name"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Invoices, Photos, Work"
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Color
              </span>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map((c) => {
                  const selected = newFolderColor === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewFolderColor(c)}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                        selected ? "ring-rose-500" : "ring-transparent"
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Pick color ${c}`}
                      aria-pressed={selected}
                    >
                      {selected && (
                        <Check className="h-4 w-4 text-slate-900/80" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAddFolderOpen(false)}
              disabled={creatingFolder}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {creatingFolder ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File viewer */}
      <FileViewer
        file={viewerFile}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        onDelete={handleDeleteFile}
        deleting={!!deletingId}
      />
    </div>
  );
}

// ---------- FolderPill ----------
function FolderPill({
  active,
  onClick,
  label,
  icon,
  accent,
  count,
  onDelete,
  deleting,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  accent: string;
  count?: number;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div
      className="relative flex shrink-0 items-center"
      style={{ scrollSnapAlign: "start" }}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-all",
          active
            ? "border-transparent bg-foreground text-background shadow-sm"
            : "border-border/70 bg-background text-foreground hover:bg-accent"
        )}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        {icon}
        <span className="max-w-[140px] truncate">{label}</span>
        {typeof count === "number" && (
          <span
            className={cn(
              "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              active
                ? "bg-background/20 text-background"
                : "bg-muted text-muted-foreground"
            )}
          >
            {count}
          </span>
        )}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className={cn(
            "absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-background bg-rose-600 text-white opacity-0 shadow-sm transition-all hover:bg-rose-700 focus-visible:opacity-100 group-hover:opacity-100",
            active && "opacity-70"
          )}
          aria-label={`Delete folder ${label}`}
          title="Delete folder"
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </button>
      )}
    </div>
  );
}

// ---------- FileCard ----------
function FileCard({
  file,
  onOpen,
  onDelete,
  deleting,
}: {
  file: FileItem;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const meta = TYPE_BADGE[file.type];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-square w-full overflow-hidden bg-muted/50 text-left"
        aria-label={`Open ${file.name}`}
      >
        {file.type === "image" ? (
          <img
            src={file.data}
            alt={file.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-2",
              file.type === "pdf" &&
                "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/20",
              file.type === "excel" &&
                "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/20",
              file.type === "document" &&
                "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/40 dark:to-slate-800/20"
            )}
          >
            <div
              className={cn(
                "grid h-12 w-12 place-items-center rounded-xl",
                meta.cls
              )}
            >
              <Icon className="h-6 w-6" />
            </div>
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {extOf(file.name) || meta.label}
            </span>
          </div>
        )}

        {/* Hover overlay actions */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-1 bg-gradient-to-b from-black/30 via-transparent to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <a
            href={file.data}
            download={file.name}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full bg-background/95 text-foreground shadow-sm transition-colors hover:bg-background"
            aria-label="Download"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="pointer-events-auto grid h-7 w-7 place-items-center rounded-full bg-rose-600 text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-70"
            aria-label="Delete"
            title="Delete"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </button>

      {/* Meta */}
      <div className="flex flex-col gap-1 p-2.5">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className={cn("px-1.5 py-0 text-[9px] font-semibold uppercase", meta.cls)}
          >
            <Icon className="h-2.5 w-2.5" />
            {meta.label}
          </Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatBytes(file.size)}
          </span>
        </div>
        <p className="truncate text-xs font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatDate(file.createdAt)}
        </p>
      </div>
    </motion.div>
  );
}

function FileCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-background">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
