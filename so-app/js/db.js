const DB_NAME = 'droplog_so';
const DB_VERSION = 1;

function dbOpen() {
    return new Promise(function(resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('routes')) {
                db.createObjectStore('routes', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('stops')) {
                var store = db.createObjectStore('stops', { keyPath: 'id' });
                store.createIndex('route_id', 'route_id', { unique: false });
            }
            if (!db.objectStoreNames.contains('products')) {
                var store2 = db.createObjectStore('products', { keyPath: 'id' });
                store2.createIndex('route_stop_id', 'route_stop_id', { unique: false });
            }
            if (!db.objectStoreNames.contains('queue')) {
                db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('session')) {
                db.createObjectStore('session', { keyPath: 'key' });
            }
        };
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
    });
}

function dbSave(type, data) {
    return dbOpen().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(type, 'readwrite');
            var store = tx.objectStore(type);
            if (Array.isArray(data)) {
                data.forEach(function(item) { store.put(item); });
            } else {
                store.put(data);
            }
            tx.oncomplete = function() { db.close(); resolve(); };
            tx.onerror = function() { db.close(); reject(tx.error); };
        });
    });
}

function dbGetAll(type) {
    return dbOpen().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(type, 'readonly');
            var store = tx.objectStore(type);
            var req = store.getAll();
            req.onsuccess = function() { db.close(); resolve(req.result || []); };
            req.onerror = function() { db.close(); reject(req.error); };
        });
    });
}

function dbGetByIndex(type, indexName, value) {
    return dbOpen().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(type, 'readonly');
            var store = tx.objectStore(type);
            var index = store.index(indexName);
            var req = index.getAll(value);
            req.onsuccess = function() { db.close(); resolve(req.result || []); };
            req.onerror = function() { db.close(); reject(req.error); };
        });
    });
}

function dbGetById(type, id) {
    return dbOpen().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(type, 'readonly');
            var store = tx.objectStore(type);
            var req = store.get(id);
            req.onsuccess = function() { db.close(); resolve(req.result || null); };
            req.onerror = function() { db.close(); reject(req.error); };
        });
    });
}

function dbDelete(type, id) {
    return dbOpen().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(type, 'readwrite');
            var store = tx.objectStore(type);
            store.delete(id);
            tx.oncomplete = function() { db.close(); resolve(); };
            tx.onerror = function() { db.close(); reject(tx.error); };
        });
    });
}

function dbClear(type) {
    return dbOpen().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(type, 'readwrite');
            var store = tx.objectStore(type);
            store.clear();
            tx.oncomplete = function() { db.close(); resolve(); };
            tx.onerror = function() { db.close(); reject(tx.error); };
        });
    });
}

function dbCacheRouteData(route, stops, products) {
    return dbSave('routes', route).then(function() {
        return dbSave('stops', stops || []);
    }).then(function() {
        return dbSave('products', products || []);
    }).catch(function() {});
}

function dbLoadRouteData(routeId) {
    return dbGetById('routes', routeId).then(function(route) {
        if (!route) return null;
        return dbGetByIndex('stops', 'route_id', routeId).then(function(stops) {
            var stopIds = stops.map(function(s) { return s.id; });
            if (stopIds.length === 0) return { route: route, stops: [], products: {} };
            return dbGetByIndex('products', 'route_stop_id', stopIds[0]).then(function(firstProducts) {
                if (stopIds.length === 1) {
                    var prodMap = {};
                    firstProducts.forEach(function(p) {
                        if (!prodMap[p.route_stop_id]) prodMap[p.route_stop_id] = [];
                        prodMap[p.route_stop_id].push(p);
                    });
                    return { route: route, stops: stops, products: prodMap };
                }
                var allProds = firstProducts;
                var remainingIds = stopIds.slice(1);
                var promises = remainingIds.map(function(id) {
                    return dbGetByIndex('products', 'route_stop_id', id);
                });
                return Promise.all(promises).then(function(results) {
                    results.forEach(function(prods) { allProds = allProds.concat(prods); });
                    var prodMap = {};
                    allProds.forEach(function(p) {
                        if (!prodMap[p.route_stop_id]) prodMap[p.route_stop_id] = [];
                        prodMap[p.route_stop_id].push(p);
                    });
                    return { route: route, stops: stops, products: prodMap };
                });
            });
        });
    }).catch(function() { return null; });
}

function dbQueueMutation(mutation) {
    mutation.created_at = new Date().toISOString();
    return dbSave('queue', mutation).catch(function() {});
}

function dbGetQueue() {
    return dbGetAll('queue').catch(function() { return []; });
}

function dbRemoveQueueItem(id) {
    return dbDelete('queue', id).catch(function() {});
}

function dbSaveSession(key, value) {
    return dbSave('session', { key: key, value: value }).catch(function() {});
}

function dbGetSession(key) {
    return dbGetById('session', key).then(function(entry) {
        return entry ? entry.value : null;
    }).catch(function() { return null; });
}

function dbClearRouteData(routeId) {
    return dbDelete('routes', routeId).then(function() {
        return dbGetByIndex('stops', 'route_id', routeId);
    }).then(function(stops) {
        var promises = (stops || []).map(function(s) { return dbDelete('stops', s.id); });
        return Promise.all(promises);
    }).catch(function() {});
}

async function dbFlushQueue() {
    var queue = await dbGetQueue();
    if (queue.length === 0) return 0;
    var flushed = 0;
    for (var i = 0; i < queue.length; i++) {
        var item = queue[i];
        try {
            var ok = await dbProcessQueueItem(item);
            if (ok) {
                await dbRemoveQueueItem(item.id);
                flushed++;
            }
        } catch (e) {
            console.error('flush item failed:', item.id, e);
        }
    }
    return flushed;
}

async function dbProcessQueueItem(item) {
    if (!sb) return false;
    if (item.action === 'deliver' || item.action === 'partial' || item.action === 'failed') {
        if (item.stop_data) {
            var { error: e1 } = await sb.from('route_stops').update(item.stop_data).eq('id', item.stop_id);
            if (e1) return false;
        }
        if (item.event_data) {
            var { error: e2 } = await sb.from('delivery_events').insert(item.event_data);
            if (e2) console.error('queue event insert failed:', e2);
        }
        if (item.route_data) {
            var { error: e3 } = await sb.from('routes').update(item.route_data).eq('id', item.route_id);
            if (e3) console.error('queue route update failed:', e3);
        }
        return true;
    }
    if (item.action === 'complete') {
        if (item.route_data) {
            var { error: e1 } = await sb.from('routes').update(item.route_data).eq('id', item.route_id);
            if (e1) return false;
        }
        if (item.event_data) {
            var { error: e2 } = await sb.from('delivery_events').insert(item.event_data);
            if (e2) console.error('queue event insert failed:', e2);
        }
        return true;
    }
    return false;
}
