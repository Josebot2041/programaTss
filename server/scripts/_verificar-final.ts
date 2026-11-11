import 'dotenv/config';
import { pool } from '../db.js';

const { rows } = await pool.query(`
  SELECT
    (SELECT count(*)::int FROM titulados)   AS titulados,
    (SELECT count(*)::int FROM empleadores) AS empleadores
`);
console.log('Titulados :', rows[0].titulados);
console.log('Empleadores:', rows[0].empleadores);
await pool.end();

