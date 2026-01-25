const { parseArgs, requireArg, writeJson } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage = 'Usage: node ./scripts/fetch-commits.js --repo <owner/repo>';

requireArg(args, 'repo', usage);

const result = {
  repo: args.repo,
  commits: [],
  status: 'stub',
  message: 'fetch-commits is not implemented yet',
  generatedAt: new Date().toISOString(),
};

writeJson('./analysis/fetch-commits.json', result);
console.warn(result.message);
