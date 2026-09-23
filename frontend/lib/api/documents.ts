import { apiFetch, withMockFallback } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import { getMockDocument, getMockDocuments } from "@/lib/api/mockData";
import type { PolicyDocument } from "@/types/document";

/**
 * GET /api/v1/documents — NOT implemented yet (the backend only exposes an
 * admin upload POST and the router is not registered).
 * Employees can VIEW documents only; management belongs to Admin.
 */
export async function listDocuments(): Promise<PolicyDocument[]> {
  return withMockFallback(
    "GET /documents",
    async () =>
      (await apiFetch(`${API_V1}/documents`, {
        method: "GET",
      })) as PolicyDocument[],
    () => getMockDocuments()
  );
}

/** GET /api/v1/documents/{id} — NOT implemented yet. */
export async function getDocument(id: string): Promise<PolicyDocument> {
  return withMockFallback(
    `GET /documents/${id}`,
    async () =>
      (await apiFetch(`${API_V1}/documents/${id}`, {
        method: "GET",
      })) as PolicyDocument,
    () => {
      const doc = getMockDocument(id);
      if (!doc) {
        throw new Error("Document not found.");
      }
      return doc;
    }
  );
}
