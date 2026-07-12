// SongSelect by CCLI deep links — the "no permission needed" integration.
// We link out to SongSelect's search / song pages; the church's own
// SongSelect subscription handles access to the licensed charts.

export function songselectSearchUrl(title: string, author?: string): string {
  const q = author ? `${title} ${author.split("·")[0].split("&")[0].trim()}` : title;
  return `https://songselect.ccli.com/search/results?SearchText=${encodeURIComponent(q)}`;
}

export function songselectSongUrl(ccli: string): string {
  return `https://songselect.ccli.com/songs/${encodeURIComponent(ccli)}`;
}
