import fs from "node:fs/promises";
import path from "node:path";
import { dataDirectory } from "./file-storage";

function remoteConfiguration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_STORAGE_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new Error("Supabase file storage is incompletely configured");
  return { url: url.replace(/\/$/, ""), key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "clockfield-migration" };
}

function objectPath(filePath: string) {
  const relative = path.relative(dataDirectory, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid storage path");
  const parts = relative.split(path.sep);
  if (!["uploads", "private_fit_for_duty_photos", "private_incident_evidence"].includes(parts[0])) throw new Error("Invalid storage directory");
  return parts.map(encodeURIComponent).join("/");
}

export async function readPersistentFile(filePath: string): Promise<Buffer | null> {
  const remote = remoteConfiguration();
  if (!remote) {
    try { return await fs.readFile(filePath); } catch (error: any) { if (error.code === "ENOENT") return null; throw error; }
  }
  const response = await fetch(`${remote.url}/storage/v1/object/authenticated/${remote.bucket}/${objectPath(filePath)}`, {
    headers: { apikey: remote.key, Authorization: `Bearer ${remote.key}` }, signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404) return null;
  // Some Supabase Storage versions wrap a missing object in HTTP 400.
  // Do not mistake denied access or other storage failures for a missing file.
  if (response.status === 400) {
    const error = await response.json().catch(() => null) as { code?: string; error?: string; message?: string; statusCode?: string | number } | null;
    if (error?.code === "NoSuchKey" || error?.error === "NoSuchKey" ||
        error?.error === "not_found" || String(error?.statusCode) === "404") return null;
  }
  if (!response.ok) throw new Error(`Storage read failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function writePersistentFile(filePath: string, data: Buffer, mimeType: string) {
  const remote = remoteConfiguration();
  if (!remote) { await fs.writeFile(filePath, data, { flag: "wx" }); return; }
  const response = await fetch(`${remote.url}/storage/v1/object/${remote.bucket}/${objectPath(filePath)}`, {
    method: "POST", headers: { apikey: remote.key, Authorization: `Bearer ${remote.key}`, "Content-Type": mimeType, "x-upsert": "false" },
    body: new Uint8Array(data), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Storage write failed (${response.status})`);
}

export async function removePersistentFile(filePath: string) {
  const remote = remoteConfiguration();
  if (!remote) { await fs.unlink(filePath); return; }
  const response = await fetch(`${remote.url}/storage/v1/object/${remote.bucket}`, {
    method: "DELETE", headers: { apikey: remote.key, Authorization: `Bearer ${remote.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [decodeURIComponent(objectPath(filePath))] }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Storage deletion failed (${response.status})`);
}
