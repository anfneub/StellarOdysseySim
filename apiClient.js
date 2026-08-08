// Shared client for the Stellar Odyssey public API.
// Tries the primary server first; if it responds with a "key/player not found here"
// status, falls back to the Steam server. Any other status or a network error is
// returned/thrown immediately without falling back.
//
// The primary server isn't consistent about how it reports "this key isn't mine":
// /api/public/user does a DB lookup and returns 404. Every other public endpoint
// (systems, journal, dungeons, stations, activerunes) never does that lookup - it
// returns a generic 403 {"msg":"API Key missing"} for a missing, malformed, or
// simply foreign (e.g. Steam-only) key. Both statuses are therefore treated as
// fallback triggers.
const NOT_FOUND_STATUSES = [404, 403];

const STELLAR_API_SERVERS = [
    { name: 'primary', baseUrl: 'https://api.stellarodyssey.app' },
    { name: 'steam', baseUrl: 'https://steamapi.stellarodyssey.app' }
];

async function fetchGameApi(path, options = {}) {
    let response;
    for (let i = 0; i < STELLAR_API_SERVERS.length; i++) {
        const server = STELLAR_API_SERVERS[i];
        response = await fetch(server.baseUrl + path, options);
        response.apiServer = server.name;
        response.apiBaseUrl = server.baseUrl;

        const isLastServer = i === STELLAR_API_SERVERS.length - 1;
        if (NOT_FOUND_STATUSES.includes(response.status) && !isLastServer) {
            continue;
        }
        return response;
    }
    return response;
}
