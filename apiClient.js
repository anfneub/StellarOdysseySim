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

// Incremental parser for a JSON document whose bulk is one large array, e.g.
// {"systems":[{...},{...},...]}. Text is pushed in as it downloads; complete
// elements of `arrayKey` are parsed in batches of roughly `batchBytes`, appended
// to result[arrayKey] and handed to onItems, so the full payload never has to sit in memory as a
// single string or be parsed in one long main-thread block.
// The other top-level values are parsed normally and returned by finish().
// A root that is itself an array is streamed as if it were {[arrayKey]: [...]}.
// Array elements must be objects or arrays (true for every list this API returns).
class JsonArrayStreamParser {
    constructor(arrayKey, onItems, batchBytes = 2 * 1024 * 1024) {
        this.arrayKey = arrayKey;
        this.onItems = onItems;
        this.batchBytes = batchBytes;
        this.result = {};

        this.buf = '';
        this.i = 0;
        this.depth = 0;
        this.inString = false;
        this.escaped = false;
        this.started = false;       // Seen the root value
        this.elementDepth = -1;     // Depth of the streamed array's contents, -1 when not streaming
        this.awaitingKey = false;
        this.awaitingValue = false;
        this.key = null;
        this.keyStart = -1;
        this.valueStart = -1;       // Start of a non-streamed top-level value
        this.batchStart = -1;       // Start of the first element in the pending batch
        this.batchEnd = -1;         // End of the last complete element in the pending batch
    }

    push(text) {
        this.buf += text;
        this.scan();
        this.compact();
    }

    finish() {
        if (!this.started || this.depth !== 0 || this.inString) {
            throw new Error('Incomplete JSON response: the download ended early');
        }
        return this.result;
    }

    flushBatch() {
        if (this.batchStart < 0) return;
        const items = JSON.parse('[' + this.buf.slice(this.batchStart, this.batchEnd) + ']');
        this.batchStart = -1;
        this.batchEnd = -1;
        const list = this.result[this.arrayKey];
        for (let k = 0; k < items.length; k++) list.push(items[k]);
        if (this.onItems) this.onItems(items);
    }

    scan() {
        const buf = this.buf;
        const len = buf.length;
        for (; this.i < len; this.i++) {
            if (this.inString) {
                if (this.escaped) {
                    this.escaped = false;
                    continue;
                }
                // Jump to the next quote; if a backslash comes first, step past that escape instead
                const quote = buf.indexOf('"', this.i);
                const end = quote < 0 ? len : quote;
                let backslash = -1;
                for (let k = this.i; k < end; k++) {
                    if (buf.charCodeAt(k) === 92) { backslash = k; break; }
                }
                if (backslash >= 0) {
                    this.i = backslash;
                    this.escaped = true;
                    continue;
                }
                if (quote < 0) {
                    this.i = len;
                    break;
                }
                this.i = quote;
                this.inString = false;
                if (this.keyStart >= 0) {
                    this.key = JSON.parse(buf.slice(this.keyStart, quote + 1));
                    this.keyStart = -1;
                }
                continue;
            }

            const c = buf.charCodeAt(this.i);
            if (c === 32 || c === 10 || c === 13 || c === 9) continue;

            if (!this.started) {
                this.started = true;
                if (c === 91) {                                   // root is an array
                    this.elementDepth = 1;
                    this.result[this.arrayKey] = [];
                } else if (c !== 123) {
                    throw new Error('Unexpected JSON response: expected an object or array');
                }
            }

            if (this.depth === 1 && this.elementDepth !== 1) {
                if (this.awaitingKey && c === 34) {
                    this.awaitingKey = false;
                    this.keyStart = this.i;
                } else if (c === 58) {                            // colon
                    this.awaitingValue = true;
                    continue;
                } else if (this.awaitingValue) {
                    this.awaitingValue = false;
                    if (c === 91 && this.key === this.arrayKey) {
                        this.elementDepth = 2;
                        this.result[this.arrayKey] = [];
                    } else {
                        this.valueStart = this.i;
                    }
                } else if ((c === 44 || c === 125) && this.valueStart >= 0) {   // , or } ends a plain value
                    this.result[this.key] = JSON.parse(buf.slice(this.valueStart, this.i));
                    this.valueStart = -1;
                }
                if (c === 44) this.awaitingKey = true;
            }

            if (c === 34) {
                this.inString = true;
            } else if (c === 123 || c === 91) {                   // { or [
                if (this.depth === this.elementDepth && this.batchStart < 0) this.batchStart = this.i;
                this.depth++;
                if (this.depth === 1 && c === 123) this.awaitingKey = true;
            } else if (c === 125 || c === 93) {                   // } or ]
                this.depth--;
                if (this.depth === this.elementDepth) {
                    this.batchEnd = this.i + 1;
                    if (this.batchEnd - this.batchStart >= this.batchBytes) this.flushBatch();
                } else if (this.depth === this.elementDepth - 1) {  // streamed array closed
                    this.flushBatch();
                    this.elementDepth = -1;
                }
            }
        }
    }

    // Drop text that has been fully consumed so the buffer stays about one batch long
    compact() {
        let keep = this.i;
        for (const pos of [this.keyStart, this.valueStart, this.batchStart]) {
            if (pos >= 0 && pos < keep) keep = pos;
        }
        if (keep === 0) return;
        this.buf = this.buf.slice(keep);
        this.i -= keep;
        if (this.keyStart >= 0) this.keyStart -= keep;
        if (this.valueStart >= 0) this.valueStart -= keep;
        if (this.batchStart >= 0) this.batchStart -= keep;
        if (this.batchEnd >= 0) this.batchEnd -= keep;
    }
}

// fetchGameApi + streamed JSON parsing for endpoints that return one large list.
// Returns { response, data }; data is null when the response is not ok (the body
// is left unread so the caller can report the status as before).
// Callbacks:
//   onResponse(response)  - headers received, before any items (response.apiServer is set)
//   onItems(items)        - each parsed batch, in order; data[arrayKey] already includes them
//   onProgress(bytes)     - decompressed bytes received so far
async function fetchGameApiStreamed(path, options, { arrayKey, onResponse, onItems, onProgress } = {}) {
    const response = await fetchGameApi(path, options);
    if (!response.ok) return { response, data: null };
    if (onResponse) onResponse(response);

    const parser = new JsonArrayStreamParser(arrayKey, onItems);

    if (!response.body || typeof TextDecoder === 'undefined') {
        // Very old browsers: no streaming, but the same result shape
        parser.push(await response.text());
        return { response, data: parser.finish() };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        parser.push(decoder.decode(value, { stream: true }));
        if (onProgress) onProgress(bytes);
    }
    parser.push(decoder.decode());
    return { response, data: parser.finish() };
}
