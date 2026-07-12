import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

export interface SetlistSong {
  title: string;
  author: string;
  key?: string;
  chart?: string; // in-app chart id when available
  catalogId?: string;
  ccli?: string; // CCLI song number (for reporting + SongSelect links)
}

export interface TeamSlot {
  role: string;
  person: string;
}

export interface Setlist {
  id: string;
  name: string;
  favorite: boolean;
  updatedAt: string;
  date?: string; // YYYY-MM-DD service date
  notes?: string;
  team?: TeamSlot[];
  songs: SetlistSong[];
}

interface PlannerDoc {
  setlists: Setlist[];
  songFavs: SetlistSong[];
}

const emptyDoc: PlannerDoc = { setlists: [], songFavs: [] };

function plannerKey(userId: string) {
  return `sacred:user:${userId}:planner`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function sanitizeSong(raw: unknown): SetlistSong | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const title = str(s.title, 120);
  if (!title) return null;
  const song: SetlistSong = { title, author: str(s.author, 120) };
  const key = str(s.key, 6);
  const chart = str(s.chart, 60);
  const catalogId = str(s.catalogId, 80);
  const ccli = str(s.ccli, 12).replace(/\D/g, "");
  if (key) song.key = key;
  if (chart) song.chart = chart;
  if (catalogId) song.catalogId = catalogId;
  if (ccli) song.ccli = ccli;
  return song;
}

function sanitizeDoc(raw: unknown): PlannerDoc {
  if (!raw || typeof raw !== "object") return emptyDoc;
  const d = raw as Record<string, unknown>;
  const setlists = (Array.isArray(d.setlists) ? d.setlists : [])
    .slice(0, 60)
    .map((raw): Setlist | null => {
      if (!raw || typeof raw !== "object") return null;
      const s = raw as Record<string, unknown>;
      const id = str(s.id, 40);
      const name = str(s.name, 80);
      if (!id || !name) return null;
      const out: Setlist = {
        id,
        name,
        favorite: !!s.favorite,
        updatedAt: str(s.updatedAt, 40) || new Date().toISOString(),
        songs: (Array.isArray(s.songs) ? s.songs : []).slice(0, 60).map(sanitizeSong).filter((x): x is SetlistSong => !!x),
      };
      const date = str(s.date, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) out.date = date;
      const notes = str(s.notes, 500);
      if (notes) out.notes = notes;
      const team = (Array.isArray(s.team) ? s.team : [])
        .slice(0, 20)
        .map((raw: unknown): TeamSlot | null => {
          if (!raw || typeof raw !== "object") return null;
          const t = raw as Record<string, unknown>;
          const role = str(t.role, 40);
          const person = str(t.person, 80);
          return role || person ? { role, person } : null;
        })
        .filter((x: TeamSlot | null): x is TeamSlot => !!x);
      if (team.length) out.team = team;
      return out;
    })
    .filter((x): x is Setlist => !!x);
  const songFavs = (Array.isArray(d.songFavs) ? d.songFavs : [])
    .slice(0, 400)
    .map(sanitizeSong)
    .filter((x): x is SetlistSong => !!x);
  return { setlists, songFavs };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const doc = await getRedis().get<PlannerDoc>(plannerKey(userId));
  return NextResponse.json({ doc: doc ? { ...emptyDoc, ...doc } : emptyDoc });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const doc = sanitizeDoc(body?.doc);
  await getRedis().set(plannerKey(userId), doc);
  return NextResponse.json({ ok: true, doc });
}
