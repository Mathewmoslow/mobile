const { parseArgs, requireArg, writeJson } = require('./_lib/cli');

const args = parseArgs(process.argv.slice(2));
const usage = 'Usage: node ./scripts/fetch-deployments.js --projectId <vercelProjectId>';

requireArg(args, 'projectId', usage);

const result = {
  projectId: args.projectId,
  deployments: [],
  status: 'stub',
  message: 'fetch-deployments is not implemented yet',
  generatedAt: new Date().toISOString(),
};

writeJson('./analysis/fetch-deployments.json', result);
console.warn(result.message);
