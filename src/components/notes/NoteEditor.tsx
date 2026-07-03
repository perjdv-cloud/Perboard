"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { motion } from "framer-motion";
import {
  Pin,
  Trash2,
  Type,
  Image as ImageIcon,
  Pencil,
  Mic,
  Square,
  Eraser,
  Loader2,
  Check,
  AlertCircle,
  Play,
  Pause,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/alert-dialog";

import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { api, readFileAsDataURL, formatDateTime } from "@/lib/api";
import { NOTE_COLORS, type Note, type NoteFolder, type NoteType } from "@/lib/types";

/* ---------------- helpers ---------------- */

/** Keep a ref always pointing to the latest value of `value`, without
 * writing to it during render (React 19 disallows that). */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ---------------- shared sub-components ---------------- */

export const NOTE_TYPE_OPTIONS: {
  value: NoteType;
  label: string;
  icon: typeof Type;
}[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "draw", label: "Draw", icon: Pencil },
  { value: "voice", label: "Voice", icon: Mic },
];

export function NoteTypeBadge({
  type,
  className,
}: {
  type: NoteType;
  className?: string;
}) {
  const opt = NOTE_TYPE_OPTIONS.find((o) => o.value === type) ?? NOTE_TYPE_OPTIONS[0];
  const Icon = opt.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="capitalize">{opt.label}</span>
    </span>
  );
}

export function NoteTypeSelector({
  value,
  onChange,
}: {
  value: NoteType;
  onChange: (v: NoteType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
      {NOTE_TYPE_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function NoteColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "h-6 w-6 rounded-full border-2 transition",
            value === c ? "scale-110 border-foreground" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}

const BRUSH_COLORS = [
  "#1c1917",
  "#dc2626",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
];

export function DrawingCanvas({
  initialDataUrl,
  onSave,
  className,
  height = 260,
  compact = false,
}: {
  initialDataUrl?: string | null;
  onSave?: (dataUrl: string) => void;
  className?: string;
  height?: number;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const initialRef = useRef<string | null | undefined>(undefined);
  const [color, setColor] = useState(BRUSH_COLORS[0]);
  const [size] = useState(3);
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, height);
    ctxRef.current = ctx;

    const initial =
      initialRef.current === undefined ? initialDataUrl : initialRef.current;
    initialRef.current = initialDataUrl;
    if (initial) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, height);
      };
      img.src = initial;
    }
  }, [height]);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPtRef.current = getPos(e);
    try {
      canvasRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const pt = getPos(e);
    const last = lastPtRef.current ?? pt;
    ctx.strokeStyle = eraser ? "#ffffff" : color;
    ctx.lineWidth = eraser ? size * 5 : size;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
  };

  const end = (e: React.PointerEvent) => {
    drawingRef.current = false;
    lastPtRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave?.(dataUrl);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ touchAction: "none", height: `${height}px` }}
        className="w-full rounded-md border border-border bg-white"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {!compact && (
          <div className="flex items-center gap-1">
            {BRUSH_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setEraser(false);
                }}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition",
                  !eraser && color === c
                    ? "scale-110 border-foreground"
                    : "border-transparent"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Brush color ${c}`}
              />
            ))}
          </div>
        )}
        <Button
          type="button"
          variant={eraser ? "default" : "outline"}
          size="sm"
          onClick={() => setEraser(!eraser)}
        >
          <Eraser className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Eraser</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
        {onSave && (
          <Button
            type="button"
            size="sm"
            onClick={save}
            className="ml-auto bg-amber-500 text-white hover:bg-amber-600"
          >
            <Check className="h-3.5 w-3.5" />
            Save drawing
          </Button>
        )}
      </div>
    </div>
  );
}

export function VoiceRecorder({
  onComplete,
}: {
  onComplete: (dataUrl: string, durationSec: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);
  const onCompleteRef = useLatest(onComplete);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser.");
      toast({
        title: "Recording unsupported",
        description: "Your browser does not support microphone access.",
        variant: "destructive",
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        try {
          const dataUrl = await blobToDataUrl(blob);
          onCompleteRef.current(dataUrl, elapsedRef.current);
        } catch (err) {
          console.error(err);
          toast({
            title: "Failed to encode recording",
            variant: "destructive",
          });
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError("Microphone access denied. Please allow mic access in your browser.");
      toast({
        title: "Microphone unavailable",
        description: "Please allow mic access to record voice notes.",
        variant: "destructive",
      });
    }
  };

  const stop = () => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {!recording ? (
          <Button
            type="button"
            onClick={start}
            variant="outline"
            size="sm"
            className="border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <Mic className="h-4 w-4" /> Record
          </Button>
        ) : (
          <Button type="button" onClick={stop} variant="destructive" size="sm">
            <Square className="h-4 w-4" /> Stop {formatDuration(elapsed)}
          </Button>
        )}
        {recording && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            Recording…
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ImageUploader({
  value,
  onChange,
  className,
}: {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      onChange(dataUrl);
    } catch (err) {
      console.error(err);
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="group relative overflow-hidden rounded-md border border-border">
          <img
            src={value}
            alt="Note attachment"
            className="max-h-72 w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border text-sm text-muted-foreground transition hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-700"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImageIcon className="h-5 w-5" />
          )}
          <span>{loading ? "Loading…" : "Click to upload image"}</span>
        </button>
      )}
    </div>
  );
}

export function VoicePlayer({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onMeta = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const progress = duration ? current / duration : 0;
  const bars = 28;
  const activeBars = Math.floor(progress * bars);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg bg-muted/60 p-3",
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500 text-white shadow-sm transition hover:bg-rose-600"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-0.5" />
        )}
      </button>
      <div className="flex flex-1 items-center gap-0.5 overflow-hidden">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-0.5 shrink-0 rounded-full transition-colors",
              i < activeBars ? "bg-rose-500" : "bg-foreground/20"
            )}
            style={{ height: `${6 + Math.abs(Math.sin(i * 1.7)) * 14}px` }}
          />
        ))}
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {formatDuration(current)}
        {" / "}
        {duration ? formatDuration(duration) : "--:--"}
      </span>
    </div>
  );
}

/* ---------------- save indicator ---------------- */

export type SaveState = "idle" | "saving" | "saved" | "error";

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-emerald-600">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] text-destructive">
        <AlertCircle className="h-3 w-3" />
        Error
      </span>
    );
  }
  return null;
}

/* ---------------- NoteEditor dialog ---------------- */

export interface NoteEditorProps {
  note: Note | null;
  folders: NoteFolder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (note: Note) => void;
  onDeleted: (id: string) => void;
}

export default function NoteEditor({
  note,
  folders,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: NoteEditorProps) {
  const [draft, setDraft] = useState<Note | null>(note);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);

  const draftRef = useLatest(draft);
  const onSavedRef = useLatest(onSaved);

  // Reset draft when note id changes
  const lastNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = note?.id ?? null;
    if (id !== lastNoteIdRef.current) {
      lastNoteIdRef.current = id;
      setDraft(note);
      setSaveState("idle");
    }
  }, [note]);

  const doSave = useCallback(async () => {
    if (savingRef.current) {
      dirtyRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      while (true) {
        dirtyRef.current = false;
        const d = draftRef.current;
        if (!d) break;

        setSaveState("saving");
        try {
          const updated = await api<Note>(`/api/notes/${d.id}`, {
            method: "PUT",
            body: JSON.stringify({
              title: d.title,
              content: d.content,
              type: d.type,
              color: d.color,
              pinned: d.pinned,
              folderId: d.folderId,
              imageData: d.imageData,
              audioData: d.audioData,
            }),
          });
          setSaveState("saved");
          onSavedRef.current(updated);
          setTimeout(
            () => setSaveState((prev) => (prev === "saved" ? "idle" : prev)),
            1500
          );
        } catch (err) {
          console.error(err);
          setSaveState("error");
          toast({ title: "Failed to save note", variant: "destructive" });
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

  // Flush save on close
  useEffect(() => {
    if (!open) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (draftRef.current) {
        void doSaveRef.current();
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const update = (patch: Partial<Note>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      // Schedule the debounced save; draftRef is updated via useEffect.
      scheduleSave();
      return next;
    });
  };

  const handleDelete = async () => {
    if (!draft) return;
    try {
      await api(`/api/notes/${draft.id}`, { method: "DELETE" });
      onDeleted(draft.id);
      toast({ title: "Note deleted" });
      setDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to delete note", variant: "destructive" });
    }
  };

  if (!draft) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No note selected</DialogTitle>
            <DialogDescription>Pick a note from the grid to edit.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const folderName = folders.find((f) => f.id === draft.folderId)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">Edit note</DialogTitle>
        {/* Color stripe */}
        <div className="h-1.5 w-full" style={{ backgroundColor: draft.color }} />
        <div className="flex max-h-[calc(92vh-1.5rem)] flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <NoteTypeBadge type={draft.type} />
              {draft.pinned && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-100/60 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <Pin className="mr-1 h-3 w-3 fill-amber-500 text-amber-500" />
                  Pinned
                </Badge>
              )}
              {folderName && (
                <span className="hidden text-[10px] text-muted-foreground sm:inline">
                  in {folderName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <SaveIndicator state={saveState} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => update({ pinned: !draft.pinned })}
                aria-label={draft.pinned ? "Unpin note" : "Pin note"}
              >
                {draft.pinned ? (
                  <Pin className="h-4 w-4 fill-amber-500 text-amber-500" />
                ) : (
                  <Pin className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete note"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              {/* Folder + color */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Folder</span>
                  <Select
                    value={draft.folderId ?? "__none"}
                    onValueChange={(v) =>
                      update({ folderId: v === "__none" ? null : v })
                    }
                  >
                    <SelectTrigger className="h-8 w-[160px]" size="sm">
                      <SelectValue />
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
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Color</span>
                  <NoteColorPicker
                    value={draft.color}
                    onChange={(c) => update({ color: c })}
                  />
                </div>
              </div>

              {/* Type selector */}
              <NoteTypeSelector
                value={draft.type}
                onChange={(t) => update({ type: t })}
              />

              {/* Title */}
              <Input
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Title"
                className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
              />

              {/* Type-specific content */}
              {draft.type === "text" && (
                <Textarea
                  value={draft.content}
                  onChange={(e) => update({ content: e.target.value })}
                  placeholder="Start writing…"
                  className="min-h-[180px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
                />
              )}

              {draft.type === "image" && (
                <div className="space-y-3">
                  <ImageUploader
                    value={draft.imageData}
                    onChange={(d) => update({ imageData: d })}
                  />
                  <Textarea
                    value={draft.content}
                    onChange={(e) => update({ content: e.target.value })}
                    placeholder="Add a caption…"
                    className="min-h-[60px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              )}

              {draft.type === "draw" && (
                <div className="space-y-3">
                  <DrawingCanvas
                    key={draft.id}
                    initialDataUrl={draft.imageData}
                    onSave={(d) => update({ imageData: d })}
                  />
                  <Textarea
                    value={draft.content}
                    onChange={(e) => update({ content: e.target.value })}
                    placeholder="Add a note about your drawing…"
                    className="min-h-[60px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              )}

              {draft.type === "voice" && (
                <div className="space-y-3">
                  {draft.audioData && <VoicePlayer src={draft.audioData} />}
                  <VoiceRecorder
                    onComplete={(d) => update({ audioData: d })}
                  />
                  <Textarea
                    value={draft.content}
                    onChange={(e) => update({ content: e.target.value })}
                    placeholder="Transcript or note…"
                    className="min-h-[60px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-[10px] text-muted-foreground">
            <span>Updated {formatDateTime(draft.updatedAt)}</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Auto-save on
            </span>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action can&apos;t be undone. The note will be permanently
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
    </Dialog>
  );
}

/* ---------------- small wrappers ---------------- */

export function MotionFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}
