"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "@/lib/validators/file";

interface FileUploadProps {
  folder?: string;
  onUploadComplete?: () => void;
}

export function FileUpload({ folder, onUploadComplete }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptTypes = (ALLOWED_MIME_TYPES as readonly string[]).join(",");

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "File must be 50 MB or smaller";
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return "File type not allowed";
    }
    return null;
  };

  const handleFileSelect = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        return;
      }
      setSelectedFile(file);
    },
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (folder) formData.append("folder", folder);

      const res = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Upload failed");
      }

      toast.success(`${selectedFile.name} uploaded`);
      clearFile();
      onUploadComplete?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`
          flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed
          rounded-lg cursor-pointer transition-colors
          ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
          ${uploading ? "pointer-events-none opacity-50" : ""}
        `}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag and drop a file here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          Max 50 MB. Documents, images, and archives.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptTypes}
        onChange={handleInputChange}
        disabled={uploading}
        aria-label="Select file to upload"
        title="Select file to upload"
      />

      {selectedFile && (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
          <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatSize(selectedFile.size)}
            </p>
          </div>
          {!uploading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                clearFile();
              }}
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {selectedFile && (
        <div className="flex justify-end">
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      )}
    </div>
  );
}
