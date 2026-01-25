const { parseArgs, requireArg, writeJson } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage =
  'Usage: node ./scripts/export-ai.js --comparisonId <comparisonId> --out ./exports/<comparisonId>.json';

requireArg(args, 'comparisonId', usage);
requireArg(args, 'out', usage);

const result = {
  comparisonId: args.comparisonId,
  export: {},
  status: 'stub',
  message: 'export-ai is not implemented yet',
  generatedAt: new Date().toISOString(),
};

writeJson(args.out, result);
console.warn(result.message);
