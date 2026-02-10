"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FolderIcon,
  FolderOpen,
  FileIcon,
  ChevronRight,
  ArrowLeft,
  HardDrive,
  Loader2,
  RefreshCw,
  Home,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";

type FolderItem = {
  name: string;
  prefix: string;
  relativePath: string;
};

type FileItem = {
  key: string;
  name: string;
  size: number;
  lastModified: string | undefined;
  relativePath: string;
};

type FolderData = {
  folders: FolderItem[];
  files: FileItem[];
  currentPrefix: string;
  orgPrefix: string;
  hasMore: boolean;
  nextToken?: string;
};

export function FolderTree() {
  const [breadcrumb, setBreadcrumb] = useState<
    Array<{ label: string; prefix: string }>
  >([{ label: "Root", prefix: "" }]);
  const [currentData, setCurrentData] = useState<FolderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchFolder = useCallback(async (prefix: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (prefix) params.set("prefix", prefix);

      const res = await fetch(`/api/files/folders?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load folders");
      }

      setCurrentData(json.data);
      setInitialLoaded(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load folder structure"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadRoot = () => {
    setBreadcrumb([{ label: "Root", prefix: "" }]);
    fetchFolder("");
  };

  const handleNavigate = (folder: FolderItem) => {
    setBreadcrumb((prev) => [
      ...prev,
      { label: folder.name, prefix: folder.relativePath },
    ]);
    fetchFolder(folder.relativePath);
  };

  const handleBreadcrumbNav = (index: number) => {
    const target = breadcrumb[index];
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    fetchFolder(target.prefix);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name cannot be empty");
      return;
    }

    // Validate folder name (no slashes, special characters)
    if (!/^[a-zA-Z0-9-_ ]+$/.test(newFolderName)) {
      toast.error("Folder name can only contain letters, numbers, spaces, hyphens, and underscores");
      return;
    }

    setCreating(true);
    try {
      const currentPrefix = breadcrumb[breadcrumb.length - 1].prefix;
      const folderPath = currentPrefix ? `${currentPrefix}/${newFolderName}` : newFolderName;

      const res = await fetch("/api/files/create-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to create folder");
      }

      toast.success(`Folder "${newFolderName}" created successfully`);
      setIsCreateDialogOpen(false);
      setNewFolderName("");

      // Refresh current folder view
      await fetchFolder(currentPrefix);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create folder"
      );
    } finally {
      setCreating(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string | undefined) => {
    if (!iso) return "--";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!initialLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <HardDrive className="h-10 w-10 text-muted-foreground/50" />
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">
            S3 Storage Browser
          </p>
          <p className="text-xs text-muted-foreground">
            Browse the generated folder structure in your S3 bucket
          </p>
        </div>
        <Button onClick={handleLoadRoot} disabled={loading} variant="outline">
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4 mr-2" />
          )}
          Load Directory Tree
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 flex-wrap text-sm">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <button
              onClick={() => handleBreadcrumbNav(i)}
              className={`px-1.5 py-0.5 rounded hover:bg-muted transition-colors ${
                i === breadcrumb.length - 1
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {i === 0 ? (
                <span className="flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" />
                  Root
                </span>
              ) : (
                crumb.label
              )}
            </button>
          </span>
        ))}

        <div className="ml-auto flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>
                  Create a new folder in {breadcrumb[breadcrumb.length - 1].label === "Root" ? "the root directory" : breadcrumb[breadcrumb.length - 1].label}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label htmlFor="folder-name" className="text-sm font-medium">
                    Folder Name
                  </label>
                  <Input
                    id="folder-name"
                    placeholder="Enter folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !creating) {
                        handleCreateFolder();
                      }
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Use letters, numbers, spaces, hyphens, and underscores only
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setNewFolderName("");
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || creating}
                >
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Folder
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchFolder(breadcrumb[breadcrumb.length - 1].prefix)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {loading && !currentData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : currentData ? (
        <div className="rounded-lg border overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground">
            <div className="col-span-6">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-2">Modified</div>
          </div>

          {/* Back button if not at root */}
          {breadcrumb.length > 1 && (
            <div
              className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2.5 border-t items-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleBreadcrumbNav(breadcrumb.length - 2)}
            >
              <div className="md:col-span-6 flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
                <span>..</span>
              </div>
              <div className="md:col-span-2">
                <Badge variant="outline" className="text-xs">
                  Parent
                </Badge>
              </div>
              <div className="md:col-span-2" />
              <div className="md:col-span-2" />
            </div>
          )}

          {/* Folders */}
          {currentData.folders.map((folder) => (
            <div
              key={folder.prefix}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2.5 border-t items-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleNavigate(folder)}
            >
              <div className="md:col-span-6 flex items-center gap-2 min-w-0">
                <FolderIcon className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium truncate">
                  {folder.name}
                </span>
              </div>
              <div className="md:col-span-2">
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30"
                >
                  Folder
                </Badge>
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                --
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                --
              </div>
            </div>
          ))}

          {/* Files */}
          {currentData.files.map((file) => (
            <div
              key={file.key}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-2.5 border-t items-center"
            >
              <div className="md:col-span-6 flex items-center gap-2 min-w-0">
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
              </div>
              <div className="md:col-span-2">
                <Badge variant="outline" className="text-xs">
                  File
                </Badge>
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                {formatSize(file.size)}
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                {formatDate(file.lastModified)}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {currentData.folders.length === 0 &&
            currentData.files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center border-t">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  This folder is empty
                </p>
              </div>
            )}

          {/* Load more */}
          {currentData.hasMore && (
            <div className="flex justify-center py-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  fetchFolder(breadcrumb[breadcrumb.length - 1].prefix)
                }
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
