const { parseArgs, requireArg } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage =
  'Usage: node ./scripts/confirm-removal.js --comparisonId <comparisonId> --file <path> --confirm <true|false>';

requireArg(args, 'comparisonId', usage);
requireArg(args, 'file', usage);
requireArg(args, 'confirm', usage);

const result = {
  comparisonId: args.comparisonId,
  file: args.file,
  confirm: args.confirm === 'true',
  status: 'stub',
  message: 'confirm-removal is not implemented yet',
  generatedAt: new Date().toISOString(),
};

console.log(JSON.stringify(result, null, 2));
console.warn(result.message);
