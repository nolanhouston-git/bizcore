import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Path to the SQLite database file — lives at the project root
const DB_PATH = path.join(process.cwd(), "bizcore.db");

// Path to our schema SQL file
const SCHEMA_PATH = path.join(process.cwd(), "lib/db/schema.sql");

// Open (or create) the database file
const sqlite = new Database(DB_PATH);

// Makes SQLite faster for concurrent reads — always a good idea
sqlite.pragma("journal_mode = WAL");

// Read the schema SQL and run it
// CREATE TABLE IF NOT EXISTS means this is safe to run every time
const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
sqlite.exec(schema);

export default sqlite;