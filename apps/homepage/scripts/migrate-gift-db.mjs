import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function databaseConfig() {
  const database = required('GIFT_DB_NAME');
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('GIFT_DB_NAME contains unsupported characters.');

  const passwordFile = path.resolve(required('GIFT_DB_PASSWORD_FILE'));
  const password = readFileSync(passwordFile, 'utf8');
  if (!password) throw new Error('The gift database password file is empty.');

  const sslEnabled = process.env.GIFT_DB_SSL === 'true';
  const ssl = sslEnabled
    ? {
        ca: readFileSync(path.resolve(required('GIFT_DB_SSL_CA_FILE')), 'utf8'),
        rejectUnauthorized: true,
      }
    : undefined;

  return {
    host: required('GIFT_DB_HOST'),
    port: Number(process.env.GIFT_DB_PORT || 3306),
    user: required('GIFT_DB_USER'),
    password,
    database,
    ssl,
    charset: 'utf8mb4',
    connectTimeout: 10_000,
    multipleStatements: true,
  };
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(scriptDirectory, '../db/migrations');
const migrationLock = 'unionam_gift_schema_migrations';

async function migrate() {
  const config = databaseConfig();
  const connection = await mysql.createConnection(config);
  let lockAcquired = false;

  try {
    const [[databaseRow]] = await connection.query('SELECT DATABASE() AS databaseName');
    if (databaseRow.databaseName !== config.database) throw new Error('Connected to an unexpected database.');

    const [[lockRow]] = await connection.execute('SELECT GET_LOCK(?, 30) AS acquired', [migrationLock]);
    if (lockRow.acquired !== 1) throw new Error('Could not acquire the gift database migration lock.');
    lockAcquired = true;

    await connection.query(`
      CREATE TABLE IF NOT EXISTS gift_schema_migrations (
        version VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((fileName) => /^\d+_[a-z0-9_]+\.sql$/.test(fileName))
      .sort();

    for (const fileName of migrationFiles) {
      const version = fileName.slice(0, fileName.indexOf('_'));
      const sql = await readFile(path.join(migrationsDirectory, fileName), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [existingRows] = await connection.execute(
        'SELECT checksum FROM gift_schema_migrations WHERE version = ?',
        [version],
      );

      if (existingRows.length > 0) {
        if (existingRows[0].checksum !== checksum) {
          throw new Error(`Migration ${version} was modified after it was applied.`);
        }
        console.log(`Migration ${fileName} is already applied.`);
        continue;
      }

      console.log(`Applying migration ${fileName}...`);
      await connection.query(sql);
      await connection.execute(
        'INSERT INTO gift_schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
        [version, fileName, checksum],
      );
      console.log(`Applied migration ${fileName}.`);
    }
  } finally {
    if (lockAcquired) await connection.execute('SELECT RELEASE_LOCK(?)', [migrationLock]);
    await connection.end();
  }
}

migrate().catch((error) => {
  console.error(`Gift database migration failed: ${error.message}`);
  process.exitCode = 1;
});
