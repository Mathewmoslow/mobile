const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function requireArg(args, key, usage) {
  if (args[key]) {
    return;
  }
  console.error(`Missing required argument: --${key}`);
  if (usage) {
    console.error(usage);
  }
  process.exit(1);
}

function writeJson(outPath, data) {
  const dir = path.dirname(outPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
}

module.exports = {
  parseArgs,
  requireArg,
  writeJson,
};
