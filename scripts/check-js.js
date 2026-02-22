#!/usr/bin/env node
// simple helper for developers: parse a JavaScript blob with Acorn and
// report syntax errors along with line/column info.  Useful when the
// dashboard HTML is dynamically generated and you want to sanity‑check it.

import fs from 'fs';
import path from 'path';
import { parse } from 'acorn';

const target = process.argv[2] || 'sp-dashboard/index.html';
const full = path.resolve(process.cwd(), target);

try {
  const text = fs.readFileSync(full, 'utf8');
  // if the file contains a <script> block we only parse its contents
  const match = text.match(/<script[^>]*>([\s\S]*)<\/script>/);
  const code = match ? match[1] : text;
  parse(code, {ecmaVersion: 2022});
  console.log(`✅ syntax OK for ${target}`);
  process.exit(0);
} catch (err) {
  console.error(`❌ syntax error in ${target}:`, err.message);
  if (err.loc) {
    console.error(`   at line ${err.loc.line}, column ${err.loc.column}`);
  }
  process.exit(1);
}
