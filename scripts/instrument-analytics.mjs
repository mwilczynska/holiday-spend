// One-time source annotation tool. Existing explicit identifiers are never rewritten.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)]); }
let routes = 0, controls = 0;
for (const filename of files(path.join(root, 'src/app/api'))) {
  const relative = path.relative(path.join(root, 'src/app/api'), filename).split(path.sep).join('/');
  if (!relative.endsWith('route.ts') || relative.startsWith('analytics/') || relative.startsWith('admin/analytics') || relative.startsWith('settings/analytics')) continue;
  let source = fs.readFileSync(filename, 'utf8');
  const methods = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g)].map(m => m[1]);
  if (!methods.length || source.includes('instrumentRoute')) continue;
  source = "import { instrumentRoute } from '@/lib/analytics/route';\n" + source.replace(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g, 'async function handle$1(');
  const route = '/' + path.relative(path.join(root, 'src/app'), path.dirname(filename)).split(path.sep).join('/');
  source += '\n' + methods.map(m => `export const ${m} = instrumentRoute(handle${m}, '${route}', '${m}');`).join('\n') + '\n';
  fs.writeFileSync(filename, source); routes++;
}
for (const filename of files(path.join(root, 'src'))) {
  const relative = path.relative(path.join(root, 'src'), filename).split(path.sep).join('/');
  if (!relative.endsWith('.tsx') || relative.includes('/ui/') || relative.includes('/analytics/')) continue;
  let source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [], used = new Map();
  const base = path.basename(filename, '.tsx').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['Button', 'button', 'Link', 'Select', 'SelectTrigger', 'Switch', 'TabsTrigger', 'DialogTrigger', 'DropdownMenuItem'].includes(node.tagName.getText(ast))) {
      const attrs = node.attributes.properties;
      if (!attrs.some(a => a.name?.getText(ast) === 'data-analytics')) {
        let label = '';
        const handler = attrs.find(a => ['onClick', 'onCheckedChange', 'onValueChange'].includes(a.name?.getText(ast)));
        if (handler?.initializer && ts.isJsxExpression(handler.initializer)) {
          const expression = handler.initializer.expression;
          if (expression && ts.isIdentifier(expression)) label = expression.text;
          else if (expression) label = expression.getText(ast).match(/(?:handle|set|on|save|load|open|close|refresh|retry|discard|toggle|change|delete|add|remove|apply|estimate|import|export)[A-Z][A-Za-z0-9]*/)?.[0] || '';
        }
        if (!label) {
          const attr = attrs.find(a => ['aria-label', 'value', 'href'].includes(a.name?.getText(ast)) && a.initializer && ts.isStringLiteral(a.initializer));
          if (attr) label = attr.initializer.text;
        }
        label = (label || node.tagName.getText(ast)).replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
        const key = `${base}.${label}`.slice(0, 72), n = (used.get(key) || 0) + 1; used.set(key, n);
        edits.push({ at: node.tagName.end, text: ` data-analytics="${key}${n > 1 ? '.' + n : ''}"` }); controls++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const edit of edits.sort((a, b) => b.at - a.at)) source = source.slice(0, edit.at) + edit.text + source.slice(edit.at);
  if (edits.length) fs.writeFileSync(filename, source);
}
console.log({ routes, controls });
