import fs from 'node:fs';
import path from 'node:path';
import {
  parseCityCostResearchResponse,
  renderCityCostResearchPrompt,
} from '../src/lib/city-cost-research-response';

function usage() {
  return [
    'Usage:',
    '  npm run methodology:research -- --assignment <assignment.json>',
    '  npm run methodology:research -- --assignment <assignment.json> --response <llm-response.txt>',
    '',
    'The first form renders the bounded research prompt. The second validates and normalizes a saved',
    'free web-enabled LLM response. It does not call a paid API or mark observations accepted.',
  ].join('\n');
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

try {
  const assignmentArgument = argumentValue('--assignment');
  if (!assignmentArgument) {
    console.error(usage());
    process.exit(1);
  }

  const assignmentPath = path.resolve(process.cwd(), assignmentArgument);
  const assignment = JSON.parse(fs.readFileSync(assignmentPath, 'utf8')) as unknown;
  const responseArgument = argumentValue('--response');

  if (responseArgument) {
    const responsePath = path.resolve(process.cwd(), responseArgument);
    const response = parseCityCostResearchResponse(
      fs.readFileSync(responsePath, 'utf8'),
      assignment
    );
    console.log(JSON.stringify(response, null, 2));
  } else {
    const templatePath = path.resolve(
      process.cwd(),
      'docs/prompts/llm_prompt_city_cost_observations_1.md'
    );
    console.log(
      renderCityCostResearchPrompt(
        fs.readFileSync(templatePath, 'utf8'),
        assignment
      )
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unknown research-runner error');
  process.exit(1);
}
