"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { CATALOG } from "@/lib/worship-catalog";
import { TEAM_ROLES } from "@/lib/team";
import { verseOfTheDay, type Verse } from "@/lib/verses";
import { songselectSearchUrl } from "@/lib/songselect";

/* ---------------- types ---------------- */

interface SLSong { title: string; author: string; key?: string; ccli?: string }
interface TeamSlot { role: string; person: string }
interface Setlist {
  id: string; name: string; favorite: boolean; updatedAt: string;
  date?: string; notes?: string; team?: TeamSlot[]; songs: SLSong[];
}
interface Person { id: string; name: string; roles: string[] }
interface SavedTeam { id: string; name: string; slots: TeamSlot[] }
interface ChurchSong { id: string; title: string; author: string; ccli?: string }
interface ChurchDoc { songs: ChurchSong[]; people: Person[]; teams: SavedTeam[] }

type View = "planner" | "library" | "team" | "calendar";

const KEYS = ["", "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B", "Am", "Bm", "Cm", "Dm", "Em", "F#m", "Gm"];
const LSKEY = "worship-lab-local-v1";
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso?: string, long = false): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, long
    ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
    : { weekday: "short", month: "short", day: "numeric" });
}

/* Placeholder starter data for browsing without an account.
   Signed-in users get the real shared roster/library from the church cloud. */
function localSeed(): { setlists: Setlist[]; church: ChurchDoc } {
  const people: Person[] = [
    ["Worship Leader", ["Worship Leader", "Acoustic Guitar"]],
    ["Vocalist One", ["Vocals"]],
    ["Vocalist Two", ["Vocals"]],
    ["Pianist", ["Piano", "Keys"]],
    ["Bassist", ["Bass"]],
    ["Percussionist", ["Percussion", "Drums"]],
  ].map(([name, roles]) => ({ id: uid("p"), name: name as string, roles: roles as string[] }));
  const church: ChurchSong[] = [
    ["Goodness of God", "Jenn Johnson · Bethel Music"], ["Living Hope", "Phil Wickham"],
    ["Build My Life", "Pat Barrett · Housefires"], ["In Christ Alone", "Keith Getty & Stuart Townend"],
    ["10,000 Reasons (Bless the Lord)", "Matt Redman"], ["Great Is Thy Faithfulness", "Thomas Chisholm"],
  ].map(([t, a]) => ({ id: uid("cs"), title: t, author: a }));
  return {
    setlists: [{
      id: uid("s"), name: "Sunday Morning Worship", favorite: true, updatedAt: new Date().toISOString(),
      date: nextSunday(), notes: "Blended set — open modern, close on the hymn.",
      songs: [
        { title: "House of the Lord", author: "Phil Wickham", key: "C" },
        { title: "Goodness of God", author: "Jenn Johnson · Bethel Music", key: "G" },
        { title: "It Is Well With My Soul", author: "Horatio Spafford", key: "D" },
      ],
      team: [],
    }],
    church: { songs: church, people, teams: [] },
  };
}

/* ---------------- icons ---------------- */

const Icons = {
  planner: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>,
  library: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M9 18V6l10-2v11" /><circle cx="6.5" cy="18" r="2.6" /><circle cx="16.5" cy="15" r="2.6" /></svg>,
  team: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="9" cy="8" r="3.4" /><path d="M2.8 19c.8-3.2 3.3-5 6.2-5s5.4 1.8 6.2 5" /><circle cx="17.2" cy="9.5" r="2.6" /><path d="M15.4 14.3c2.7.2 4.9 1.8 5.8 4.7" /></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 2.8V6.5M16 2.8V6.5" /></svg>,
};
const NAV: { id: View; label: string }[] = [
  { id: "planner", label: "Planner" },
  { id: "library", label: "Library" },
  { id: "team", label: "Team" },
  { id: "calendar", label: "Calendar" },
];

/* ---------------- page ---------------- */

export default function WorshipLab() {
  const { isLoaded, isSignedIn } = useUser();
  const cloud = isLoaded && isSignedIn;

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("planner");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [church, setChurch] = useState<ChurchDoc>({ songs: [], people: [], teams: [] });
  const [isAdmin, setIsAdmin] = useState(false);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [toast, setToast] = useState("");
  const songFavsRef = useRef<unknown[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const churchRef = useRef(church);
  churchRef.current = church;

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1900);
  }, []);

  /* Theme: light is the default (church-palette); dark is opt-in and remembered. */
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setMounted(true);
    setVerse(verseOfTheDay());
    try { if (localStorage.getItem("wl-theme") === "dark") setTheme("dark"); } catch {}
  }, []);
  useEffect(() => {
    if (theme === "dark") document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem("wl-theme", theme); } catch {}
  }, [theme]);
  const themeBtn = (
    <button className="icobtn themebtn" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
      {theme === "dark"
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" /></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M20.4 14.2A8.4 8.4 0 0 1 9.8 3.6a8.4 8.4 0 1 0 10.6 10.6Z" /></svg>}
    </button>
  );

  /* ---- load ---- */
  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      fetch("/api/setlists").then(r => r.ok ? r.json() : null).then(j => {
        if (!j?.doc) return;
        setSetlists(Array.isArray(j.doc.setlists) ? j.doc.setlists : []);
        songFavsRef.current = Array.isArray(j.doc.songFavs) ? j.doc.songFavs : [];
      }).catch(() => {});
      fetch("/api/church").then(r => r.ok ? r.json() : null).then(j => {
        if (!j?.doc) return;
        setChurch({ songs: [], people: [], teams: [], ...j.doc });
        setIsAdmin(!!j.isAdmin);
      }).catch(() => {});
    } else {
      try {
        const raw = localStorage.getItem(LSKEY);
        const doc = raw ? JSON.parse(raw) : localSeed();
        setSetlists(Array.isArray(doc.setlists) ? doc.setlists : []);
        setChurch({ songs: [], people: [], teams: [], ...(doc.church || {}) });
        setIsAdmin(true); // local data is the user's own — full control
        if (!raw) localStorage.setItem(LSKEY, JSON.stringify(doc));
      } catch { /* private browsing */ }
    }
  }, [isLoaded, isSignedIn]);

  /* ---- persist ---- */
  const persistLocal = useCallback((lists: Setlist[], ch: ChurchDoc) => {
    try { localStorage.setItem(LSKEY, JSON.stringify({ setlists: lists, church: ch })); } catch {}
  }, []);

  const commitSetlists = useCallback((updater: (prev: Setlist[]) => Setlist[]) => {
    setSetlists(prev => {
      const next = updater(prev);
      if (cloud) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          fetch("/api/setlists", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doc: { setlists: next, songFavs: songFavsRef.current } }),
          }).catch(() => {});
        }, 700);
      } else {
        persistLocal(next, churchRef.current);
      }
      return next;
    });
  }, [cloud, persistLocal]);

  const editSetlist = useCallback((id: string, patch: Partial<Setlist>) => {
    commitSetlists(prev => prev.map(s => s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s));
  }, [commitSetlists]);

  /* Shared-church mutations: server actions when signed in, local reducer otherwise. */
  const churchAction = useCallback(async (body: Record<string, unknown>) => {
    if (cloud) {
      try {
        const r = await fetch("/api/church", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.doc) { setChurch({ songs: [], people: [], teams: [], ...j.doc }); setIsAdmin(!!j.isAdmin); }
        } else if (r.status === 403) {
          say("Only a church admin can delete");
        }
      } catch { say("Couldn't reach the church cloud"); }
      return;
    }
    setChurch(prev => {
      const doc: ChurchDoc = JSON.parse(JSON.stringify(prev));
      const a = body.action;
      if (a === "addSong") {
        const title = String(body.title || "").trim(), author = String(body.author || "Unknown").trim();
        if (title && !doc.songs.some(s => s.title.toLowerCase() === title.toLowerCase()))
          doc.songs.push({ id: uid("cs"), title, author });
      } else if (a === "deleteSong") {
        doc.songs = doc.songs.filter(s => s.id !== body.id);
      } else if (a === "addPerson") {
        const name = String(body.name || "").trim();
        const roles = (body.roles as string[]) || [];
        const ex = doc.people.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (ex) ex.roles = [...new Set([...ex.roles, ...roles])];
        else if (name) doc.people.push({ id: uid("p"), name, roles });
      } else if (a === "updatePerson") {
        const p = doc.people.find(x => x.id === body.id);
        if (p && Array.isArray(body.roles)) p.roles = body.roles as string[];
      } else if (a === "deletePerson") {
        doc.people = doc.people.filter(p => p.id !== body.id);
      } else if (a === "saveTeam") {
        const name = String(body.name || "").trim();
        const slots = (body.slots as TeamSlot[]) || [];
        const ex = doc.teams.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (ex) ex.slots = slots;
        else if (name) doc.teams.push({ id: uid("t"), name, slots });
      } else if (a === "deleteTeam") {
        doc.teams = doc.teams.filter(t => t.id !== body.id);
      }
      persistLocal(setlists, doc);
      return doc;
    });
  }, [cloud, persistLocal, setlists, say]);

  const sortedPeople = useMemo(() => [...church.people].sort(byName), [church.people]);
  const editing = editingId ? setlists.find(s => s.id === editingId) ?? null : null;

  const newSetlist = useCallback((date?: string, name?: string) => {
    const sl: Setlist = {
      id: uid("s"), name: name || "New setlist", favorite: false,
      updatedAt: new Date().toISOString(), date: date ?? nextSunday(), notes: "", songs: [], team: [],
    };
    commitSetlists(prev => [...prev, sl]);
    setEditingId(sl.id);
    setView("planner");
  }, [commitSetlists]);

  if (!mounted) return null;

  const navBtns = (
    <>
      {NAV.map(n => (
        <button key={n.id} className={`navbtn ${view === n.id ? "on" : ""}`}
          onClick={() => { setView(n.id); window.scrollTo({ top: 0 }); }}>
          {Icons[n.id]}{n.label}
        </button>
      ))}
    </>
  );

  return (
    <>
      <div className="sky"><div className="orb o1" /><div className="orb o2" /><div className="orb o3" /><div className="orb o4" /></div>
      <div className="grain" />
      <div className="shell">
        <nav className="dock glass" aria-label="Main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="mark"><img src="/logo.png" alt="Mount Greylock Baptist Church" /></span>
          {navBtns}
          <span className="authslot">
            {themeBtn}
            {cloud ? <UserButton /> : (isLoaded &&
              <SignInButton mode="modal"><button className="btn" style={{ padding: "7px 10px", fontSize: 12 }}>Sign in</button></SignInButton>)}
          </span>
        </nav>

        <main className="main">
          <header className="brandrow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" />
            <div>
              <div className="wordmark">Worship Lab</div>
              <div className="subtitle">Setlists &amp; worship teams · Mount Greylock Baptist Church</div>
            </div>
            <span className="spacer" />
            <span className="mobileauth" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {themeBtn}
              {cloud ? <UserButton /> : (isLoaded &&
                <SignInButton mode="modal"><button className="btn" style={{ fontSize: 12.5 }}>Sign in</button></SignInButton>)}
            </span>
          </header>
          {verse && (
            <div className="versebar glass">
              <span className="vtext">“{verse.text}”</span>
              <span className="vref">{verse.ref} · KJV</span>
            </div>
          )}
          {isLoaded && !isSignedIn && (
            <p className="syncnote">Browsing on this device only — sign in to plan with the whole worship team.</p>
          )}

          {view === "planner" && (
            editing
              ? <Editor key={editing.id} sl={editing} church={church} sortedPeople={sortedPeople}
                  onBack={() => setEditingId(null)}
                  onEdit={patch => editSetlist(editing.id, patch)}
                  onDelete={() => {
                    if (!confirm(`Delete “${editing.name}”? This can't be undone.`)) return;
                    commitSetlists(prev => prev.filter(s => s.id !== editing.id));
                    setEditingId(null);
                  }}
                  onSaveTeam={(name, slots) => { churchAction({ action: "saveTeam", name, slots }); say(`Saved team “${name}”`); }}
                  say={say} />
              : <PlannerHome setlists={setlists} onOpen={id => setEditingId(id)} onNew={() => newSetlist()} />
          )}
          {view === "library" && (
            <Library church={church} isAdmin={isAdmin} setlists={setlists}
              onAddToSetlist={(slId, song) => {
                const t = setlists.find(s => s.id === slId);
                if (!t) return;
                if (t.songs.length >= 60) { say("Setlist is full"); return; }
                editSetlist(slId, { songs: [...t.songs, song] });
                say(`Added to “${t.name}”`);
              }}
              onAddChurch={(title, author) => { churchAction({ action: "addSong", title, author }); say(`“${title}” added to church library`); }}
              onDeleteChurch={id => churchAction({ action: "deleteSong", id })} />
          )}
          {view === "team" && (
            <TeamView church={church} isAdmin={isAdmin} sortedPeople={sortedPeople}
              onAddPerson={(name, roles) => { churchAction({ action: "addPerson", name, roles }); say(`${name} added to the roster`); }}
              onUpdateRoles={(id, name, roles) => churchAction({ action: "updatePerson", id, name, roles })}
              onDeletePerson={id => churchAction({ action: "deletePerson", id })}
              onDeleteTeam={id => churchAction({ action: "deleteTeam", id })} />
          )}
          {view === "calendar" && (
            <CalendarView setlists={setlists}
              onOpen={id => { setEditingId(id); setView("planner"); }}
              onCreate={iso => newSetlist(iso, "Service — " + fmtDate(iso))} />
          )}

          <p className="footer">Make a joyful noise unto the LORD, all the earth — Psalm 98:4 (KJV)<br />
            {cloud ? "Synced with your worship team." : "Saved privately on this device."}</p>
        </main>
      </div>

      <nav className="tabbar glass" aria-label="Main">{navBtns}</nav>
      <div className={`toast glass ${toast ? "show" : ""}`}>{toast}</div>
    </>
  );
}

/* ---------------- planner home ---------------- */

function songSummary(s: Setlist) { return s.songs.map(x => x.title).join(" · "); }

function PlannerHome({ setlists, onOpen, onNew }: {
  setlists: Setlist[]; onOpen: (id: string) => void; onNew: () => void;
}) {
  const lists = [...setlists].sort((a, b) => (Number(b.favorite) - Number(a.favorite)) || (a.date || "9999").localeCompare(b.date || "9999"));
  const today = new Date().toISOString().slice(0, 10);
  const next = setlists.filter(s => s.date && s.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  return (
    <div className="view">
      {next && (
        <button className="hero glass" onClick={() => onOpen(next.id)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="steeple" src="/logo.png" alt="" />
          <div className="eyebrow">Next service</div>
          <div className="bigdate">{fmtDate(next.date, true)}</div>
          <div className="heroline">
            <span><b>{next.name}</b></span>
            <span>{next.songs.length} song{next.songs.length === 1 ? "" : "s"}</span>
            <span>{(next.team || []).length} on the worship team</span>
          </div>
          {next.songs.length > 0 && <div className="heroline" style={{ marginTop: 10 }}>{songSummary(next)}</div>}
        </button>
      )}
      <div className="libhead">
        <div className="eyebrow">Setlists</div>
        <button className="btn primary" onClick={onNew}>＋ New setlist</button>
      </div>
      <div className="grid">
        {lists.map(s => (
          <button key={s.id} className="card glass" onClick={() => onOpen(s.id)}>
            <h3>{s.favorite && <span className="fav">★</span>}{s.name}</h3>
            <div className="meta">{s.date ? fmtDate(s.date) + " · " : ""}{s.songs.length} songs · {(s.team || []).length} team</div>
            {s.songs.length > 0 && <div className="songpeek">{songSummary(s)}</div>}
          </button>
        ))}
        <button className="card glass newcard" onClick={onNew}>＋ New setlist</button>
      </div>
      {lists.length === 0 && <p className="empty">No setlists yet — start one for Sunday.</p>}
    </div>
  );
}

/* ---------------- editor ---------------- */

function Editor({ sl, church, sortedPeople, onBack, onEdit, onDelete, onSaveTeam, say }: {
  sl: Setlist; church: ChurchDoc; sortedPeople: Person[];
  onBack: () => void; onEdit: (patch: Partial<Setlist>) => void; onDelete: () => void;
  onSaveTeam: (name: string, slots: TeamSlot[]) => void; say: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [teamName, setTeamName] = useState("");
  const team = sl.team || [];

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const pool = [
      ...church.songs.map(s => ({ title: s.title, author: s.author, src: "Church library" })),
      ...CATALOG.map(s => ({ title: s.title, author: s.author, src: s.category === "modern" ? "Modern" : "Traditional" })),
    ];
    const seen = new Set<string>(); const out: typeof pool = [];
    for (const s of pool) {
      const k = (s.title + "|" + s.author).toLowerCase();
      if (seen.has(k)) continue;
      if (s.title.toLowerCase().includes(needle) || s.author.toLowerCase().includes(needle)) { seen.add(k); out.push(s); }
      if (out.length >= 24) break;
    }
    return out;
  }, [q, church.songs]);

  const moveSong = (i: number, dir: number) => {
    const j = i + dir; if (j < 0 || j >= sl.songs.length) return;
    const songs = [...sl.songs]; [songs[i], songs[j]] = [songs[j], songs[i]];
    onEdit({ songs });
  };
  const moveSlot = (i: number, dir: number) => {
    const j = i + dir; if (j < 0 || j >= team.length) return;
    const t = [...team]; [t[i], t[j]] = [t[j], t[i]];
    onEdit({ team: t });
  };

  const copySetlist = () => {
    const lines = [sl.name + (sl.date ? " — " + fmtDate(sl.date, true) : ""), ""];
    sl.songs.forEach((s, i) => lines.push(`${i + 1}. ${s.title}${s.key ? ` (${s.key})` : ""} — ${s.author}`));
    if (team.length) { lines.push("", "Worship team:"); team.forEach(t => lines.push(`• ${t.role || "—"}: ${t.person || "—"}`)); }
    if (sl.notes) lines.push("", sl.notes);
    navigator.clipboard?.writeText(lines.join("\n")).then(() => say("Setlist copied"), () => say("Couldn't copy"));
  };

  return (
    <div className="view">
      <div className="edhead">
        <button className="btn ghost" onClick={onBack}>‹ All setlists</button>
        <input className="name" defaultValue={sl.name} aria-label="Setlist name"
          onBlur={e => onEdit({ name: e.target.value.trim().slice(0, 80) || "Untitled" })} />
        <input type="date" value={sl.date || ""} aria-label="Service date"
          onChange={e => onEdit({ date: e.target.value })} />
        <button className="icobtn" title="Favorite" style={{ fontSize: 17 }}
          onClick={() => onEdit({ favorite: !sl.favorite })}>{sl.favorite ? <span className="fav">★</span> : "☆"}</button>
        <button className="btn ghost danger" onClick={onDelete}>Delete</button>
      </div>
      <div className="edgrid">
        <div className="panel glass">
          <h2>Songs <span className="chip gray">{sl.songs.length}</span></h2>
          <div className="rows">
            {sl.songs.map((s, i) => (
              <div className="row" key={i + s.title}>
                <span className="num">{i + 1}</span>
                <div className="grow"><div className="t">{s.title}</div><div className="a">{s.author}</div></div>
                <select className="key" value={s.key || ""} aria-label="Key"
                  onChange={e => onEdit({ songs: sl.songs.map((x, xi) => xi === i ? { ...x, key: e.target.value } : x) })}>
                  {KEYS.map(k => <option key={k} value={k}>{k || "Key"}</option>)}
                </select>
                <span className="arrows">
                  <button className="icobtn" disabled={i === 0} onClick={() => moveSong(i, -1)} aria-label="Move up">▲</button>
                  <button className="icobtn" disabled={i === sl.songs.length - 1} onClick={() => moveSong(i, 1)} aria-label="Move down">▼</button>
                </span>
                <button className="icobtn" onClick={() => onEdit({ songs: sl.songs.filter((_, xi) => xi !== i) })} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
          {sl.songs.length === 0 && <p className="empty">No songs yet — search below to add.</p>}
          <div className="addline">
            <input placeholder="Search the catalog & church library…" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" />
          </div>
          {q.trim() && (
            <>
              <div className="results">
                {hits.map((s, i) => (
                  <button className="hit glass" key={i} onClick={() => {
                    if (sl.songs.length >= 60) { say("Setlist is full"); return; }
                    onEdit({ songs: [...sl.songs, { title: s.title, author: s.author, key: "" }] });
                    say(`Added “${s.title}”`);
                  }}>
                    <div className="grow"><div className="t">{s.title}</div><div className="a">{s.author}</div></div>
                    <span className="chip gray">{s.src}</span>
                  </button>
                ))}
                {hits.length === 0 && <p className="empty">Nothing found — try SongSelect below.</p>}
              </div>
              <div className="ssrow">
                <a className="sslink" target="_blank" rel="noreferrer" href={songselectSearchUrl(q.trim())}>
                  Search SongSelect for “{q.trim()}” ↗</a>
              </div>
            </>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={copySetlist}>⧉ Copy setlist</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="panel glass">
            <h2>Worship team <span className="chip gray">{team.length}</span></h2>
            <div className="rows">
              {team.map((t, i) => (
                <div className="row" key={i}>
                  <select className="role" value={t.role} aria-label="Role"
                    onChange={e => onEdit({ team: team.map((x, xi) => xi === i ? { ...x, role: e.target.value } : x) })}>
                    <option value="">— role —</option>
                    {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <select className="person" value={t.person} aria-label="Person"
                    onChange={e => onEdit({ team: team.map((x, xi) => xi === i ? { ...x, person: e.target.value } : x) })}>
                    <option value="">— person —</option>
                    {sortedPeople.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <span className="arrows">
                    <button className="icobtn" disabled={i === 0} onClick={() => moveSlot(i, -1)} aria-label="Move up">▲</button>
                    <button className="icobtn" disabled={i === team.length - 1} onClick={() => moveSlot(i, 1)} aria-label="Move down">▼</button>
                  </span>
                  <button className="icobtn" onClick={() => onEdit({ team: team.filter((_, xi) => xi !== i) })} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
            <div className="teamtools">
              <button className="btn" onClick={() => { if (team.length < 20) onEdit({ team: [...team, { role: "", person: "" }] }); }}>＋ Add a role</button>
              {church.teams.length > 0 && (
                <select value="" onChange={e => {
                  const t = church.teams.find(x => x.id === e.target.value);
                  if (t) { onEdit({ team: t.slots.map(s => ({ ...s })) }); say(`Loaded “${t.name}”`); }
                }}>
                  <option value="">Load a saved team…</option>
                  {[...church.teams].sort(byName).map(t => <option key={t.id} value={t.id}>{t.name} ({t.slots.length})</option>)}
                </select>
              )}
            </div>
            <div className="teamtools">
              <input placeholder="Save as team… (name)" value={teamName} onChange={e => setTeamName(e.target.value)} />
              <button className="btn" onClick={() => {
                const name = teamName.trim().slice(0, 60);
                if (!name) { say("Give the team a name first"); return; }
                if (!team.length) { say("Add some roles first"); return; }
                onSaveTeam(name, team.filter(t => t.role || t.person));
                setTeamName("");
              }}>Save team</button>
            </div>
          </div>
          <div className="panel glass notes">
            <h2>Notes</h2>
            <textarea defaultValue={sl.notes || ""} placeholder="Flow, keys, transitions, who's praying…"
              onBlur={e => onEdit({ notes: e.target.value.slice(0, 500) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- library ---------------- */

function Library({ church, isAdmin, setlists, onAddToSetlist, onAddChurch, onDeleteChurch }: {
  church: ChurchDoc; isAdmin: boolean; setlists: Setlist[];
  onAddToSetlist: (setlistId: string, song: SLSong) => void;
  onAddChurch: (title: string, author: string) => void;
  onDeleteChurch: (id: string) => void;
}) {
  const [ssq, setSsq] = useState("");
  const [cat, setCat] = useState<"all" | "modern" | "traditional">("all");
  const [q, setQ] = useState("");
  const [targetId, setTargetId] = useState("");
  const lists = [...setlists].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const target = lists.find(s => s.id === targetId);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CATALOG.filter(s =>
      (cat === "all" || s.category === cat) &&
      (!needle || s.title.toLowerCase().includes(needle) || s.author.toLowerCase().includes(needle)));
  }, [q, cat]);
  const shown = rows.slice(0, 60);

  const add = (title: string, author: string) => {
    if (!target) { alert("Pick a setlist to add songs to first."); return; }
    onAddToSetlist(target.id, { title, author, key: "" });
  };
  const ssFor = (title: string, author: string) => songselectSearchUrl(title, author);

  return (
    <div className="view">
      <div className="ssearch glass">
        <div className="eyebrow">SongSelect by CCLI</div>
        <h2 style={{ fontSize: 19, marginTop: 4 }}>Search SongSelect directly</h2>
        <p style={{ color: "var(--steel)", fontSize: 13, marginTop: 3 }}>
          Jump straight to charts &amp; lyrics on your church&apos;s SongSelect subscription — no song selection needed.</p>
        <div className="bar">
          <input placeholder="Song title, author, or CCLI number…" value={ssq} autoComplete="off" enterKeyHint="search"
            onChange={e => setSsq(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && ssq.trim()) window.open(songselectSearchUrl(ssq.trim()), "_blank", "noopener"); }} />
          <a className="btn primary" target="_blank" rel="noreferrer"
            href={ssq.trim() ? songselectSearchUrl(ssq.trim()) : "https://songselect.ccli.com"}>Search ↗</a>
        </div>
      </div>

      <div className="panel glass" style={{ marginBottom: 18 }}>
        <h2>Church library <span className="chip gray">{church.songs.length}</span></h2>
        <div className="targetline" style={{ marginBottom: 10 }}>
          Adding songs to:
          <select value={targetId} onChange={e => setTargetId(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">— pick a setlist —</option>
            {lists.map(s => <option key={s.id} value={s.id}>{s.name}{s.date ? " · " + fmtDate(s.date) : ""}</option>)}
          </select>
        </div>
        <div className="catlist">
          {[...church.songs].sort((a, b) => a.title.localeCompare(b.title)).map(s => (
            <div className="catrow glass" key={s.id}>
              <div className="grow"><div className="t">{s.title}</div><div className="a">{s.author}</div></div>
              <div className="acts">
                <button className="btn" onClick={() => add(s.title, s.author)}>＋ Setlist</button>
                <a className="icobtn" target="_blank" rel="noreferrer" href={ssFor(s.title, s.author)} title="Open on SongSelect">↗</a>
                {isAdmin && <button className="icobtn" title="Remove from church library"
                  onClick={() => { if (confirm(`Remove “${s.title}” from the church library?`)) onDeleteChurch(s.id); }}>✕</button>}
              </div>
            </div>
          ))}
        </div>
        {church.songs.length === 0 && <p className="empty">The church library is empty — add favorites from the catalog below.</p>}
      </div>

      <div className="panel glass">
        <h2>Worship catalog <span className="chip gray">{rows.length}</span></h2>
        <div className="libhead">
          <input placeholder={`Search ${CATALOG.length} songs…`} value={q} onChange={e => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 170 }} autoComplete="off" />
          <div className="seg" role="tablist">
            {(["all", "modern", "traditional"] as const).map(c => (
              <button key={c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
                {c === "all" ? "All" : c === "modern" ? "Modern" : "Traditional"}</button>
            ))}
          </div>
        </div>
        <div className="catlist">
          {shown.map(s => {
            const inCh = church.songs.some(c => c.title.toLowerCase() === s.title.toLowerCase());
            return (
              <div className="catrow glass" key={s.id}>
                <div className="grow"><div className="t">{s.title}</div><div className="a">{s.author}</div></div>
                <span className="chip gray">{s.category === "modern" ? "Modern" : "Traditional"}</span>
                <div className="acts">
                  <button className="btn" onClick={() => add(s.title, s.author)}>＋ Setlist</button>
                  <button className="icobtn" disabled={inCh} title={inCh ? "Already in church library" : "Add to church library"}
                    onClick={() => onAddChurch(s.title, s.author)}>{inCh ? "✓" : "♥"}</button>
                  <a className="icobtn" target="_blank" rel="noreferrer" href={ssFor(s.title, s.author)} title="Open on SongSelect">↗</a>
                </div>
              </div>
            );
          })}
        </div>
        <div className="countnote">
          {rows.length > shown.length ? `Showing ${shown.length} of ${rows.length} — keep typing to narrow.` : `${rows.length} song${rows.length === 1 ? "" : "s"}.`}
        </div>
      </div>
    </div>
  );
}

/* ---------------- team ---------------- */

function TeamView({ church, isAdmin, sortedPeople, onAddPerson, onUpdateRoles, onDeletePerson, onDeleteTeam }: {
  church: ChurchDoc; isAdmin: boolean; sortedPeople: Person[];
  onAddPerson: (name: string, roles: string[]) => void;
  onUpdateRoles: (id: string, name: string, roles: string[]) => void;
  onDeletePerson: (id: string) => void;
  onDeleteTeam: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  return (
    <div className="view">
      <div className="libhead"><div className="eyebrow">Worship team roster</div><span className="chip gray">{church.people.length} members</span></div>
      <div className="teamgrid">
        {sortedPeople.map(p => (
          <div className="pcard glass" key={p.id}>
            <div className="prow">
              <h3>{p.name}</h3>
              {isAdmin && <button className="icobtn" title="Remove"
                onClick={() => { if (confirm(`Remove ${p.name} from the roster?`)) onDeletePerson(p.id); }}>✕</button>}
            </div>
            <div className="chips">
              {TEAM_ROLES.map(r => {
                const on = p.roles.includes(r);
                return <button key={r} className={`chip rolechip ${on ? "" : "off"}`}
                  onClick={() => onUpdateRoles(p.id, p.name, on ? p.roles.filter(x => x !== r) : [...p.roles, r].slice(0, 8))}>{r}</button>;
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="addperson glass">
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Add a team member</h2>
        <div className="addline" style={{ marginTop: 10 }}>
          <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        </div>
        <div className="chips">
          {TEAM_ROLES.map(r => (
            <button key={r} className={`chip rolechip ${pending.includes(r) ? "" : "off"}`}
              onClick={() => setPending(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])}>{r}</button>
          ))}
        </div>
        <button className="btn primary" onClick={() => {
          const n = name.trim().slice(0, 80);
          if (!n) return;
          onAddPerson(n, pending);
          setName(""); setPending([]);
        }}>Add to roster</button>
      </div>

      <div className="libhead" style={{ marginTop: 26 }}><div className="eyebrow">Saved worship teams</div><span className="chip gray">{church.teams.length}</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...church.teams].sort(byName).map(t => (
          <div className="savedteam glass" key={t.id}>
            <div className="strow">
              <b>{t.name}</b>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="chip gray">{t.slots.length} member{t.slots.length === 1 ? "" : "s"}</span>
                {isAdmin && <button className="icobtn" title="Delete team"
                  onClick={() => { if (confirm(`Delete team “${t.name}”?`)) onDeleteTeam(t.id); }}>✕</button>}
              </span>
            </div>
            <div className="slots">
              {t.slots.map((s, i) => <span key={i}><b>{s.person || "—"}</b> · {s.role || "—"}&ensp;&ensp;</span>)}
            </div>
          </div>
        ))}
      </div>
      {church.teams.length === 0 && <p className="empty">No saved teams yet — assemble one inside a setlist and “Save as team”.</p>}
    </div>
  );
}

/* ---------------- calendar ---------------- */

function CalendarView({ setlists, onOpen, onCreate }: {
  setlists: Setlist[]; onOpen: (id: string) => void; onCreate: (iso: string) => void;
}) {
  const now = new Date();
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth()]);
  const [y, m] = ym;
  const first = new Date(y, m, 1);
  const label = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const startDow = first.getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const byDate: Record<string, Setlist[]> = {};
  setlists.forEach(s => { if (s.date) (byDate[s.date] = byDate[s.date] || []).push(s); });

  const cells: { d: number; iso?: string; dim?: boolean }[] = [];
  for (let i = startDow - 1; i >= 0; i--) cells.push({ d: prevDays - i, dim: true });
  for (let d = 1; d <= daysIn; d++) {
    cells.push({ d, iso: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
  }
  let tail = 0;
  while (cells.length % 7) cells.push({ d: ++tail, dim: true });

  return (
    <div className="view">
      <div className="cal glass">
        <div className="calnav">
          <button className="icobtn" style={{ fontSize: 16 }} aria-label="Previous month"
            onClick={() => setYm(([yy, mm]) => mm === 0 ? [yy - 1, 11] : [yy, mm - 1])}>‹</button>
          <h2>{label}</h2>
          <button className="icobtn" style={{ fontSize: 16 }} aria-label="Next month"
            onClick={() => setYm(([yy, mm]) => mm === 11 ? [yy + 1, 0] : [yy, mm + 1])}>›</button>
        </div>
        <div className="calgrid">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div className="dow" key={i}>{d}</div>)}
          {cells.map((c, i) => c.dim
            ? <div className="day dim" key={i}>{c.d}</div>
            : <button className={`day ${c.iso === today ? "today" : ""}`} key={i}
                onClick={() => { const hit = byDate[c.iso!]?.[0]; hit ? onOpen(hit.id) : onCreate(c.iso!); }}>
                {c.d}{byDate[c.iso!] && <span className="dot" />}
              </button>)}
        </div>
        <p className="callegend">A blue bar marks a service with a setlist. Tap any day to plan it.</p>
      </div>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.keys(byDate).sort().filter(d => d >= today).slice(0, 6).flatMap(d => byDate[d].map(s => (
          <button className="row glass" key={s.id} style={{ cursor: "pointer", width: "100%" }} onClick={() => onOpen(s.id)}>
            <div className="grow" style={{ textAlign: "left" }}>
              <div className="t">{s.name}</div>
              <div className="a">{fmtDate(d, true)} · {s.songs.length} songs</div>
            </div>
            <span className="chip">Open ›</span>
          </button>
        )))}
      </div>
    </div>
  );
}
