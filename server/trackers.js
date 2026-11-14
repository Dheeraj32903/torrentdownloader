import https from 'node:https';

// Default high-speed fallback trackers (UDP, HTTPS, and WebSocket)
export const DEFAULT_TRACKERS = [
  // Top-tier UDP Trackers
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
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://tracker.bitsearch.to:1337/announce',
  'udp://retracker.lanta-net.ru:2710/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
  'udp://tracker.swatech.info:2710/announce',
  'udp://movies.zsw.ca:6969/announce',

  // Top-tier HTTPS Trackers (Bypasses ISP UDP block in India & restricted networks)
  'https://tr.zukizuki.org:443/announce',
  'https://tracker.pmman.tech:443/announce',
  'https://ht.therarbg.to:443/announce',
  'https://tracker.tamersunion.org:443/announce',
  'https://tracker.foreverpirates.co:443/announce',
  'https://004430.xyz:443/announce',
  'https://tracker.zhuqiy.com:443/announce',
  'https://tracker.lilithraws.org:443/announce',
  'https://open.tracker.ink:443/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'http://tracker.bt4g.com:2095/announce',

  // WebSocket WebTorrent Trackers (Browser-to-Swarm & WebRTC hybrid)
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.fastcast.nz'
];

let cachedTrackers = [...DEFAULT_TRACKERS];
let lastFetchedTime = 0;

/**
 * Dynamically fetches the daily updated ngosang/trackerslist from GitHub
 */
export async function updateTrackersList() {
  const now = Date.now();
  // Refresh cache every 6 hours
  if (now - lastFetchedTime < 6 * 60 * 60 * 1000 && cachedTrackers.length > 80) {
    return cachedTrackers;
  }

  const trackerUrls = [
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all.txt',
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all_http.txt',
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt',
    'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_all_ip.txt',
    'https://cdn.jsdelivr.net/gh/ngosang/trackerslist@master/trackers_all.txt'
  ];

  const fetchedLists = await Promise.all(
    trackerUrls.map(url => fetchText(url).catch(() => ''))
  );

  const set = new Set(DEFAULT_TRACKERS);
  for (const text of fetchedLists) {
    if (text && text.trim().length > 0) {
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('udp://') || l.startsWith('http://') || l.startsWith('https://') || l.startsWith('wss://'));
      for (const line of lines) {
        set.add(line);
      }
    }
  }

  if (set.size > DEFAULT_TRACKERS.length) {
    cachedTrackers = Array.from(set);
    lastFetchedTime = now;
    console.log(`[Trackers] Aggregated ${cachedTrackers.length} active global BitTorrent trackers.`);
  }

  return cachedTrackers;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 6000 }, (res) => {
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

  const size = xlMatch ? parseInt(xlMatch[1], 10) : 0;
  return { infoHash, name, size };
}

/**
 * Enhances a magnet link by appending all high-speed trackers
 */
export function enhanceMagnet(magnetUri) {
  if (typeof magnetUri !== 'string' || !magnetUri.startsWith('magnet:')) return magnetUri;

  const trackers = getCachedTrackers();
  const existingTrackers = new Set();
  const trMatches = magnetUri.match(/[?&]tr=([^&]+)/g);
  if (trMatches) {
    trMatches.forEach(m => {
      const val = decodeURIComponent(m.slice(4));
      existingTrackers.add(val);
    });
  }

  let enhanced = magnetUri;
  for (const tr of trackers) {
    if (!existingTrackers.has(tr)) {
      enhanced += `&tr=${encodeURIComponent(tr)}`;
    }
  }

  return enhanced;
}

export function getCachedTrackers() {
  return cachedTrackers;
}

// Initial background load
updateTrackersList().catch(() => {});
