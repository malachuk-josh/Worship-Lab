import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

// Users allowed to DELETE from the shared church library / roster.
// Additions are open to every signed-in user.
const ADMIN_EMAILS = ["malachuk@gmail.com"];

export interface ChurchSong {
  id: string;
  title: string;
  author: string;
  ccli?: string; // CCLI song number
  addedBy: string;
  addedAt: string;
}

export interface Person {
  id: string;
  name: string;
  roles: string[];
}

export interface SavedTeam {
  id: string;
  name: string;
  slots: { role: string; person: string }[];
}

interface ChurchDoc {
  songs: ChurchSong[];
  people: Person[];
  teams: SavedTeam[];
}

const emptyDoc: ChurchDoc = { songs: [], people: [], teams: [] };
const KEY = "sacred:global:planner";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  return user.emailAddresses.some((e) => ADMIN_EMAILS.includes(e.emailAddress.toLowerCase()));
}

async function displayName(): Promise<string> {
  const user = await currentUser();
  return user?.firstName || user?.username || "member";
}

async function loadDoc(): Promise<ChurchDoc> {
  const doc = await getRedis().get<ChurchDoc>(KEY);
  return doc ? { ...emptyDoc, ...doc } : { ...emptyDoc };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [doc, admin] = await Promise.all([loadDoc(), isAdmin()]);
  return NextResponse.json({ doc, isAdmin: admin });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = str(body.action, 30);
  const doc = await loadDoc();

  if (action === "addSong") {
    const title = str(body.title, 120);
    const author = str(body.author, 120) || "Unknown";
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    const existing = doc.songs.find(
      (s) => s.title.toLowerCase() === title.toLowerCase() && s.author.toLowerCase() === author.toLowerCase()
    );
    const ccli = str(body.ccli, 12).replace(/\D/g, "");
    if (existing && ccli && !existing.ccli) {
      existing.ccli = ccli;
      await getRedis().set(KEY, doc);
    } else if (!existing && doc.songs.length < 1000) {
      doc.songs.push({ id: newId("cs"), title, author, ...(ccli ? { ccli } : {}), addedBy: await displayName(), addedAt: new Date().toISOString() });
      await getRedis().set(KEY, doc);
    }
  } else if (action === "deleteSong") {
    if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    doc.songs = doc.songs.filter((s) => s.id !== str(body.id, 40));
    await getRedis().set(KEY, doc);
  } else if (action === "addPerson") {
    const name = str(body.name, 80);
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const roles = (Array.isArray(body.roles) ? body.roles : []).map((r: unknown) => str(r, 40)).filter(Boolean).slice(0, 8);
    const existing = doc.people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // merge roles into the existing person
      existing.roles = [...new Set([...existing.roles, ...roles])];
    } else if (doc.people.length < 200) {
      doc.people.push({ id: newId("p"), name, roles });
    }
    await getRedis().set(KEY, doc);
  } else if (action === "updatePerson") {
    const id = str(body.id, 40);
    const person = doc.people.find((p) => p.id === id);
    if (person) {
      const name = str(body.name, 80);
      if (name) person.name = name;
      if (Array.isArray(body.roles)) {
        person.roles = body.roles.map((r: unknown) => str(r, 40)).filter(Boolean).slice(0, 8);
      }
      await getRedis().set(KEY, doc);
    }
  } else if (action === "deletePerson") {
    if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    doc.people = doc.people.filter((p) => p.id !== str(body.id, 40));
    await getRedis().set(KEY, doc);
  } else if (action === "saveTeam") {
    const name = str(body.name, 60);
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const slots = (Array.isArray(body.slots) ? body.slots : [])
      .slice(0, 20)
      .map((raw: unknown) => {
        if (!raw || typeof raw !== "object") return null;
        const t = raw as Record<string, unknown>;
        const role = str(t.role, 40);
        const person = str(t.person, 80);
        return role || person ? { role, person } : null;
      })
      .filter((x: { role: string; person: string } | null): x is { role: string; person: string } => !!x);
    const existing = doc.teams.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.slots = slots; // saving under the same name updates the team
    } else if (doc.teams.length < 50) {
      doc.teams.push({ id: newId("t"), name, slots });
    }
    await getRedis().set(KEY, doc);
  } else if (action === "deleteTeam") {
    if (!(await isAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    doc.teams = doc.teams.filter((t) => t.id !== str(body.id, 40));
    await getRedis().set(KEY, doc);
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  return NextResponse.json({ doc, isAdmin: await isAdmin() });
}
