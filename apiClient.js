// Shared client for the Stellar Odyssey public API.
// Tries the primary server first; if it responds 404 (player/key not found there),
// falls back to the Steam server. Any other status or a network error is returned/thrown
// immediately without falling back.

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
        if (response.status === 404 && !isLastServer) {
            continue;
        }
        return response;
    }
    return response;
}
