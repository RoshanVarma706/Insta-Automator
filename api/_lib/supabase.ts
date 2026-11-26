/**
 * Supabase client — sources, clips, and job tracking.
 *
 * Uses the SERVICE_ROLE key so serverless functions have full
 * read/write access regardless of RLS policies.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }

  client = createClient(url, key);
  return client;
}

// ─── Source cache helpers ───────────────────────────────────────────

export type SourceRecord = {
  id?: string;
  source_url: string;
  public_id: string;
  original_url: string;
  analysis_url?: string | null;
  title?: string | null;
  duration: number;
  bytes: number;
  created_at?: string;
};

export async function findSourceByUrl(
  sourceUrl: string,
): Promise<SourceRecord | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("sources")
      .select("*")
      .eq("source_url", sourceUrl)
      .single();
    if (error || !data) return null;
    return data as SourceRecord;
  } catch {
    return null;
  }
}

export async function upsertSource(record: SourceRecord): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getSupabase();
    await sb
      .from("sources")
      .upsert(record, { onConflict: "source_url" });
  } catch {
    // Ignore if table doesn't exist yet
  }
}

export async function listSupabaseSources(limit = 50): Promise<SourceRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("sources")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as SourceRecord[];
  } catch {
    return [];
  }
}

export async function deleteSupabaseSource(publicId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getSupabase();
    await sb.from("sources").delete().eq("public_id", publicId);
  } catch {
    // Ignore if table doesn't exist yet
  }
}

// ─── Clip helpers ───────────────────────────────────────────────────

export type ClipRecord = {
  id: string;
  source_url: string;
  public_id: string;
  title: string;
  clip_url: string;
  start_seconds: number;
  end_seconds: number;
  duration_seconds: number;
  aspect_mode: string;
  caption_style: string;
  caption?: string | null;
  hashtags?: string[] | null;
  format?: string | null;
  created_at?: string;
};

export async function saveClipRecord(clip: ClipRecord): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getSupabase();
    await sb.from("clips").upsert(clip, { onConflict: "id" });
  } catch {
    // Ignore if table doesn't exist yet
  }
}

export async function listSupabaseClips(limit = 50): Promise<ClipRecord[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("clips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as ClipRecord[];
  } catch {
    return [];
  }
}

export async function deleteSupabaseClip(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getSupabase();
    await sb.from("clips").delete().eq("id", id);
  } catch {
    // Ignore if table doesn't exist yet
  }
}

// ─── Job helpers ────────────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "captioning"
  | "uploading"
  | "publishing"
  | "polling"
  | "published"
  | "failed";

export type JobRow = {
  id: string;
  url: string;
  source: string;
  status: JobStatus;
  caption: string | null;
  hashtags: string[] | null;
  cloudinary_public_id: string | null;
  cloudinary_url: string | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function createJob(
  url: string,
  source: string,
): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("jobs")
    .insert({ url, source, status: "pending" })
    .select("id")
    .single();

  if (error) throw new Error(`Supabase insert: ${error.message}`);
  return data!.id;
}

export async function updateJob(
  id: string,
  updates: Partial<Omit<JobRow, "id" | "created_at">>,
) {
  const sb = getSupabase();
  const { error } = await sb
    .from("jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`Supabase update: ${error.message}`);
}

export async function getJob(id: string): Promise<JobRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as JobRow;
}

export async function listJobs(limit = 50): Promise<JobRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Supabase list: ${error.message}`);
  return (data ?? []) as JobRow[];
}
