// Skills catalog (Phase 4, SK-03/SK-04): merges the built-in SKILLS
// constants with skill packs found on disk — the repo's own skills/<id>/
// folders (frontmatter for built-ins) and imported packs cloned into
// DATA_DIR/skills/<name>/SKILL.md. Enabled state lives server-side in
// the settings key `skillStates` (map id → boolean, default true).
import fs from "node:fs";
import path from "node:path";
import { SKILLS } from "@/shared/constants/skills";
import { DATA_DIR } from "@/lib/dataDir";
import { getSettings } from "@/lib/localDb";

// Minimal frontmatter parser: a leading --- block of `key: value` lines.
export function parseFrontmatter(content) {
  if (typeof content !== "string" || !content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  const block = content.slice(3, end);
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function readFrontmatter(filePath) {
  try {
    return parseFrontmatter(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function getImportedSkillsDir() {
  return path.join(DATA_DIR, "skills");
}

export async function listSkills() {
  const settings = await getSettings().catch(() => ({}));
  const states = settings?.skillStates && typeof settings.skillStates === "object" ? settings.skillStates : {};
  const enabledOf = (id) => states[id] !== false;

  const skills = [];
  const seen = new Set();

  // Built-ins: constants provide id/name/description/icon/endpoint;
  // category/version come from the repo's own skills/<id>/SKILL.md
  // frontmatter when present, else null.
  for (const skill of SKILLS) {
    seen.add(skill.id);
    const fm = readFrontmatter(path.join(process.cwd(), "skills", skill.id, "SKILL.md"));
    skills.push({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: fm?.category || null,
      version: fm?.version || null,
      icon: skill.icon || null,
      endpoint: skill.endpoint || null,
      enabled: enabledOf(skill.id),
      source: "builtin",
    });
  }

  // Imported packs: DATA_DIR/skills/*/SKILL.md
  const dir = getImportedSkillsDir();
  let names = [];
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  } catch { /* no imported skills yet */ }
  for (const name of names) {
    if (seen.has(name)) continue;
    const fm = readFrontmatter(path.join(dir, name, "SKILL.md"));
    if (!fm) continue;
    seen.add(name);
    skills.push({
      id: name,
      name: fm.name || name,
      description: fm.description || null,
      category: fm.category || null,
      version: fm.version || null,
      icon: null,
      endpoint: null,
      enabled: enabledOf(name),
      source: "imported",
    });
  }

  return skills;
}

export async function getSkillEntry(id) {
  const skills = await listSkills();
  return skills.find((s) => s.id === id) || null;
}
