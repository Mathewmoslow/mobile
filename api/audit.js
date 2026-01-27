const DEFAULT_COMMIT_COUNT = 100;
const MAX_COMMITS = 200;

function normalizeRepo(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const githubMatch = trimmed.match(/github\.com\/([^/]+)\/([^/]+)(?:\.git)?$/i);
  if (githubMatch) {
    return `${githubMatch[1]}/${githubMatch[2]}`;
  }
  if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

async function fetchCommits({ repo, branch, perPage, token }) {
  const all = [];
  let page = 1;
  while (all.length < perPage) {
    const remaining = perPage - all.length;
    const pageSize = Math.min(100, remaining);
    const url = `https://api.github.com/repos/${repo}/commits?sha=${encodeURIComponent(
      branch
    )}&per_page=${pageSize}&page=${page}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'vercel-audit-endpoint',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${text}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < pageSize) {
      break;
    }
    page += 1;
  }
  return all;
}

function formatCommit(commit) {
  const sha = commit.sha?.slice(0, 7) || 'unknown';
  const message = commit.commit?.message?.split('\n')[0] || 'no message';
  const author = commit.commit?.author?.name || 'unknown';
  const date = commit.commit?.author?.date || '';
  return `${sha} ${message} (${author}${date ? ` • ${date}` : ''})`;
}

function buildReport({ repo, featureBranch, baseBranch, baseOnly, featureOnly, count }) {
  const lines = [];
  lines.push('COMMIT AUDIT REPORT');
  lines.push('');
  lines.push(`Repo: ${repo}`);
  lines.push(`Base branch: ${baseBranch}`);
  lines.push(`Feature branch: ${featureBranch}`);
  lines.push(`Commit window: last ${count}`);
  lines.push('');
  lines.push('Missing from feature branch (present on base):');
  if (baseOnly.length === 0) {
    lines.push('- None');
  } else {
    baseOnly.forEach((commit) => lines.push(`- ${formatCommit(commit)}`));
  }
  lines.push('');
  lines.push('Only on feature branch (not in base):');
  if (featureOnly.length === 0) {
    lines.push('- None');
  } else {
    featureOnly.forEach((commit) => lines.push(`- ${formatCommit(commit)}`));
  }
  return lines.join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Missing GITHUB_TOKEN in server environment.' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  const repo = normalizeRepo(body.repoPath || body.repo);
  const featureBranch = String(body.featureBranch || '').trim();
  const baseBranch = String(body.baseBranch || 'main').trim();
  const count = Math.min(
    MAX_COMMITS,
    Number.isFinite(Number(body.commitCount)) ? Number(body.commitCount) : DEFAULT_COMMIT_COUNT
  );

  if (!repo || !featureBranch || !baseBranch) {
    res.status(400).json({ error: 'repo, featureBranch, and baseBranch are required.' });
    return;
  }

  try {
    const [baseCommits, featureCommits] = await Promise.all([
      fetchCommits({ repo, branch: baseBranch, perPage: count, token }),
      fetchCommits({ repo, branch: featureBranch, perPage: count, token }),
    ]);

    const featureSet = new Set(featureCommits.map((c) => c.sha));
    const baseSet = new Set(baseCommits.map((c) => c.sha));

    const baseOnly = baseCommits.filter((commit) => !featureSet.has(commit.sha));
    const featureOnly = featureCommits.filter((commit) => !baseSet.has(commit.sha));

    const report = buildReport({
      repo,
      featureBranch,
      baseBranch,
      baseOnly,
      featureOnly,
      count,
    });

    res.status(200).send(report);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
};
