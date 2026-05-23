import { useState } from "react";
import Layout from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListDocuments, useCreateDocument, useDeleteDocument, useToggleDocumentStar,
  useGetRecentDocuments, useRequestUploadUrl,
  getListDocumentsQueryKey, getGetRecentDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Search, Star, Trash2, Plus, Upload, File, FileImage, FileVideo, FileSpreadsheet, Archive, Link as LinkIcon, ExternalLink, Download } from "lucide-react";

function detectTypeFromName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "docx";
  if (["xls", "xlsx", "csv"].includes(ext)) return "xlsx";
  if (["ppt", "pptx"].includes(ext)) return "pptx";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv"].includes(ext)) return "video";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "zip";
  return "other";
}

function fileTypeIcon(type: string) {
  switch (type) {
    case "pdf": return <FileText className="w-5 h-5 text-red-500" />;
    case "docx": return <FileText className="w-5 h-5 text-blue-500" />;
    case "xlsx": return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    case "image": return <FileImage className="w-5 h-5 text-violet-500" />;
    case "video": return <FileVideo className="w-5 h-5 text-orange-500" />;
    case "zip": return <Archive className="w-5 h-5 text-amber-500" />;
    default: return <File className="w-5 h-5 text-slate-400" />;
  }
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CreateDocumentDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createDocument = useCreateDocument();
  const requestUploadUrl = useRequestUploadUrl();

  const reset = () => {
    setFile(null); setName(""); setUrl(""); setDescription("");
    setMode("file"); setUploading(false);
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentDocumentsQueryKey() });
  };

  const handleSubmit = async () => {
    try {
      if (mode === "file") {
        if (!file) { toast({ title: "Please choose a file", variant: "destructive" }); return; }
        setUploading(true);
        const presign = await requestUploadUrl.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" } as any,
        });
        const { uploadURL, objectPath } = presign as any;
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload failed");
        await createDocument.mutateAsync({
          data: {
            name: name.trim() || file.name,
            type: detectTypeFromName(file.name),
            objectPath,
            size: file.size,
            description: description.trim() || null,
          } as any,
        });
        toast({ title: "File uploaded" });
      } else {
        if (!url.trim()) { toast({ title: "Please paste a link", variant: "destructive" }); return; }
        try { new URL(url.trim()); } catch { toast({ title: "Invalid URL", variant: "destructive" }); return; }
        await createDocument.mutateAsync({
          data: {
            name: name.trim() || url.trim(),
            type: "other",
            url: url.trim(),
            description: description.trim() || null,
          } as any,
        });
        toast({ title: "Link added" });
      }
      refresh();
      reset();
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Failed to add document", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button data-testid="create-document-button">
          <Plus className="w-4 h-4 mr-2" /> Add Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "file" | "link")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="file"><Upload className="w-4 h-4 mr-2" /> Upload File</TabsTrigger>
            <TabsTrigger value="link"><LinkIcon className="w-4 h-4 mr-2" /> External Link</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium block mb-2">File</label>
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !name) setName(f.name);
                }}
                data-testid="input-document-file"
              />
              {file && (
                <p className="text-xs text-muted-foreground mt-1">
                  {file.name} — {formatSize(file.size)}
                </p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="link" className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium block mb-2">URL</label>
              <Input
                type="url"
                placeholder="https://drive.google.com/... or https://notion.so/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                data-testid="input-document-url"
              />
            </div>
          </TabsContent>
        </Tabs>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Name {mode === "link" && <span className="text-muted-foreground font-normal">(optional)</span>}</label>
            <Input
              placeholder={mode === "file" ? "Display name" : "Link title"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-document-name"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-2">Description</label>
            <Textarea
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={uploading || createDocument.isPending || requestUploadUrl.isPending}
            data-testid="submit-create-document"
          >
            {uploading ? "Uploading..." : mode === "file" ? "Upload" : "Add Link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [starred, setStarred] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteDocument = useDeleteDocument();
  const toggleStar = useToggleDocumentStar();

  const params = { search: search || undefined, starred: starred || undefined };
  const { data: documents, isLoading } = useListDocuments(params, {
    query: { queryKey: getListDocumentsQueryKey(params) }
  });
  const { data: recent } = useGetRecentDocuments({
    query: { queryKey: getGetRecentDocumentsQueryKey() }
  });

  const handleDelete = (id: number) => {
    deleteDocument.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        toast({ title: "Document deleted" });
      },
    });
  };

  const handleToggleStar = (id: number) => {
    toggleStar.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() }),
    });
  };

  return (
    <Layout title="Documents">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Recent */}
        {(recent as any[])?.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recently Added</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {((recent as any[]) ?? []).slice(0, 6).map((doc: any) => (
                <div
                  key={doc.id}
                  data-testid={`recent-doc-${doc.id}`}
                  className="flex-shrink-0 w-36 p-3 bg-card border border-border rounded-lg"
                >
                  <div className="mb-2">{fileTypeIcon(doc.type)}</div>
                  <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.type.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search & filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
              data-testid="search-documents"
            />
          </div>
          <Button
            variant={starred ? "default" : "outline"}
            onClick={() => setStarred(!starred)}
            data-testid="filter-starred"
          >
            <Star className="w-4 h-4 mr-2" />
            Starred
          </Button>
          <CreateDocumentDialog />
        </div>

        {/* Document list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : (documents as any[])?.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No documents found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {((documents as any[]) ?? []).map((doc: any) => {
              const openHref = doc.url ?? (doc.objectPath ? `/api/storage${doc.objectPath}` : null);
              const isLink = !!doc.url;
              return (
              <Card key={doc.id} data-testid={`document-row-${doc.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">{isLink ? <LinkIcon className="w-5 h-5 text-sky-500" /> : fileTypeIcon(doc.type)}</div>
                    <div className="flex-1 min-w-0">
                      {openHref ? (
                        <a
                          href={openHref}
                          target={isLink ? "_blank" : undefined}
                          rel={isLink ? "noopener noreferrer" : undefined}
                          download={!isLink ? doc.name : undefined}
                          className="text-sm font-medium text-foreground truncate hover:text-primary hover:underline block"
                          data-testid={`open-document-${doc.id}`}
                        >
                          {doc.name}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{isLink ? "LINK" : doc.type.toUpperCase()}</Badge>
                        {!isLink && <span className="text-xs text-muted-foreground">{formatSize(doc.size)}</span>}
                        {doc.uploaderName && (
                          <span className="text-xs text-muted-foreground hidden sm:block">by {doc.uploaderName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {openHref && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          asChild
                        >
                          <a
                            href={openHref}
                            target={isLink ? "_blank" : undefined}
                            rel={isLink ? "noopener noreferrer" : undefined}
                            download={!isLink ? doc.name : undefined}
                          >
                            {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${doc.starred ? "text-amber-500" : "text-muted-foreground"}`}
                        data-testid={`star-document-${doc.id}`}
                        onClick={() => handleToggleStar(doc.id)}
                      >
                        <Star className={`w-4 h-4 ${doc.starred ? "fill-current" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        data-testid={`delete-document-${doc.id}`}
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
