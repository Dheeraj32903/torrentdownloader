// Best high-speed public BitTorrent trackers
export const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorn-tracker.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://explodie.org:6969/announce',
  'udp://uploads.gamecoast.net:5544/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://tracker.auctor.tv:6969/announce',
  'udp://tracker.theoks.net:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://tracker.altrosky.nl:6969/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://tracker.bitsearch.to:1337/announce',
  'udp://retracker.lanta-net.ru:2710/announce'
];

/**
 * Parses infoHash, display name, and file size from magnet link synchronously
 */
export function parseMagnetQuick(magnetUri) {
  if (typeof magnetUri !== 'string') return { infoHash: null, name: null, size: 0 };
  const xtMatch = magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
  const dnMatch = magnetUri.match(/[?&]dn=([^&]+)/i);
  const xlMatch = magnetUri.match(/[?&]xl=(\d+)/i);

  let infoHash = xtMatch ? xtMatch[1].toLowerCase() : null;
  let name = null;
  if (dnMatch) {
    try {
      name = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
    } catch {
      name = dnMatch[1];
    }
  }

  let size = 0;
  if (xlMatch) {
    try {
      size = parseInt(xlMatch[1], 10);
    } catch {}
  }

  return { infoHash, name, size };
}

/**
 * Ensures a magnet URI includes top public trackers
 */
export function enhanceMagnet(magnetUri) {
  if (!magnetUri || typeof magnetUri !== 'string') return magnetUri;
  
  // Check which trackers are already in the magnet
  const existingTrackers = new Set();
  const trMatches = magnetUri.matchAll(/[?&]tr=([^&]+)/g);
  for (const match of trMatches) {
    try {
      existingTrackers.add(decodeURIComponent(match[1]));
    } catch {}
  }

  let enhanced = magnetUri;
  for (const tr of DEFAULT_TRACKERS) {
    if (!existingTrackers.has(tr)) {
      enhanced += `&tr=${encodeURIComponent(tr)}`;
    }
  }

  return enhanced;
}
