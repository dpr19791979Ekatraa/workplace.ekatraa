import { Router, type IRouter } from "express";
import { eq, and, ilike, type SQL, sql } from "drizzle-orm";
import { db, documentsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListDocumentsQueryParams,
  CreateDocumentBody,
  GetDocumentParams,
  UpdateDocumentParams,
  UpdateDocumentBody,
  DeleteDocumentParams,
  ToggleDocumentStarParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

async function formatDoc(doc: typeof documentsTable.$inferSelect) {
  let uploaderName: string | null = null;
  if (doc.uploadedById) {
    const [u] = await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable).where(eq(usersTable.id, doc.uploadedById)).limit(1);
    if (u) uploaderName = `${u.firstName} ${u.lastName}`;
  }
  return { ...doc, tags: doc.tags ?? [], uploaderName };
}

router.get("/documents", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { folderId, search, starred, departmentId } = parsed.data;
  const conditions: SQL[] = [];
  if (folderId != null) conditions.push(eq(documentsTable.folderId, folderId));
  if (search) conditions.push(ilike(documentsTable.name, `%${search}%`));
  if (starred) conditions.push(eq(documentsTable.starred, true));
  if (departmentId) conditions.push(eq(documentsTable.departmentId, departmentId));

  const docs = await db.select().from(documentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(documentsTable.createdAt);

  const formatted = await Promise.all(docs.map(formatDoc));
  res.json(formatted);
});

router.post("/documents", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = (req as any).currentUser;
  const [doc] = await db.insert(documentsTable).values({
    ...parsed.data,
    uploadedById: user.id,
  }).returning();
  await logActivity(user.id, "document_uploaded", `Uploaded document "${doc.name}"`, doc.id, "document");
  res.status(201).json(await formatDoc(doc));
});

router.get("/documents/recent", requireAuth, async (req, res): Promise<void> => {
  const user = (req as any).currentUser;
  const docs = await db.select().from(documentsTable)
    .where(eq(documentsTable.uploadedById, user.id))
    .orderBy(documentsTable.createdAt)
    .limit(10);
  const formatted = await Promise.all(docs.map(formatDoc));
  res.json(formatted);
});

router.get("/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, params.data.id)).limit(1);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(await formatDoc(doc));
});

router.patch("/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db.update(documentsTable).set(parsed.data).where(eq(documentsTable.id, params.data.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(await formatDoc(updated));
});

router.delete("/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(documentsTable).where(eq(documentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/documents/:id/star", requireAuth, async (req, res): Promise<void> => {
  const params = ToggleDocumentStarParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, params.data.id)).limit(1);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const [updated] = await db.update(documentsTable).set({ starred: !doc.starred }).where(eq(documentsTable.id, params.data.id)).returning();
  res.json(await formatDoc(updated));
});

export default router;
