# Automerge

GitHub App that merges an eligible pull request after every reported check run and commit status finishes. Add either the `automerge` or
`tag: automerge` label to opt a pull request in.

- Website: <https://automerge.python-templates.dev>
- Install: <https://github.com/apps/python-templates-automerge/installations/new>
- Support: <https://automerge.python-templates.dev/support>
- Privacy: <https://automerge.python-templates.dev/privacy>
- Marketplace assets: [`docs/img`](docs/img)

The App asks GitHub to merge the exact checked head commit. GitHub remains responsible for enforcing required checks, reviews, branch protection,
rulesets, and other merge requirements. Do not add the App to a branch-protection or ruleset bypass list.

## Behavior

The App evaluates labeled pull requests when:

- an automerge label is added
- the pull request is reopened or marked ready
- a check suite completes
- a legacy commit status changes
- a review is submitted or dismissed

It ignores closed pull requests, drafts, and pull requests without an automerge label. It waits while any latest check run is not `completed` or any
latest commit status is `pending`. Once all reported work is terminal, it requests a SHA-pinned merge. A failed optional check does not prevent the
request, but GitHub rejects it when any required condition is unsatisfied.

Before merging, the App waits until the active automerge label has been present for 10 seconds, then checks the pull request again. Removing the label
during this grace period cancels the merge.

When new commits are pushed, the App removes either automerge label. Re-add a label after the new commit is ready to opt in again.

The App prefers squash, then merge commit, then rebase, based on the repository's enabled merge methods.

## GitHub App configuration

Create a GitHub App with:

- Homepage URL: `https://automerge.python-templates.dev`
- Webhook URL: `https://automerge.python-templates.dev/webhook`
- Webhook secret: a generated random secret
- Webhooks: active
- Where this GitHub App can be installed: any account

Repository permissions:

- Checks: Read-only
- Commit statuses: Read-only
- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only, granted automatically

Subscribe to these events:

- Check suite
- Commit status
- Pull request
- Pull request review

Generate a private key, then install the App on the repositories it should manage. Do not grant Administration permission.

## Deployment

Provision a `cloudflare_workers_domain` for `automerge.python-templates.dev` pointing to the `automerge` service. Configure this repository:

```bash
gh variable set AUTOMERGE_APP_ID --repo actions-ext/automerge --body "APP_ID"
gh variable set CLOUDFLARE_ACCOUNT_ID --repo actions-ext/automerge --body "ACCOUNT_ID"

gh secret set AUTOMERGE_APP_PRIVATE_KEY --repo actions-ext/automerge < private-key.pem
gh secret set AUTOMERGE_WEBHOOK_SECRET --repo actions-ext/automerge
gh secret set CLOUDFLARE_TEMPLATES_API_TOKEN --repo actions-ext/automerge
```

The Cloudflare token needs Account Workers Scripts Edit and `python-templates.dev` Workers Routes Edit permissions. It may be the same account token used
by the Copier Update Worker.

Push to `main` or run the `Deploy Worker` workflow manually. Verify deployment at:

```bash
curl https://automerge.python-templates.dev/healthz
```

## Development

```bash
npm ci
npm run check
npm run format:check
npm test
npm run build
```
