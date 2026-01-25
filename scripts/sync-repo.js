const { parseArgs, requireArg, writeJson } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage = 'Usage: node ./scripts/sync-repo.js --repo <owner/repo> --vercel <vercelProjectId>';

requireArg(args, 'repo', usage);
requireArg(args, 'vercel', usage);

const result = {
  repo: args.repo,
  vercelProjectId: args.vercel,
  status: 'stub',
  message: 'sync-repo is not implemented yet',
  generatedAt: new Date().toISOString(),
};

writeJson('./analysis/sync-repo.json', result);
console.warn(result.message);
