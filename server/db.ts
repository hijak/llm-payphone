import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'payphone.db')

let db: Database.Database | null = null

export function getDb() {
  if (db) return db
  const dir = path.dirname(DB_PATH)
  fs.mkdirSync(dir, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  db.exec(`
    create table if not exists routes (
      number text primary key,
      label text not null,
      provider text not null,
      model text not null,
      voiceId text,
      baseUrl text,
      apiKey text,
      agentId text,
      avatarUrl text,
      updatedAt integer not null
    );

    create table if not exists tts_config (
      id integer primary key check (id = 1),
      provider text not null,

      inworldApiKey text,
      inworldVoiceId text,
      inworldModelId text,

      elevenlabsApiKey text,
      elevenlabsVoiceId text,
      elevenlabsModelId text,

      openaiApiKey text,
      openaiBaseUrl text,
      openaiModelId text,
      openaiVoiceId text,

      kittenModelId text,
      kittenVoiceId text,
      kittenPythonBin text,
      kittenBaseUrl text,

      updatedAt integer not null
    );
  `)

  // Lightweight migrations (add columns if table existed before)
  const cols = new Set((db.prepare("pragma table_info('tts_config')").all() as any[]).map((r) => String(r.name)))
  function addCol(name: string, type: string) {
    if (cols.has(name)) return
    db.exec(`alter table tts_config add column ${name} ${type};`)
    cols.add(name)
  }
  addCol('kittenModelId', 'text')
  addCol('kittenVoiceId', 'text')
  addCol('kittenPythonBin', 'text')
  addCol('kittenBaseUrl', 'text')

  // Ensure singleton row exists
  const now = Date.now()
  db.prepare('insert or ignore into tts_config (id, provider, updatedAt) values (1, ?, ?)')
    .run('inworld', now)

  return db
}

export function closeDb() {
  try { db?.close() } catch {}
  db = null
}
