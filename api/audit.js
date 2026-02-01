const DEFAULT_COMMIT_COUNT = 100;
const MAX_COMMITS = 200;
const MAX_HISTORY_COMPARES = 30;
const MAX_FILES_PER_SECTION = 25;

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

async function fetchCompare({ repo, base, head, token }) {
  const url = `https://api.github.com/repos/${repo}/compare/${encodeURIComponent(
    base
  )}...${encodeURIComponent(head)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'vercel-audit-endpoint',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub compare error (${response.status}): ${text}`);
  }
  return response.json();
}

function summarizePatch(patch) {
  if (!patch) {
    return { added: 0, removed: 0, hasPatch: false };
  }
  const lines = patch.split('\n');
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added += 1;
    if (line.startsWith('-')) removed += 1;
  }
  return { added, removed, hasPatch: true };
}

function getFileStats(file) {
  const additions = Number.isFinite(Number(file.additions)) ? Number(file.additions) : 0;
  const deletions = Number.isFinite(Number(file.deletions)) ? Number(file.deletions) : 0;
  return {
    filename: file.filename,
    status: file.status,
    additions,
    deletions,
  };
}

function formatCommit(commit) {
  const sha = commit.sha?.slice(0, 7) || 'unknown';
  const message = commit.commit?.message?.split('\n')[0] || 'no message';
  const author = commit.commit?.author?.name || 'unknown';
  const date = commit.commit?.author?.date || '';
  return `${sha} ${message} (${author}${date ? ` • ${date}` : ''})`;
}

function buildHistoryReport({ baseBranch, history, comparedCount, totalPairs }) {
  const lines = [];
  lines.push('Main Branch History Audit');
  lines.push(`Branch: ${baseBranch}`);
  lines.push(`Compared pairs: ${comparedCount}/${totalPairs}`);
  lines.push('');
  if (history.length === 0) {
    lines.push('No deletions detected in compared pairs.');
    return lines.join('\n');
  }
  history.forEach((entry) => {
    lines.push(`Pair: ${entry.headSha} -> ${entry.baseSha}`);
    if (entry.compareUrl) {
      lines.push(`Compare: ${entry.compareUrl}`);
    }
    if (entry.removedFiles.length === 0 && entry.removedLines === 0) {
      lines.push('- No removals detected.');
    } else {
      if (entry.removedFiles.length > 0) {
        lines.push('- Removed files:');
        entry.removedFiles.forEach((file) => lines.push(`  - ${file}`));
      }
      if (entry.removedLines > 0) {
        lines.push(`- Lines removed (patch-based): ${entry.removedLines}`);
      }
      if (entry.topRemovedFiles.length > 0) {
        lines.push('- Top files by deletions:');
        entry.topRemovedFiles.forEach((file) =>
          lines.push(`  - ${file.filename} (-${file.deletions}, +${file.additions})`)
        );
        if (entry.topRemovedFilesTruncated) {
          lines.push(`  - ...and more (showing top ${MAX_FILES_PER_SECTION})`);
        }
      }
    }
    lines.push('');
  });
  return lines.join('\n');
}

function buildReport({
  repo,
  featureBranch,
  baseBranch,
  baseOnly,
  featureOnly,
  count,
  historyReport,
  diffSummary,
  actionPlan,
}) {
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
  if (diffSummary) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('Branch Diff Summary (content-level)');
    if (diffSummary.compareUrl) {
      lines.push(`Compare: ${diffSummary.compareUrl}`);
    }
    lines.push(`Files changed: ${diffSummary.filesChanged}`);
    if (diffSummary.removedFiles.length > 0) {
      lines.push('Files removed in feature vs base:');
      diffSummary.removedFiles.forEach((file) => lines.push(`- ${file}`));
    } else {
      lines.push('Files removed in feature vs base: None');
    }
    lines.push(
      `Total lines added/removed (patch-based): +${diffSummary.linesAdded} / -${diffSummary.linesRemoved}`
    );
    if (diffSummary.topChangedFiles.length > 0) {
      lines.push('Top files by change size:');
      diffSummary.topChangedFiles.forEach((file) =>
        lines.push(`- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions})`)
      );
      if (diffSummary.topChangedFilesTruncated) {
        lines.push(`- ...and more (showing top ${MAX_FILES_PER_SECTION})`);
      }
    }
    if (diffSummary.truncatedPatches > 0) {
      lines.push(`Note: ${diffSummary.truncatedPatches} file(s) missing patch data.`);
    }
  }
  if (historyReport) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(historyReport);
  }
  if (actionPlan) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('Action Plan');
    actionPlan.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }
  return lines.join('\n');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
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
  const includeHistory = Boolean(body.includeHistory);
  const count = Math.min(
    MAX_COMMITS,
    Number.isFinite(Number(body.commitCount)) ? Number(body.commitCount) : DEFAULT_COMMIT_COUNT
  );

  if (!repo || !baseBranch) {
    res.status(400).json({ error: 'repo and baseBranch are required.' });
    return;
  }

  try {
    const baseCommits = await fetchCommits({ repo, branch: baseBranch, perPage: count, token });
    const featureCommits = featureBranch
      ? await fetchCommits({ repo, branch: featureBranch, perPage: count, token })
      : [];

    const featureSet = new Set(featureCommits.map((c) => c.sha));
    const baseSet = new Set(baseCommits.map((c) => c.sha));

    const baseOnly = baseCommits.filter((commit) => !featureSet.has(commit.sha));
    const featureOnly = featureCommits.filter((commit) => !baseSet.has(commit.sha));

    const diffSummary = featureBranch
      ? (() => {
          const summary = {
            filesChanged: 0,
            removedFiles: [],
            linesAdded: 0,
            linesRemoved: 0,
            truncatedPatches: 0,
            compareUrl: '',
            topChangedFiles: [],
            topChangedFilesTruncated: false,
          };
          return summary;
        })()
      : null;

    if (featureBranch) {
      const compare = await fetchCompare({
        repo,
        base: baseBranch,
        head: featureBranch,
        token,
      });
      const files = Array.isArray(compare.files) ? compare.files : [];
      diffSummary.filesChanged = files.length;
      diffSummary.compareUrl = compare.html_url || '';
      const fileStats = files.map(getFileStats);
      fileStats.sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions));
      diffSummary.topChangedFiles = fileStats.slice(0, MAX_FILES_PER_SECTION);
      diffSummary.topChangedFilesTruncated = fileStats.length > MAX_FILES_PER_SECTION;
      for (const file of files) {
        if (file.status === 'removed') {
          diffSummary.removedFiles.push(file.filename);
        }
        const stats = summarizePatch(file.patch);
        diffSummary.linesAdded += stats.added;
        diffSummary.linesRemoved += stats.removed;
        if (!stats.hasPatch) diffSummary.truncatedPatches += 1;
      }
    }

    let historyReport = '';
    if (includeHistory) {
      const history = [];
      const totalPairs = Math.max(0, baseCommits.length - 1);
      const compareCount = Math.min(totalPairs, MAX_HISTORY_COMPARES);
      for (let i = 0; i < compareCount; i += 1) {
        const head = baseCommits[i];
        const base = baseCommits[i + 1];
        const compare = await fetchCompare({
          repo,
          base: base.sha,
          head: head.sha,
          token,
        });
        let removedLines = 0;
        const removedFiles = (compare.files || [])
          .filter((file) => file.status === 'removed')
          .map((file) => file.filename);
        const fileStats = (compare.files || []).map(getFileStats);
        for (const file of compare.files || []) {
          const stats = summarizePatch(file.patch);
          removedLines += stats.removed;
        }
        const topRemoved = fileStats
          .filter((file) => file.deletions > 0)
          .sort((a, b) => b.deletions - a.deletions);
        history.push({
          headSha: head.sha.slice(0, 7),
          baseSha: base.sha.slice(0, 7),
          removedFiles,
          removedLines,
          compareUrl: compare.html_url || '',
          topRemovedFiles: topRemoved.slice(0, MAX_FILES_PER_SECTION),
          topRemovedFilesTruncated: topRemoved.length > MAX_FILES_PER_SECTION,
        });
      }
      historyReport = buildHistoryReport({
        baseBranch,
        history,
        comparedCount: compareCount,
        totalPairs,
      });
      if (totalPairs > compareCount) {
        historyReport += `\nNote: History comparisons capped at ${MAX_HISTORY_COMPARES} pairs.`;
      }
    }

    const actionPlan = [];
    if (baseOnly.length > 0) {
      actionPlan.push(
        'Review the commits missing from the feature branch and decide whether to cherry-pick or merge them.'
      );
    }
    if (featureOnly.length > 0) {
      actionPlan.push(
        'Review the feature-only commits and decide whether they should be merged into main.'
      );
    }
    if (diffSummary && diffSummary.filesChanged > 0) {
      actionPlan.push(
        'Inspect the branch compare link and validate large deletions or file removals against requirements.'
      );
    }
    if (includeHistory) {
      actionPlan.push(
        'Inspect the main history compare links with high deletion counts to confirm removals were requested.'
      );
    }

    const report = buildReport({
      repo,
      featureBranch,
      baseBranch,
      baseOnly,
      featureOnly,
      count,
      historyReport,
      diffSummary,
      actionPlan,
    });

    res.status(200).send(report);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
};
