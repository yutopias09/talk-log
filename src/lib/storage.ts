// 読み込んだトークを、この端末（ブラウザのIndexedDB）にだけ保存して、次回すぐ開けるようにする。
// サーバーには送らない。「この端末から削除」でいつでも消せる。

const DB_NAME = "talklog";
const STORE = "chats";
const KEY_TEXT = "last";
const KEY_META = "last-meta";

export interface SavedChatMeta {
  name: string;
  savedAt: number;
  size: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req ? (req.result as T) : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function saveLastChat(text: string, name: string): Promise<void> {
  try {
    const meta: SavedChatMeta = { name, savedAt: Date.now(), size: text.length };
    await run("readwrite", (s) => {
      s.put(text, KEY_TEXT);
      s.put(meta, KEY_META);
    });
  } catch {
    /* 保存できない環境（プライベートブラウズなど）では何もしない */
  }
}

export async function loadLastChatMeta(): Promise<SavedChatMeta | null> {
  try {
    const meta = await run<SavedChatMeta>("readonly", (s) => s.get(KEY_META));
    return meta && typeof meta.name === "string" ? meta : null;
  } catch {
    return null;
  }
}

export async function loadLastChatText(): Promise<string | null> {
  try {
    const text = await run<string>("readonly", (s) => s.get(KEY_TEXT));
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}

export async function clearLastChat(): Promise<void> {
  try {
    await run("readwrite", (s) => {
      s.delete(KEY_TEXT);
      s.delete(KEY_META);
    });
  } catch {
    /* ignore */
  }
}
