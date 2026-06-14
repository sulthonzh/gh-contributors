#!/usr/bin/env node
'use strict';

const { parseArgs, HELP, getContributorsForRepo, getRepos, aggregateContributors, sortContributors, formatText, formatJSON, formatMarkdown, ghAvailable } = require('./src/index');

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { console.log(HELP); process.exit(0); }
  if (!ghAvailable()) { console.error('Error: gh CLI not found. Install from https://cli.github.com'); process.exit(2); }

  const user = opts.user || execSync('gh api user --jq .login', { encoding: 'utf8' }).trim();
  let { execSync } = require('child_process');

  if (opts.repo) {
    let fullRepo = opts.repo;
    if (!fullRepo.includes('/')) fullRepo = `${user}/${fullRepo}`;
    const [owner, repo] = fullRepo.split('/');
    const contribs = getContributorsForRepo(owner, repo);
    const aggregated = aggregateContributors([contribs.map(c => ({ ...c, repo: fullRepo }))], {});
    const sorted = sortContributors(aggregated, opts.sort);
    const fmt = opts.json ? formatJSON(sorted, opts.top) : opts.markdown ? formatMarkdown(sorted, opts.top) : formatText(sorted, opts.top);
    console.log(fmt);
    process.exit(0);
  }

  const repos = getRepos(user);
  if (repos.length === 0) { console.log('No repos found.'); process.exit(0); }

  console.error(`Scanning ${repos.length} repos...`);
  const allContribs = [];
  for (const repo of repos) {
    const contribs = getContributorsForRepo(user, repo);
    allContribs.push(contribs);
  }
  const aggregated = aggregateContributors(allContribs, {});
  const sorted = sortContributors(aggregated, opts.sort);
  const fmt = opts.json ? formatJSON(sorted, opts.top) : opts.markdown ? formatMarkdown(sorted, opts.top) : formatText(sorted, opts.top);
  console.log(fmt);
}

main().catch(e => { console.error(e.message); process.exit(2); });
