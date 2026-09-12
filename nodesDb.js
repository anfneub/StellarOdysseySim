// Client-side store for gathering node data returned by /api/public/systems.
// Flattens each system's `bodies` into one record per body and keeps them in
// IndexedDB, indexed by nodeType/nodeQuality, so a future filter UI can query
// "all nodes of type X with quality >= Y" without re-scanning the raw API payload.
const NodesDB = (() => {
    const DB_NAME = 'stellarOdysseySim';
    const DB_VERSION = 1;
    const STORE_NAME = 'gatheringNodes';

    let dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('nodeType', 'nodeType', { unique: false });
                    store.createIndex('nodeQuality', 'nodeQuality', { unique: false });
                    store.createIndex('nodeType_nodeQuality', ['nodeType', 'nodeQuality'], { unique: false });
                    store.createIndex('systemName', 'systemName', { unique: false });
                    store.createIndex('hasNodes', 'hasNodes', { unique: false });
                }
            };
            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
        });
        return dbPromise;
    }

    // One row per body: system context + that body's node type/quality.
    function extractNodeRecords(systems) {
        const records = [];
        for (const system of systems) {
            if (!Array.isArray(system.bodies)) continue;
            system.bodies.forEach((body, index) => {
                records.push({
                    id: `${system.name}::${index}`,
                    systemName: system.name,
                    coordinateX: system.coordinate_x,
                    coordinateY: system.coordinate_y,
                    star: system.star,
                    starter: !!system.starter,
                    bodyIndex: index,
                    bodyType: body.type,
                    hasNodes: !!body.hasNodes,
                    nodeType: body.nodeType || '',
                    nodeQuality: body.nodeQuality || 0
                });
            });
        }
        return records;
    }

    // Replaces the whole table with the freshly fetched systems list.
    async function saveSystems(systems) {
        if (!Array.isArray(systems) || systems.length === 0) return;
        try {
            const db = await openDb();
            const records = extractNodeRecords(systems);
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                const store = tx.objectStore(STORE_NAME);
                store.clear();
                for (const record of records) {
                    store.put(record);
                }
            });
        } catch (err) {
            console.error('NodesDB: failed to save systems data', err);
        }
    }

    async function getAll() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Exact-match lookup, e.g. queryByNodeType('icy').
    async function queryByNodeType(nodeType) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const index = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('nodeType');
            const request = index.getAll(nodeType);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Range lookup, e.g. queryByQualityRange(20, 50).
    async function queryByQualityRange(min, max) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const index = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('nodeQuality');
            const range = IDBKeyRange.bound(min, max);
            const request = index.getAll(range);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    return { saveSystems, getAll, queryByNodeType, queryByQualityRange };
})();
