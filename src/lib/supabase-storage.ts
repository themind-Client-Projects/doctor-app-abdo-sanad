import { createAdminClient } from "./supabase";

// ─────────────────────────────────────────────────────────────
// Supabase Storage — File management helpers
// Buckets: lab-results, radiology-images, reports, avatars
// ─────────────────────────────────────────────────────────────

export type StorageBucket =
  | "lab-results"
  | "radiology-images"
  | "reports"
  | "avatars";

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  bucket: StorageBucket,
  path: string,
  file: File | Blob | Buffer,
  options?: { contentType?: string; upsert?: boolean }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: options?.contentType,
    upsert: options?.upsert ?? false,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data;
}

/**
 * Get a public URL for a file in storage
 */
export function getFileUrl(bucket: StorageBucket, path: string): string {
  const supabase = createAdminClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get a signed (temporary) URL for private files
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Delete a file from storage
 */
export async function deleteFile(bucket: StorageBucket, path: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * List files in a bucket directory
 */
export async function listFiles(
  bucket: StorageBucket,
  folder: string = ""
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).list(folder);
  if (error) throw new Error(`List failed: ${error.message}`);
  return data;
}
