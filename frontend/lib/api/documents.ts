import { apiFetch } from "@/lib/api/client";
import { API_V1 } from "@/lib/utils/constants";
import type { PolicyDocument } from "@/types/document";

/**
 * GET /api/v1/documents — employee read-only list of policy documents.
 * (Document upload/management belongs to Admin and is not exposed here.)
 */
export async function listDocuments(): Promise<PolicyDocument[]> {
  return (await apiFetch(`${API_V1}/documents`, {
    method: "GET",
  })) as PolicyDocument[];
}

/** GET /api/v1/documents/{id} */
export async function getDocument(id: string): Promise<PolicyDocument> {
  return (await apiFetch(`${API_V1}/documents/${id}`, {
    method: "GET",
  })) as PolicyDocument;
}
