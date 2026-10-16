// Extracts a JSON payload returned by the in-app browser's javascript tool (saved tool-result file) into a file.
//   node extract-browser-json.mjs <tool-result.txt> <out.json>
// The tool result is [{ type, text }]; text holds a JSON string literal (possibly padded) whose value is JSON.
import fs from 'node:fs';
const [src, out] = process.argv.slice(2);
const text = JSON.parse(fs.readFileSync(src, 'utf8'))[0].text;
const literal = text.slice(text.indexOf('"'), text.lastIndexOf('"') + 1);
const value = JSON.parse(JSON.parse(literal).trimEnd());
fs.writeFileSync(out, JSON.stringify(value));
console.log(`${Array.isArray(value) ? value.length + ' items' : 'object'} -> ${out}`);
