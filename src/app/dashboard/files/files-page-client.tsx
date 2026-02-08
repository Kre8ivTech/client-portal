"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/files/file-upload";
import { FileList } from "@/components/files/file-list";
import { FolderTree } from "@/components/files/folder-tree";

interface FilesPageClientProps {
  awsConfigured: boolean;
}

export function FilesPageClient({ awsConfigured }: FilesPageClientProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = () => {
    setRefreshKey((k: number) => k + 1);
  };

  if (!awsConfigured) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        File uploads are unavailable until AWS S3 is configured.
      </p>
    );
  }

  return (
    <Tabs defaultValue="browse" className="space-y-4">
      <TabsList>
        <TabsTrigger value="browse">Browse</TabsTrigger>
        <TabsTrigger value="folders">Folders</TabsTrigger>
        <TabsTrigger value="upload">Upload</TabsTrigger>
      </TabsList>

      <TabsContent value="browse">
        <FileList refreshKey={refreshKey} />
      </TabsContent>

      <TabsContent value="folders">
        <FolderTree />
      </TabsContent>

      <TabsContent value="upload">
        <FileUpload onUploadComplete={handleUploadComplete} />
      </TabsContent>
    </Tabs>
  );
}
