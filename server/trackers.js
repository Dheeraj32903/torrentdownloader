import https from 'https';

// Default high-speed fallback trackers (in case remote fetch is offline)
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

let cachedTrackers = [...DEFAULT_TRACKERS];
let lastFetchedTime = 0;

/**
 * Dynamically fetches the daily updated ngosang/trackerslist from GitHub
 */
export async function updateTrackersList() {
  const now = Date.now();
  // Refresh cache every 12 hours
  if (now - lastFetchedTime < 12 * 60 * 60 * 1000 && cachedTrackers.length > DEFAULT_TRACKERS.length) {
    return cachedTrackers;
  }

  const trackerUrls = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all.txt',
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all_ip.txt',
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_all.txt'
  ];

  for (const url of trackerUrls) {
    try {
      const text = await fetchText(url);
      if (text && text.trim().length > 0) {
        const lines = text
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.startsWith('udp://') || l.startsWith('http://') || l.startsWith('https://'));

        if (lines.length > 5) {
          // Merge unique trackers
          const set = new Set([...DEFAULT_TRACKERS, ...lines]);
          cachedTrackers = Array.from(set);
          lastFetchedTime = now;
          console.log(`[Trackers] Dynamically loaded ${cachedTrackers.length} active BitTorrent trackers from ngosang/trackerslist.`);
          return cachedTrackers;
        }
      }
    } catch (err) {
      // Try next mirror
    }
  }

  return cachedTrackers;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

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
 * Ensures a magnet URI includes top active public trackers
 */
export function enhanceMagnet(magnetUri) {
  if (!magnetUri || typeof magnetUri !== 'string') return magnetUri;
  
  const existingTrackers = new Set();
  const trMatches = magnetUri.matchAll(/[?&]tr=([^&]+)/g);
  for (const match of trMatches) {
    try {
      existingTrackers.add(decodeURIComponent(match[1]));
    } catch {}
  }

  let enhanced = magnetUri;
  for (const tr of cachedTrackers) {
    if (!existingTrackers.has(tr)) {
      enhanced += `&tr=${encodeURIComponent(tr)}`;
    }
  }

  return enhanced;
}

// Kick off dynamic background fetch on startup
updateTrackersList().catch(() => {});

export function getCachedTrackers() {
  return cachedTrackers;
}
