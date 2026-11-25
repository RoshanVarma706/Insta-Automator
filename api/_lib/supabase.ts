/**
 * Supabase client — job and clip tracking.
 *
 * Uses the SERVICE_ROLE key so serverless functions have full
 * read/write access regardless of RLS policies.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

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
