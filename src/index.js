'use strict';

const { execSync } = require('child_process');

function ghAvailable() {
  try { execSync('gh --version', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { user: null, repo: null, top: 20, sort: 'commits', json: false, markdown: false };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) { opts.user = args[++i]; }
    else if (args[i] === '--repo' && args[i + 1]) { opts.repo = args[++i]; }
    else if (args[i] === '--top' && args[i + 1]) { opts.top = parseInt(args[++i], 10) || 20; }
    else if (args[i] === '--sort' && args[i + 1]) { opts.sort = args[++i]; }
    else if (args[i] === '--json') { opts.json = true; }
    else if (args[i] === '--markdown') { opts.markdown = true; }
    else if (args[i] === '--help' || args[i] === '-h') { opts.help = true; }
    else if (!args[i].startsWith('--')) { positional.push(args[i]); }
  }

  if (positional.length > 0 && !opts.repo) opts.repo = positional[0];
  return opts;
}

const HELP = `
gh-contributors — See contributors across your GitHub repos

Usage:
  gh-contributors                    Top contributors across all your repos
  gh-contributors <repo>             Contributors for a specific repo
  gh-contributors --user octocat     Check another user's repos

Options:
  --user <user>       Target GitHub user (default: authenticated user)
  --repo <repo>       Single repo to check (owner/repo or just name)
  --top <n>           Show top N contributors (default: 20)
  --sort <field>      Sort by: commits (default), additions, deletions, prs
  --json              Output as JSON
  --markdown          Output as markdown table
  -h, --help          Show this help
`;

function getContributorsForRepo(owner, repo) {
  try {
    const raw = execSync(
      `gh api "repos/${owner}/${repo}/contributors?per_page=100" --jq '.[] | .login + " " + (.contributions|tostring)'`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }
    );
    if (!raw.trim()) return [];
    return raw.trim().split('\n').map(line => {
      const parts = line.trim().split(' ');
      return { login: parts[0], contributions: parseInt(parts[parts.length - 1], 10) || 0, repo };
    });
  } catch { return []; }
}

function getPRCountsForRepo(owner, repo) {
  try {
    const raw = execSync(
      `gh api "repos/${owner}/${repo}/pulls?state=all&per_page=100" --jq '.[] | .user.login'`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }
    );
    if (!raw.trim()) return {};
    const counts = {};
    raw.trim().split('\n').forEach(login => {
      counts[login] = (counts[login] || 0) + 1;
    });
    return counts;
  } catch { return {}; }
}

function getRepos(user) {
  try {
    const raw = execSync(
      `gh api "users/${user}/repos?per_page=100&type=owner&sort=updated" --jq '.[] | .name'`,
      { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }
    );
    return raw.trim() ? raw.trim().split('\n') : [];
  } catch { return []; }
}

function aggregateContributors(contributorLists, prCountsMap) {
  const map = {};
  for (const list of contributorLists) {
    for (const c of list) {
      if (!map[c.login]) map[c.login] = { login: c.login, commits: 0, repos: new Set() };
      map[c.login].commits += c.contributions;
      map[c.login].repos.add(c.repo);
    }
  }
  for (const [repo, counts] of Object.entries(prCountsMap)) {
    for (const [login, count] of Object.entries(counts)) {
      if (!map[login]) map[login] = { login, commits: 0, repos: new Set() };
      map[login].prs = (map[login].prs || 0) + count;
      map[login].repos.add(repo);
    }
  }
  return Object.values(map).map(c => ({ ...c, repos: c.repos.size }));
}

function sortContributors(contributors, sort) {
  const field = sort === 'prs' ? 'prs' : sort === 'additions' ? 'additions' : sort === 'deletions' ? 'deletions' : 'commits';
  return contributors.sort((a, b) => (b[field] || 0) - (a[field] || 0));
}

function formatText(contributors, top) {
  const shown = contributors.slice(0, top);
  if (shown.length === 0) return 'No contributors found.';
  const maxLogin = Math.max(...shown.map(c => c.login.length), 4);
  const maxCommits = Math.max(...shown.map(c => String(c.commits).length), 7);
  let out = '';
  for (const c of shown) {
    const prs = c.prs ? ` | ${String(c.prs).padStart(3)} PRs` : '';
    out += `${c.login.padEnd(maxLogin)}  ${String(c.commits).padStart(maxCommits)} commits | ${c.repos} repo(s)${prs}\n`;
  }
  return out.trimEnd();
}

function formatJSON(contributors, top) {
  const shown = contributors.slice(0, top);
  return JSON.stringify(shown.map(c => ({ login: c.login, commits: c.commits, repos: c.repos, prs: c.prs || 0 })), null, 2);
}

function formatMarkdown(contributors, top) {
  const shown = contributors.slice(0, top);
  if (shown.length === 0) return '_No contributors found._';
  let out = '| # | Login | Commits | Repos | PRs |\n|---|---|---|---|---|\n';
  shown.forEach((c, i) => {
    out += `| ${i + 1} | ${c.login} | ${c.commits} | ${c.repos} | ${c.prs || 0} |\n`;
  });
  return out.trimEnd();
}

module.exports = { parseArgs, HELP, getContributorsForRepo, getRepos, aggregateContributors, sortContributors, formatText, formatJSON, formatMarkdown, ghAvailable };
