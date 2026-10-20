import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const root = process.cwd();
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)]); }
const controls = [], routes = [], missing = [];
const tags = new Set(['Button', 'button', 'Link', 'Select', 'SelectTrigger', 'Switch', 'TabsTrigger', 'DialogTrigger', 'DropdownMenuItem']);
for (const file of files(path.join(root, 'src'))) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  if (relative.includes('/analytics/') || relative.includes('/ui/')) continue;
  // Readiness probes are deliberately excluded from product activity and collection side effects.
  if (relative.startsWith('src/app/api/') && relative !== 'src/app/api/health/route.ts' && file.endsWith('/route.ts'.replaceAll('/', path.sep))) {
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('instrumentRoute')) missing.push(relative + ': request wrapper');
    else routes.push(relative);
  }
  if (!file.endsWith('.tsx')) continue;
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && tags.has(node.tagName.getText(ast))) {
      const attribute = node.attributes.properties.find(a => a.name?.getText(ast) === 'data-analytics');
      if (!attribute) missing.push(relative + ':' + (ast.getLineAndCharacterOfPosition(node.pos).line + 1) + ' ' + node.tagName.getText(ast));
      else if (attribute.initializer && ts.isStringLiteral(attribute.initializer)) controls.push({ id: attribute.initializer.text, file: relative, tag: node.tagName.getText(ast) });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const inventory = JSON.stringify({ routes: routes.sort(), controls: controls.sort((a, b) => (a.file + a.id).localeCompare(b.file + b.id)) }, null, 2) + '\n';
const destination = path.join(root, 'docs/analytics/control-inventory.json');
if (process.argv.includes('--write')) fs.writeFileSync(destination, inventory);
if (missing.length) { console.error('Missing explicit analytics instrumentation:\n' + missing.join('\n')); process.exitCode = 1; }
else if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== inventory) { console.error('Control inventory is stale. Run node scripts/check-analytics-coverage.mjs --write.'); process.exitCode = 1; }
else console.log(`Analytics coverage: ${routes.length} route modules, ${controls.length} source controls.`);
