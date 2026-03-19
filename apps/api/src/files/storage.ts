import { writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const UPLOADS_DIR = resolve(__dirname, "../../../../uploads");
const FILES_DIR = resolve(UPLOADS_DIR, "files");

export interface FileStorage {
  saveFile(buffer: Buffer, filename: string): Promise<string>;
  getFilePath(relativePath: string): string;
  deleteFile(relativePath: string): Promise<void>;
}

export const localStorage: FileStorage = {
  async saveFile(buffer: Buffer, filename: string): Promise<string> {
    await mkdir(FILES_DIR, { recursive: true });
    const ext = extname(filename) || "";
    const storedName = `${randomUUID()}${ext}`;
    const relativePath = `files/${storedName}`;
    await writeFile(resolve(UPLOADS_DIR, relativePath), buffer);
    return relativePath;
  },

  getFilePath(relativePath: string): string {
    return resolve(UPLOADS_DIR, relativePath);
  },

  async deleteFile(relativePath: string): Promise<void> {
    try {
      await unlink(resolve(UPLOADS_DIR, relativePath));
    } catch {
      // File may already be deleted
    }
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[i]}`;
}

export function getFileType(filename: string): string {
  const ext = extname(filename).slice(1).toLowerCase();
  return ext || "file";
}

export function getMimeType(filename: string): string {
  const ext = extname(filename).slice(1).toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    csv: "text/csv",
    txt: "text/plain",
    json: "application/json",
    xml: "application/xml",
    zip: "application/zip",
    rar: "application/vnd.rar",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  return mimeMap[ext] || "application/octet-stream";
}
