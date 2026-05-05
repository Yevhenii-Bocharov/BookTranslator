// src/db.ts
import { openDB } from "idb"

export const dbPromise = openDB("book-db", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("books")) {
      db.createObjectStore("books", { keyPath: "id" })
    }
  },
})