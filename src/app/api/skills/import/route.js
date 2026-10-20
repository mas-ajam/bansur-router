import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { getImportedSkillsDir, parseFrontmatter, getSkillEntry } from "@/lib/skillsCatalog";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

// Accept the shapes a git remote URL legitimately takes; arguments are
// passed via execFile's argv array (no shell), so this is a sanity gate,
// not the injection defense.
function looksLikeGitUrl(url) {
  if (typeof url !== "string" || !url.trim() || /\s/.test(url)) return false;
  return (
    /^https?:\/\/[^\s]+\/[^\s]+/.test(url) ||
    /^git@[^\s:]+:[^\s]+/.test(url) ||
    /^ssh:\/\/[^\s]+/.test(url) ||
    /^git:\/\/[^\s]+/.test(url)
  );
}

function repoNameFromUrl(url) {
  const trimmed = url.trim().replace(/\/+$/, "");
  const last = trimmed.split(/[/:]/).pop() || "";
  const name = last.replace(/\.git$/, "");
  return /^[a-zA-Z0-9._-]+$/.test(name) && name !== "." && name !== ".." ? name : null;
}

function findSkillFile(dest) {
  const rootFile = path.join(dest, "SKILL.md");
  if (fs.existsSync(rootFile)) return { file: rootFile, id: path.basename(dest) };
  try {
    for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const nested = path.join(dest, entry.name, "SKILL.md");
      if (fs.existsSync(nested)) return { file: nested, id: entry.name };
    }
  } catch { /* fall through */ }
  return null;
}

// POST /api/skills/import - Clone a skill pack from a Git URL into
// DATA_DIR/skills/<repo-name> and return its catalog entry.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const url = body?.url;
    if (!looksLikeGitUrl(url)) {
      return NextResponse.json({ error: "A valid Git URL is required" }, { status: 400 });
    }
    const repoName = repoNameFromUrl(url);
    if (!repoName) {
      return NextResponse.json({ error: "Could not determine a repository name from the URL" }, { status: 400 });
    }

    try {
      await execFileAsync("git", ["--version"]);
    } catch {
      return NextResponse.json({ error: "git is not available on this machine, so skill import cannot run" }, { status: 500 });
    }

    const skillsDir = getImportedSkillsDir();
    const dest = path.join(skillsDir, repoName);
    if (fs.existsSync(dest)) {
      return NextResponse.json({ error: `Skill "${repoName}" is already imported` }, { status: 400 });
    }
    fs.mkdirSync(skillsDir, { recursive: true });

    try {
      await execFileAsync("git", ["clone", "--depth", "1", url.trim(), dest], { timeout: 120000 });
    } catch (cloneError) {
      fs.rmSync(dest, { recursive: true, force: true });
      const detail = (cloneError.stderr || cloneError.message || "git clone failed").toString().trim().slice(0, 300);
      return NextResponse.json({ error: `Import failed: ${detail}` }, { status: 400 });
    }

    const found = findSkillFile(dest);
    if (!found) {
      fs.rmSync(dest, { recursive: true, force: true });
      return NextResponse.json({ error: "Imported repository does not contain a SKILL.md" }, { status: 400 });
    }

    const entry = (await getSkillEntry(found.id)) || (() => {
      let fm = {};
      try { fm = parseFrontmatter(fs.readFileSync(found.file, "utf8")); } catch { /* empty */ }
      return {
        id: found.id,
        name: fm.name || found.id,
        description: fm.description || null,
        category: fm.category || null,
        version: fm.version || null,
        icon: null,
        endpoint: null,
        enabled: true,
        source: "imported",
      };
    })();

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.log("Error importing skill:", error);
    return NextResponse.json({ error: "Failed to import skill" }, { status: 500 });
  }
}
