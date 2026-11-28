import { strFromU8, unzipSync } from "fflate";
import { compareInstagramLists } from "./compare";
import type { ImportedTextFile, InstagramAnalysis } from "./types";

const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/i;
// Caminhos do Instagram que não são perfis.
const RESERVED_PATHS = new Set([
  "accounts", "explore", "p", "reel", "reels", "stories", "direct", "about", "legal", "privacy",
]);

function isFollowersFile(name: string, extension: "json" | "html") {
  const normalized = name.toLowerCase();
  return new RegExp(`(^|/)followers(_\\d+)?\\.${extension}$`).test(normalized);
}

function isFollowingFile(name: string, extension: "json" | "html") {
  const normalized = name.toLowerCase();
  return new RegExp(`(^|/)following\\.${extension}$`).test(normalized);
}

/** Extrai o @ de links como instagram.com/usuario ou instagram.com/_u/usuario. */
function usernameFromHref(href: unknown) {
  if (typeof href !== "string") return null;
  const match = /instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})\/?(?:[?#]|$)/i.exec(href);
  const username = match?.[1];
  if (!username || RESERVED_PATHS.has(username.toLowerCase())) return null;
  return username;
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
      const entry = item as Record<string, unknown>;
      const value = entry.value;
      if (typeof value === "string" && value.trim()) {
        output.push(value);
        continue;
      }
      // Exportações mais recentes podem trazer só o link do perfil.
      const fromHref = usernameFromHref(entry.href);
      if (fromHref && !(typeof record.title === "string" && record.title.trim())) {
        output.push(fromHref);
      }
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

/** Lê seguidores/seguindo da exportação em HTML (formato padrão do Instagram). */
function parseRelationshipHtml(html: string) {
  const usernames: string[] = [];
  const linkPattern = /href\s*=\s*"([^"]*instagram\.com\/[^"]*)"/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html))) {
    const username = usernameFromHref(match[1]);
    if (username) usernames.push(username);
  }
  return usernames;
}

/**
 * Tenta descobrir o @ dono da exportação (personal_information.json).
 * As chaves mudam conforme o idioma da conta, por isso a busca é tolerante.
 */
export function detectExportOwner(files: ImportedTextFile[]) {
  const candidates = files.filter((file) =>
    /(^|\/)personal_information\.json$/i.test(file.name),
  );
  const keys = new Set(["username", "nome de usuário", "nombre de usuario", "nom d'utilisateur"]);

  function search(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = search(item);
        if (found) return found;
      }
      return null;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (keys.has(key.trim().toLowerCase()) && value && typeof value === "object") {
        const raw = (value as Record<string, unknown>).value;
        if (typeof raw === "string") {
          const username = raw.trim().replace(/^@/, "").toLowerCase();
          if (USERNAME_PATTERN.test(username)) return username;
        }
      }
      const found = search(value);
      if (found) return found;
    }
    return null;
  }

  for (const file of candidates) {
    try {
      const found = search(JSON.parse(file.text));
      if (found) return found;
    } catch {
      // Arquivo ilegível: segue para o próximo.
    }
  }
  return null;
}

export function analyzeInstagramTextFiles(
  files: ImportedTextFile[],
): InstagramAnalysis {
  const jsonFollowers = files.filter((file) => isFollowersFile(file.name, "json"));
  const jsonFollowing = files.filter((file) => isFollowingFile(file.name, "json"));

  if (jsonFollowers.length && jsonFollowing.length) {
    return compareInstagramLists(
      jsonFollowers.flatMap((file) => parseRelationshipFile(file.text)),
      jsonFollowing.flatMap((file) => parseRelationshipFile(file.text)),
    );
  }

  const htmlFollowers = files.filter((file) => isFollowersFile(file.name, "html"));
  const htmlFollowing = files.filter((file) => isFollowingFile(file.name, "html"));

  if (htmlFollowers.length && htmlFollowing.length) {
    return compareInstagramLists(
      htmlFollowers.flatMap((file) => parseRelationshipHtml(file.text)),
      htmlFollowing.flatMap((file) => parseRelationshipHtml(file.text)),
    );
  }

  throw new Error(
    "Não encontrei os arquivos de seguidores e seguindo no ZIP. Na exportação do Instagram, marque “Seguidores e seguindo” (formato JSON ou HTML) e tente novamente.",
  );
}

export type InstagramExportResult = {
  analysis: InstagramAnalysis;
  /** @ dono da exportação, quando o ZIP inclui as informações pessoais. */
  owner: string | null;
};

export async function analyzeInstagramExport(
  file: File,
): Promise<InstagramExportResult> {
  const lowerName = file.name.toLowerCase();

  if (!lowerName.endsWith(".zip")) {
    throw new Error("Envie o arquivo .zip exportado pelo Instagram.");
  }

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      // Lê só o necessário: evita estourar a memória do celular com fotos e vídeos.
      filter: (entry) => /\.(json|html)$/i.test(entry.name),
    });
  } catch {
    throw new Error("Não foi possível abrir o ZIP. Baixe novamente a exportação do Instagram e tente outra vez.");
  }

  const files: ImportedTextFile[] = Object.entries(archive).map(([name, content]) => ({
    name,
    text: strFromU8(content),
  }));

  const analysis = analyzeInstagramTextFiles(files);
  return { analysis, owner: detectExportOwner(files) };
}
