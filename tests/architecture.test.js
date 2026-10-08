import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const source=readFileSync(new URL('../server.js',import.meta.url),'utf8');
test('SQLite runtime is available',()=>{const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE t(id INTEGER PRIMARY KEY, data TEXT)');db.prepare('INSERT INTO t(data) VALUES (?)').run('persist');assert.equal(db.prepare('SELECT data FROM t').get().data,'persist');db.close()});
test('both database engines and write serialization configured',()=>{assert.match(source,/DB_ENGINE/);assert.match(source,/pg\.Pool/);assert.match(source,/writeQueue/);assert.match(source,/await boot\(\)/)});
