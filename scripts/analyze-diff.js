const { parseArgs, requireArg, writeJson } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage =
  'Usage: node ./scripts/analyze-diff.js --comparisonId <comparisonId> --out ./analysis/<comparisonId>.json';

requireArg(args, 'comparisonId', usage);
requireArg(args, 'out', usage);

const result = {
  comparisonId: args.comparisonId,
  status: 'stub',
  message: 'analyze-diff is not implemented yet',
  generatedAt: new Date().toISOString(),
};

writeJson(args.out, result);
console.warn(result.message);
