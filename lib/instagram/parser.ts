import { strFromU8, unzipSync } from "fflate";
import { compareInstagramLists } from "./compare";
import type { ImportedTextFile, InstagramAnalysis } from "./types";

function isFollowersFile(name: string) {
  const normalized = name.toLowerCase();
  return /(^|\/)followers(_\d+)?\.json$/.test(normalized);
}

function isFollowingFile(name: string) {
  const normalized = name.toLowerCase();
  return /(^|\/)following\.json$/.test(normalized);
}

function collectRelationshipUsernames(node: unknown, output: string[]) {
  if (!node || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const item of node) collectRelationshipUsernames(item, output);
    return;
  }

  const record = node as Record<string, unknown>;

  if (Array.isArray(record.string_list_data)) {
    for (const item of record.string_list_data) {
      if (!item || typeof item !== "object") continue;
      const value = (item as Record<string, unknown>).value;
      if (typeof value === "string" && value.trim()) output.push(value);
    }
  }

  if (typeof record.title === "string" && record.title.trim()) {
    output.push(record.title);
  }

  for (const value of Object.values(record)) {
    if (value === record.string_list_data || value === record.title) continue;
    collectRelationshipUsernames(value, output);
  }
}

function parseRelationshipFile(text: string) {
  const parsed: unknown = JSON.parse(text);
  const usernames: string[] = [];
  collectRelationshipUsernames(parsed, usernames);
  return usernames;
}

export function analyzeInstagramTextFiles(
  files: ImportedTextFile[],
): InstagramAnalysis {
  const followerFiles = files.filter((file) => isFollowersFile(file.name));
  const followingFiles = files.filter((file) => isFollowingFile(file.name));

  if (followerFiles.length === 0 || followingFiles.length === 0) {
    throw new Error(
      "Não encontrei os arquivos de seguidores e seguindo. Exporte os dados do Instagram em formato JSON e tente novamente.",
    );
  }

  const followers = followerFiles.flatMap((file) =>
    parseRelationshipFile(file.text),
  );
  const following = followingFiles.flatMap((file) =>
    parseRelationshipFile(file.text),
  );

  return compareInstagramLists(followers, following);
}

export async function analyzeInstagramExport(
  file: File,
): Promise<InstagramAnalysis> {
  const lowerName = file.name.toLowerCase();

  if (!lowerName.endsWith(".zip")) {
    throw new Error("Envie o arquivo .zip exportado pelo Instagram em formato JSON.");
  }

  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const files: ImportedTextFile[] = Object.entries(archive)
    .filter(([name]) => name.toLowerCase().endsWith(".json"))
    .map(([name, content]) => ({ name, text: strFromU8(content) }));

  return analyzeInstagramTextFiles(files);
}
