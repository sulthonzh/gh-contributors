import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, HELP, aggregateContributors, sortContributors, formatText, formatJSON, formatMarkdown } from '../src/index.js';

describe('parseArgs', () => {
  it('defaults', () => {
    const opts = parseArgs(['node', 'cli']);
    assert.equal(opts.user, null);
    assert.equal(opts.repo, null);
    assert.equal(opts.top, 20);
    assert.equal(opts.sort, 'commits');
    assert.equal(opts.json, false);
    assert.equal(opts.markdown, false);
  });

  it('--user and --top', () => {
    const opts = parseArgs(['node', 'cli', '--user', 'octocat', '--top', '5']);
    assert.equal(opts.user, 'octocat');
    assert.equal(opts.top, 5);
  });

  it('--repo', () => {
    const opts = parseArgs(['node', 'cli', '--repo', 'my-repo']);
    assert.equal(opts.repo, 'my-repo');
  });

  it('positional repo', () => {
    const opts = parseArgs(['node', 'cli', 'owner/repo']);
    assert.equal(opts.repo, 'owner/repo');
  });

  it('--sort prs', () => {
    const opts = parseArgs(['node', 'cli', '--sort', 'prs']);
    assert.equal(opts.sort, 'prs');
  });

  it('--json and --markdown', () => {
    const j = parseArgs(['node', 'cli', '--json']);
    assert.equal(j.json, true);
    const m = parseArgs(['node', 'cli', '--markdown']);
    assert.equal(m.markdown, true);
  });

  it('--help', () => {
    assert.equal(parseArgs(['node', 'cli', '--help']).help, true);
    assert.equal(parseArgs(['node', 'cli', '-h']).help, true);
  });

  it('invalid --top falls back to 20', () => {
    const opts = parseArgs(['node', 'cli', '--top', 'abc']);
    assert.equal(opts.top, 20);
  });
});

describe('HELP', () => {
  it('contains usage info', () => {
    assert.ok(HELP.includes('gh-contributors'));
    assert.ok(HELP.includes('--user'));
    assert.ok(HELP.includes('--json'));
  });
});

describe('aggregateContributors', () => {
  it('merges contributors across repos', () => {
    const lists = [
      [{ login: 'alice', contributions: 10, repo: 'repo-a' }, { login: 'bob', contributions: 5, repo: 'repo-a' }],
      [{ login: 'alice', contributions: 3, repo: 'repo-b' }],
    ];
    const result = aggregateContributors(lists, {});
    assert.equal(result.length, 2);
    const alice = result.find(c => c.login === 'alice');
    assert.equal(alice.commits, 13);
    assert.equal(alice.repos, 2);
  });

  it('empty input', () => {
    assert.deepEqual(aggregateContributors([], {}), []);
  });

  it('merges PR counts', () => {
    const lists = [[{ login: 'alice', contributions: 5, repo: 'r1' }]];
    const prCounts = { r1: { alice: 3, bob: 2 } };
    const result = aggregateContributors(lists, prCounts);
    const alice = result.find(c => c.login === 'alice');
    assert.equal(alice.prs, 3);
    const bob = result.find(c => c.login === 'bob');
    assert.equal(bob.prs, 2);
  });
});

describe('sortContributors', () => {
  it('sorts by commits default', () => {
    const data = [{ login: 'a', commits: 1 }, { login: 'b', commits: 10 }];
    const sorted = sortContributors(data, 'commits');
    assert.equal(sorted[0].login, 'b');
  });

  it('sorts by prs', () => {
    const data = [{ login: 'a', commits: 10, prs: 1 }, { login: 'b', commits: 1, prs: 5 }];
    const sorted = sortContributors(data, 'prs');
    assert.equal(sorted[0].login, 'b');
  });
});

describe('formatText', () => {
  it('formats contributors', () => {
    const data = [{ login: 'alice', commits: 42, repos: 3 }];
    const out = formatText(data, 10);
    assert.ok(out.includes('alice'));
    assert.ok(out.includes('42'));
    assert.ok(out.includes('3'));
  });

  it('no contributors', () => {
    assert.equal(formatText([], 10), 'No contributors found.');
  });
});

describe('formatJSON', () => {
  it('outputs valid JSON', () => {
    const data = [{ login: 'alice', commits: 5, repos: 1, prs: 0 }];
    const parsed = JSON.parse(formatJSON(data, 10));
    assert.equal(parsed[0].login, 'alice');
  });
});

describe('formatMarkdown', () => {
  it('outputs markdown table', () => {
    const data = [{ login: 'alice', commits: 5, repos: 2, prs: 1 }];
    const out = formatMarkdown(data, 10);
    assert.ok(out.includes('| # |'));
    assert.ok(out.includes('alice'));
  });

  it('no contributors', () => {
    const out = formatMarkdown([], 10);
    assert.ok(out.includes('No contributors'));
  });
});
