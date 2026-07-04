"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  X,
  FolderPlus,
  Pin,
  Trash2,
  Type,
  Image as ImageIcon,
  Pencil,
  Mic,
  Clock,
  Folder as FolderIcon,
  StickyNote,
  Loader2,
  SortAsc,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import { api, readFileAsDataURL, sortItems } from "@/lib/api";
import {
  NOTE_COLORS,
  FOLDER_COLORS,
  type Note,
  type NoteFolder,
  type NoteType,
  type SortKey,
} from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import NoteEditor, {
  DrawingCanvas,
  VoiceRecorder,
  VoicePlayer,
  NoteTypeBadge,
  SaveIndicator,
  useLatest,
  type SaveState,
} from "./NoteEditor";

/* ---------------- helpers ---------------- */

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 30) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/* ---------------- main component ---------------- */

export default function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const [editorNote, setEditorNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);

  const loadFolders = useCallback(async () => {
    try {
      const f = await api<NoteFolder[]>("/api/note-folders");
      setFolders(f);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const n = await api<Note[]>("/api/notes");
      setNotes(n);
    } catch (e) {
      console.error(e);
      toast({ title: "Failed to load notes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
    void loadNotes();
  }, [loadFolders, loadNotes]);

  const filteredNotes = useMemo(() => {
    let arr = notes;
    if (activeFolder !== "all") {
      arr = arr.filter((n) => n.folderId === activeFolder);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
      );
    }
    const sorted = sortItems(arr, sort);
    // Pinned first within the sorted order
    return [
      ...sorted.filter((n) => n.pinned),
      ...sorted.filter((n) => !n.pinned),
    ];
  }, [notes, activeFolder, search, sort]);

  const handleCreated = useCallback((note: Note) => {
    setNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) {
        return prev.map((n) => (n.id === note.id ? note : n));
      }
      return [note, ...prev];
    });
  }, []);

  const handleSaved = useCallback((updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    setEditorNote((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setEditorNote((prev) => (prev?.id === id ? null : prev));
  }, []);

  const handleTogglePin = useCallback(
    async (note: Note) => {
      // Optimistic update
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id ? { ...n, pinned: !n.pinned } : n
        )
      );
      try {
        const updated = await api<Note>(`/api/notes/${note.id}`, {
          method: "PUT",
          body: JSON.stringify({ pinned: !note.pinned }),
        });
        handleSaved(updated);
      } catch {
        // Revert
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...n, pinned: note.pinned } : n
          )
        );
        toast({ title: "Failed to update note", variant: "destructive" });
      }
    },
    [handleSaved]
  );

  const handleDeleteNote = useCallback(
    async (note: Note) => {
      const prev = notes;
      setNotes((arr) => arr.filter((n) => n.id !== note.id));
      try {
        await api(`/api/notes/${note.id}`, { method: "DELETE" });
        toast({ title: "Note deleted" });
      } catch {
        setNotes(prev);
        toast({ title: "Failed to delete note", variant: "destructive" });
      }
    },
    [notes]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const folder = folders.find((f) => f.id === id);
      const name = folder?.name ?? "this folder";
      const count = notes.filter((n) => n.folderId === id).length;
      const msg =
        count > 0
          ? `Delete "${name}"? Its ${count} note(s) will be moved to All Notes.`
          : `Delete "${name}"?`;
      const ok = window.confirm(msg);
      if (!ok) return;
      const prev = folders;
      setFolders((arr) => arr.filter((f) => f.id !== id));
      setNotes((arr) =>
        arr.map((n) => (n.folderId === id ? { ...n, folderId: null } : n))
      );
      if (activeFolder === id) setActiveFolder("all");
      try {
        await api(`/api/note-folders/${id}`, { method: "DELETE" });
        toast({
          title: "Folder deleted",
          description: "Notes moved to All Notes.",
        });
      } catch {
        setFolders(prev);
        toast({ title: "Failed to delete folder", variant: "destructive" });
      }
    },
    [folders, notes, activeFolder]
  );

  const handleOpenNote = useCallback((note: Note) => {
    setEditorNote(note);
    setEditorOpen(true);
  }, []);

  const activeFolderName =
    activeFolder === "all"
      ? "All notes"
      : folders.find((f) => f.id === activeFolder)?.name ?? "Notes";

  // Ordered list of folder ids for swiping: "all" + each folder
  const folderOrder = useMemo(
    () => ["all", ...folders.map((f) => f.id)],
    [folders]
  );
  const folderIndex = folderOrder.indexOf(activeFolder);

  const swipeFolder = useCallback(
    (dir: 1 | -1) => {
      const idx = folderOrder.indexOf(activeFolder);
      if (idx === -1) {
        setActiveFolder("all");
        return;
      }
      const next = idx + dir;
      if (next < 0 || next >= folderOrder.length) return;
      setActiveFolder(folderOrder[next]);
    },
    [folderOrder, activeFolder]
  );

  return (
    <div className="space-y-3">
      {/* Inline toolbar: Add note + search + sort */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="h-9 shrink-0 gap-1.5 rounded-full bg-amber-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add note</span>
          <span className="sm:hidden">Add</span>
        </Button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="h-9 rounded-full border-border/70 bg-card pl-9 pr-8 text-sm shadow-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="relative shrink-0">
          <SortAsc className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
          >
            <SelectTrigger className="h-9 w-[128px] rounded-full border-border/70 bg-card pl-8 pr-7 text-sm shadow-sm">
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

      {/* Folder tabs */}
      <FolderTabs
        folders={folders}
        active={activeFolder}
        onSelect={setActiveFolder}
        onAdd={() => setAddFolderOpen(true)}
        onDelete={handleDeleteFolder}
      />

      {/* Quick composer (dialog) */}
      <ComposerCard
        folders={folders}
        activeFolder={activeFolder}
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={handleCreated}
        onUpdated={handleSaved}
      />

      {/* Swipeable notes area — drag left/right to switch folders (soft spring) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        dragTransition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.5 } as any}
        transition={{ type: "spring", stiffness: 180, damping: 26, mass: 0.5 }}
        onDragEnd={(_, info) => {
          const threshold = 32;
          if (info.offset.x < -threshold) swipeFolder(1);
          else if (info.offset.x > threshold) swipeFolder(-1);
        }}
        whileDrag={{ cursor: "grabbing" }}
        className="select-none"
        style={{ cursor: "grab" }}
      >
        {/* Section heading with prev/next chevrons */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {activeFolderName}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {filteredNotes.length}
            </span>
          </h2>
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => swipeFolder(-1)}
              disabled={folderIndex <= 0}
              className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Previous folder"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="hidden text-[11px] font-normal sm:inline">
              swipe
            </span>
            <button
              type="button"
              onClick={() => swipeFolder(1)}
              disabled={folderIndex >= folderOrder.length - 1}
              className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Next folder"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notes grid / loading / empty */}
        {loading ? (
          <SkeletonGrid />
        ) : filteredNotes.length === 0 ? (
          <EmptyState
            hasSearch={!!search.trim()}
            onCreate={() => setComposerOpen(true)}
          />
        ) : (
          <div className="mt-3 columns-3 gap-2 sm:columns-3 sm:gap-3 md:columns-5 md:gap-3 lg:columns-7 xl:columns-9 2xl:columns-11">
            <AnimatePresence initial={false}>
              {filteredNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  folder={folders.find((f) => f.id === note.folderId)}
                  onOpen={handleOpenNote}
                  onPin={handleTogglePin}
                  onDelete={handleDeleteNote}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Editor dialog */}
      <NoteEditor
        note={editorNote}
        folders={folders}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />

      {/* Add folder dialog */}
      <AddFolderDialog
        open={addFolderOpen}
        onOpenChange={setAddFolderOpen}
        onCreated={(f) => {
          setFolders((prev) => [...prev, f]);
          setActiveFolder(f.id);
        }}
      />
    </div>
  );
}

/* ---------------- folder tabs ---------------- */

function FolderTabs({
  folders,
  active,
  onSelect,
  onAdd,
  onDelete,
}: {
  folders: NoteFolder[];
  active: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollSnapType: "x proximity" }}
    >
      <FolderPill
        folderId="all"
        active={active === "all"}
        onClick={() => onSelect("all")}
        icon={<StickyNote className="h-3.5 w-3.5" />}
      >
        All Notes
      </FolderPill>
      {folders.map((f) => (
        <FolderPill
          key={f.id}
          folderId={f.id}
          active={active === f.id}
          onClick={() => onSelect(f.id)}
          color={f.color}
          onDelete={() => onDelete(f.id)}
        >
          {f.name}
        </FolderPill>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-border bg-background px-3.5 py-2 text-xs font-medium text-muted-foreground transition hover:border-amber-400 hover:text-amber-600"
        style={{ scrollSnapAlign: "start" }}
      >
        <FolderPlus className="h-3.5 w-3.5" />
        New folder
      </button>
    </div>
  );
}

function FolderPill({
  folderId,
  active,
  onClick,
  color,
  icon,
  onDelete,
  children,
}: {
  folderId: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  icon?: ReactNode;
  onDelete?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      data-folder-id={folderId}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group flex shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition",
        active
          ? "bg-amber-500 text-white shadow-sm"
          : "border border-border bg-background text-foreground hover:bg-accent"
      )}
      style={{ scrollSnapAlign: "start" }}
    >
      {icon ?? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: active ? "white" : color ?? "#a3a3a3" }}
        />
      )}
      <span>{children}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "-mr-1 ml-0.5 grid h-5 w-5 place-items-center rounded-full transition",
            active
              ? "bg-white/20 text-white hover:bg-white/30"
              : "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          )}
          aria-label="Delete folder"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ---------------- add folder dialog ---------------- */

function AddFolderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (folder: NoteFolder) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(FOLDER_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setColor(FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Folder name is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const f = await api<NoteFolder>("/api/note-folders", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), color }),
      });
      onCreated(f);
      toast({ title: "Folder created", description: f.name });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to create folder", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Organize your notes with a custom folder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            autoFocus
          />
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Pick a color
            </p>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition",
                    color === c
                      ? "scale-110 border-foreground"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- composer ---------------- */

function ComposerCard({
  folders,
  activeFolder,
  open,
  onOpenChange,
  onCreated,
  onUpdated,
}: {
  folders: NoteFolder[];
  activeFolder: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (note: Note) => void;
  onUpdated: (note: Note) => void;
}) {
  const [type, setType] = useState<NoteType>("text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [folderId, setFolderId] = useState<string | null>(
    activeFolder && activeFolder !== "all" && activeFolder !== "none"
      ? activeFolder
      : null
  );
  const [noteId, setNoteId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [drawOpen, setDrawOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Refs holding the latest state so the save timer always reads fresh values
  const stateRef = useLatest({
    title,
    content,
    type,
    color,
    imageData,
    audioData,
    folderId,
  });
  const idRef = useLatest(noteId);
  const onCreatedRef = useLatest(onCreated);
  const onUpdatedRef = useLatest(onUpdated);

  // Sync folderId with activeFolder when user switches tabs
  useEffect(() => {
    setFolderId(
      activeFolder && activeFolder !== "all" && activeFolder !== "none"
        ? activeFolder
        : null
    );
  }, [activeFolder]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const doSave = useCallback(async () => {
    if (savingRef.current) {
      dirtyRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      while (true) {
        dirtyRef.current = false;
        const s = stateRef.current;
        const currentId = idRef.current;

        const isEmpty =
          !s.title.trim() && !s.content.trim() && !s.imageData && !s.audioData;

        if (isEmpty) {
          if (currentId) {
            try {
              await api(`/api/notes/${currentId}`, { method: "DELETE" });
              setNoteId(null);
            } catch (err) {
              console.error(err);
            }
          }
        } else {
          const payload = {
            folderId: s.folderId,
            title: s.title.trim(),
            content: s.content,
            type: s.type,
            color: s.color,
            pinned: false,
            imageData: s.imageData,
            audioData: s.audioData,
          };
          setSaveState("saving");
          try {
            if (!currentId) {
              const created = await api<Note>("/api/notes", {
                method: "POST",
                body: JSON.stringify(payload),
              });
              setNoteId(created.id);
              onCreatedRef.current(created);
            } else {
              const updated = await api<Note>(`/api/notes/${currentId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
              });
              onUpdatedRef.current(updated);
            }
            setSaveState("saved");
            setTimeout(
              () => setSaveState((prev) => (prev === "saved" ? "idle" : prev)),
              1500
            );
          } catch (err) {
            console.error(err);
            setSaveState("error");
          }
        }
        if (!dirtyRef.current) break;
      }
    } finally {
      savingRef.current = false;
    }
  }, []);

  const doSaveRef = useLatest(doSave);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void doSaveRef.current();
    }, 700);
  }, []);

  const clearForm = () => {
    setType("text");
    setTitle("");
    setContent("");
    setImageData(null);
    setAudioData(null);
    setColor(NOTE_COLORS[0]);
    setNoteId(null);
    setSaveState("idle");
  };

  const closeComposer = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await doSaveRef.current();
    clearForm();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
    } else {
      void closeComposer();
    }
  };

  const activeTypeBtn = (t: NoteType) => type === t;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          className="gap-0 overflow-hidden p-0 sm:max-w-lg"
          style={{ borderLeftColor: color, borderLeftWidth: 4 }}
        >
          <DialogHeader className="px-4 pb-0 pt-4">
            <DialogTitle className="text-base">New note</DialogTitle>
          </DialogHeader>
        <div className="space-y-2 px-4 pb-4">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave();
            }}
            placeholder="Title"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
            autoFocus
          />

          {/* Type-specific content */}
          {type === "text" && (
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                scheduleSave();
              }}
              placeholder="Start writing…"
              className="min-h-[64px] w-full resize-none bg-transparent text-sm leading-snug outline-none placeholder:text-muted-foreground"
            />
          )}

          {type === "image" && (
            <div className="space-y-2">
              {imageData ? (
                <div className="relative">
                  <img
                    src={imageData}
                    alt=""
                    className="max-h-64 w-full rounded-md border border-border object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition hover:opacity-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      Replace
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setImageData(null);
                        scheduleSave();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-sm text-muted-foreground transition hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-700"
                >
                  <ImageIcon className="h-4 w-4" />
                  <span>Click to upload image</span>
                </button>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const d = await readFileAsDataURL(f);
                    setImageData(d);
                    setType("image");
                    scheduleSave();
                  }
                  e.target.value = "";
                }}
              />
              <input
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  scheduleSave();
                }}
                placeholder="Add a caption…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          {type === "draw" && (
            <div className="space-y-2">
              {imageData ? (
                <img
                  src={imageData}
                  alt=""
                  className="w-full rounded-md border border-border"
                />
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDrawOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                {imageData ? "Edit drawing" : "Open canvas"}
              </Button>
              <input
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  scheduleSave();
                }}
                placeholder="Add a caption…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          {type === "voice" && (
            <div className="space-y-2">
              {audioData && <VoicePlayer src={audioData} />}
              <VoiceRecorder
                onComplete={(d) => {
                  setAudioData(d);
                  scheduleSave();
                }}
              />
              <input
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  scheduleSave();
                }}
                placeholder="Transcript or note…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Color picker */}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  scheduleSave();
                }}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition",
                  color === c
                    ? "scale-110 border-foreground"
                    : "border-transparent"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>

          {/* Folder selector + actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-0.5">
              <ComposerTypeButton
                active={activeTypeBtn("text")}
                onClick={() => {
                  setType("text");
                  scheduleSave();
                }}
                icon={Type}
                label="Text"
              />
              <ComposerTypeButton
                active={activeTypeBtn("image")}
                onClick={() => {
                  setType("image");
                  scheduleSave();
                }}
                icon={ImageIcon}
                label="Image"
              />
              <ComposerTypeButton
                active={activeTypeBtn("draw")}
                onClick={() => setDrawOpen(true)}
                icon={Pencil}
                label="Draw"
              />
              <ComposerTypeButton
                active={activeTypeBtn("voice")}
                onClick={() => {
                  setType("voice");
                  scheduleSave();
                }}
                icon={Mic}
                label="Voice"
              />
            </div>

            <Select
              value={folderId ?? "__none"}
              onValueChange={(v) => {
                setFolderId(v === "__none" ? null : v);
                scheduleSave();
              }}
            >
              <SelectTrigger className="h-8 w-[140px]" size="sm">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No folder</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: f.color }}
                      />
                      {f.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <SaveIndicator state={saveState} />
              <Button
                size="sm"
                onClick={closeComposer}
                className="bg-amber-500 text-white hover:bg-amber-600"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
        </DialogContent>
      </Dialog>

      {/* Drawing canvas dialog */}
      <Dialog open={drawOpen} onOpenChange={setDrawOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sketch a drawing</DialogTitle>
            <DialogDescription>
              Draw with your finger or mouse. Save to attach to the note.
            </DialogDescription>
          </DialogHeader>
          <DrawingCanvas
            key="composer"
            initialDataUrl={imageData}
            height={320}
            onSave={(d) => {
              setImageData(d);
              setType("draw");
              setDrawOpen(false);
              scheduleSave();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ComposerTypeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Type;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-full transition",
        active
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ---------------- note card ---------------- */

function NoteCard({
  note,
  folder,
  onOpen,
  onPin,
  onDelete,
}: {
  note: Note;
  folder?: NoteFolder;
  onOpen: (note: Note) => void;
  onPin: (note: Note) => void;
  onDelete: (note: Note) => void;
}) {
  const hasMedia =
    (note.type === "image" || note.type === "draw") && note.imageData;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className="mb-2 break-inside-avoid sm:mb-3"
    >
      <div
        onClick={() => onOpen(note)}
        className="group relative cursor-pointer overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
      >
        {/* Color accent stripe */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: note.color }}
        />

        {/* Hover actions */}
        <div className="absolute right-1.5 top-2 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPin(note);
            }}
            className="grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-accent hover:text-foreground"
            aria-label={note.pinned ? "Unpin" : "Pin"}
          >
            <Pin
              className={cn(
                "h-3 w-3",
                note.pinned
                  ? "fill-amber-500 text-amber-500"
                  : ""
              )}
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note);
            }}
            className="grid h-6 w-6 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-destructive hover:text-white"
            aria-label="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Pinned indicator (always visible if pinned) */}
        {note.pinned && (
          <div className="absolute left-1.5 top-2 z-10">
            <Pin className="h-3 w-3 fill-amber-500 text-amber-500 drop-shadow-sm" />
          </div>
        )}

        <div className={cn("p-2 sm:p-2.5", note.pinned && "pl-5")}>
          {/* Image / draw thumbnail */}
          {hasMedia && (
            <img
              src={note.imageData!}
              alt=""
              className="-m-0.5 mb-1.5 max-h-40 w-[calc(100%+0.25rem)] rounded-md object-cover sm:max-h-52"
            />
          )}

          {/* Voice preview */}
          {note.type === "voice" && note.audioData && (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-rose-50/70 px-1.5 py-1 dark:bg-rose-950/20">
              <Mic className="h-3 w-3 shrink-0 text-rose-500" />
              <div className="flex h-3 flex-1 items-center gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 shrink-0 rounded-full bg-rose-400"
                    style={{
                      height: `${3 + Math.abs(Math.sin(i * 1.7)) * 7}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          {note.title && (
            <h3 className="line-clamp-2 pr-5 text-xs font-semibold leading-tight sm:text-sm">
              {note.title}
            </h3>
          )}

          {/* Content */}
          {note.content && (
            <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {note.content}
            </p>
          )}

          {/* Footer: type badge + folder + time */}
          <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-muted-foreground sm:text-[10px]">
            <NoteTypeBadge type={note.type} />
            {folder && (
              <span className="inline-flex min-w-0 items-center">
                <FolderIcon className="mr-0.5 h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </span>
            )}
            <span className="ml-auto flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(note.updatedAt)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- skeleton & empty state ---------------- */

function SkeletonGrid() {
  return (
    <div className="columns-3 gap-2 sm:columns-3 sm:gap-3 md:columns-5 md:gap-3 lg:columns-7 xl:columns-9 2xl:columns-11">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="mb-2 break-inside-avoid sm:mb-3">
          <Skeleton
            className="rounded-lg border border-border/50"
            style={{ height: `${96 + (i % 4) * 28}px` }}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasSearch,
  onCreate,
}: {
  hasSearch: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/70 bg-card/50 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        <StickyNote className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-semibold">
        {hasSearch ? "No matching notes" : "No notes yet"}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasSearch
          ? "Try a different search term or clear the search to see all notes."
          : "Capture a thought, sketch an idea, or record a voice note — it saves automatically."}
      </p>
      {!hasSearch && (
        <Button
          onClick={onCreate}
          className="mt-4 bg-amber-500 text-white hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" />
          Take a note
        </Button>
      )}
    </div>
  );
}
