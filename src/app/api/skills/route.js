import { NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/localDb";
import { listSkills, getSkillEntry } from "@/lib/skillsCatalog";

export const dynamic = "force-dynamic";

// GET /api/skills - Built-in + imported skill packs with enabled state.
export async function GET() {
  try {
    const skills = await listSkills();
    return NextResponse.json({ skills });
  } catch (error) {
    console.log("Error listing skills:", error);
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 });
  }
}

// PATCH /api/skills - Persist one skill's enabled state (settings.skillStates).
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, enabled } = body || {};
    if (!id || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "id and enabled (boolean) are required" }, { status: 400 });
    }
    const existing = await getSkillEntry(id);
    if (!existing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    const settings = await getSettings();
    const skillStates = {
      ...(settings?.skillStates && typeof settings.skillStates === "object" ? settings.skillStates : {}),
      [id]: enabled,
    };
    await updateSettings({ skillStates });
    const updated = await getSkillEntry(id);
    return NextResponse.json(updated || { ...existing, enabled });
  } catch (error) {
    console.log("Error updating skill:", error);
    return NextResponse.json({ error: "Failed to update skill" }, { status: 500 });
  }
}
