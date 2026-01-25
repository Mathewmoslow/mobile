const { parseArgs, requireArg, writeJson } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage =
  'Usage: node ./scripts/compare-commits.js --repo <owner/repo> --a <commitShaA> --b <commitShaB>';

requireArg(args, 'repo', usage);
requireArg(args, 'a', usage);
requireArg(args, 'b', usage);

const comparisonId = `${String(args.a).slice(0, 7)}_${String(args.b).slice(0, 7)}`;

const result = {
  comparisonId,
  repo: args.repo,
  a: args.a,
  b: args.b,
  status: 'stub',
  message: 'compare-commits is not implemented yet',
  generatedAt: new Date().toISOString(),
};

writeJson(`./analysis/compare-${comparisonId}.json`, result);
console.warn(result.message);
