/**
 * Mirrors backend/app/models/document.py.
 * The employee experience is read-only over documents.
 */
export type DocumentStatus =
  | "processing"
  | "ready"
  | "failed"
  | string;

export interface PolicyDocument {
  id: string;
  title: string;
  filename: string;
  description: string | null;
  category: string | null;
  version: number;
  status: DocumentStatus;
  cloudinary_url: string | null;
  created_at: string;
  updated_at?: string;
}
