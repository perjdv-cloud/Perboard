// Shared types for the Notes, Files & Finance app

export type NoteType = "text" | "image" | "draw" | "voice";

export interface NoteFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  folderId: string | null;
  title: string;
  content: string;
  type: NoteType;
  color: string;
  pinned: boolean;
  imageData: string | null;
  audioData: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FileType = "image" | "document" | "pdf" | "excel";

export interface FileFolder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileItem {
  id: string;
  folderId: string | null;
  name: string;
  type: FileType;
  mimeType: string;
  data: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  account: string;
  amount: number;
  description: string;
  category: string;
  imageData: string | null;
  imageData2: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export type SortKey = "recent" | "date" | "month" | "type";

export const NOTE_COLORS = [
  "#fef3c7", // amber-100
  "#fce7f3", // pink-100
  "#dbeafe", // blue-100
  "#dcfce7", // green-100
  "#ede9fe", // violet-100
  "#ffedd5", // orange-100
  "#cffafe", // cyan-100
];

export const FOLDER_COLORS = [
  "#f5d5b0",
  "#fbcfe8",
  "#bfdbfe",
  "#bbf7d0",
  "#ddd6fe",
  "#fed7aa",
  "#a5f3fc",
];
