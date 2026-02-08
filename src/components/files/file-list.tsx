"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  FileIcon,
  Download,
  Trash2,
  Search,
  Loader2,
  FolderIcon,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type FileRecord = {
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  source_provider: string;
  s3_key: string;
  created_at: string;
  owner_user_id: string | null;
  folder: string | null;
};

interface FileListProps {
  refreshKey?: number;
}

export function FileList({ refreshKey }: FileListProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/files?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load files");
      }

      setFiles(json.data ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load files"
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  const handleDownload = async (fileId: string, fileName: string) => {
    setActionLoading(`download:${fileId}`);
    try {
      const res = await fetch(`/api/files/${fileId}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to get download URL");
      }

      // Open presigned URL in new tab
      window.open(json.data.downloadUrl, "_blank");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Download failed"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (fileId: string) => {
    setActionLoading(`delete:${fileId}`);
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete file");
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("File deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Delete failed"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getFileTypeLabel = (mimeType: string | null) => {
    if (!mimeType) return "File";
    if (mimeType.startsWith("image/")) return "Image";
    if (mimeType === "application/pdf") return "PDF";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
      return "Spreadsheet";
    if (mimeType.includes("document") || mimeType.includes("word"))
      return "Document";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
      return "Presentation";
    if (mimeType.startsWith("text/")) return "Text";
    if (mimeType.includes("zip") || mimeType.includes("gzip"))
      return "Archive";
    return "File";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFiles}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>All files are encrypted at rest with AES-256 server-side encryption</span>
      </div>

      {loading && files.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? "No files match your search"
              : "No files uploaded yet"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-xs font-semibold">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-1">Size</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {files.map((file) => (
            <div
              key={file.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 border-t items-center"
            >
              <div className="md:col-span-5 flex items-center gap-2 min-w-0">
                <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  {file.folder && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderIcon className="h-3 w-3" />
                      <span className="truncate">{file.folder}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <Badge variant="outline" className="text-xs">
                  {getFileTypeLabel(file.mime_type)}
                </Badge>
              </div>
              <div className="md:col-span-1 text-sm text-muted-foreground">
                {formatSize(file.size_bytes)}
              </div>
              <div className="md:col-span-2 text-sm text-muted-foreground">
                {formatDate(file.created_at)}
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file.id, file.name)}
                  disabled={actionLoading === `download:${file.id}`}
                  aria-label={`Download ${file.name}`}
                >
                  {actionLoading === `download:${file.id}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === `delete:${file.id}`}
                      aria-label={`Delete ${file.name}`}
                    >
                      {actionLoading === `delete:${file.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete file</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &quot;{file.name}
                        &quot;? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(file.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
