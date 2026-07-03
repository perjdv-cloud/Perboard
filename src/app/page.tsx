"use client";

import { useState } from "react";
import { StickyNote, FolderOpen, Wallet, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NotesTab from "@/components/notes/NotesTab";
import FilesTab from "@/components/files/FilesTab";
import FinanceTab from "@/components/finance/FinanceTab";

export default function Home() {
  const [tab, setTab] = useState("notes");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-amber-50/40 via-background to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                  Organize
                </h1>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  Notes · Files · Finance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700 sm:inline dark:bg-amber-950/60 dark:text-amber-300">
                Auto-save on
              </span>
            </div>
          </div>
          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-lg bg-muted p-1">
              <TabsTrigger
                value="notes"
                className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <StickyNote className="h-4 w-4" />
                <span className="hidden sm:inline">Notes</span>
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <FolderOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger
                value="finance"
                className="flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Finance</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="notes" className="mt-0 focus-visible:outline-none">
            <NotesTab />
          </TabsContent>
          <TabsContent value="files" className="mt-0 focus-visible:outline-none">
            <FilesTab />
          </TabsContent>
          <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
            <FinanceTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            <span className="font-medium text-foreground">Organize</span> — your
            notes, files &amp; finances in one place
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Changes save automatically
          </p>
        </div>
      </footer>
    </div>
  );
}
