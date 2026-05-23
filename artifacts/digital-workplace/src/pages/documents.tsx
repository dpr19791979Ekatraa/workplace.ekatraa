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
  useGetRecentDocuments, getListDocumentsQueryKey, getGetRecentDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { FileText, Search, Star, Trash2, Plus, Upload, File, FileImage, FileVideo, FileSpreadsheet, Archive } from "lucide-react";

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

const createDocumentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().default("other"),
  description: z.string().optional(),
  objectPath: z.string().optional(),
});

type CreateDocumentForm = z.infer<typeof createDocumentSchema>;

function CreateDocumentDialog() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createDocument = useCreateDocument();

  const form = useForm<CreateDocumentForm>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: { name: "", type: "other", description: "" },
  });

  const onSubmit = (data: CreateDocumentForm) => {
    createDocument.mutate({ data: data as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetRecentDocumentsQueryKey() });
        toast({ title: "Document created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to create document", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="create-document-button">
          <Plus className="w-4 h-4 mr-2" /> Add Document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Document name" data-testid="input-document-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["pdf", "docx", "xlsx", "pptx", "image", "video", "zip", "other"].map(t => (
                      <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Optional description" {...field} />
                </FormControl>
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createDocument.isPending} data-testid="submit-create-document">
                {createDocument.isPending ? "Adding..." : "Add Document"}
              </Button>
            </div>
          </form>
        </Form>
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
            {((documents as any[]) ?? []).map((doc: any) => (
              <Card key={doc.id} data-testid={`document-row-${doc.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">{fileTypeIcon(doc.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{doc.type.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground">{formatSize(doc.size)}</span>
                        {doc.uploaderName && (
                          <span className="text-xs text-muted-foreground hidden sm:block">by {doc.uploaderName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
