const INSTALL_URL = "https://github.com/apps/python-templates-automerge/installations/new";
const REPOSITORY_URL = "https://github.com/actions-ext/automerge";
const SUPPORT_URL = `${REPOSITORY_URL}/issues/new/choose`;

const styles = `
:root{color-scheme:dark;--bg:#070b18;--panel:#10172d;--panel-2:#151e3a;--text:#f7f8ff;--muted:#aab4d0;--cyan:#35d8ff;--violet:#8b5cf6;--line:#273354}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0%,#17214a 0,transparent 32rem),var(--bg);color:var(--text);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--cyan)}.shell{width:min(1120px,calc(100% - 2rem));margin:auto}.site-header{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 0}.brand{display:flex;align-items:center;gap:.75rem;color:var(--text);font-weight:750;text-decoration:none}.brand-mark{width:2.25rem;height:2.25rem}.nav{display:flex;gap:1.25rem}.nav a,.footer a{color:var(--muted);text-decoration:none}.nav a:hover,.footer a:hover{color:var(--text)}main{padding:4rem 0 5rem}.hero{max-width:800px;padding:3rem 0 4.5rem}.eyebrow{color:var(--cyan);font-size:.78rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.hero h1{font-size:clamp(2.8rem,8vw,5.8rem);line-height:.96;letter-spacing:-.055em;margin:.75rem 0 1.5rem}.hero p{max-width:680px;color:var(--muted);font-size:1.2rem}.actions{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:2rem}.button{display:inline-block;border:1px solid var(--line);border-radius:.65rem;padding:.7rem 1.05rem;color:var(--text);font-weight:700;text-decoration:none}.button.primary{border-color:transparent;background:linear-gradient(135deg,var(--violet),#5468ff)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.card,.content{border:1px solid var(--line);border-radius:1rem;background:linear-gradient(160deg,var(--panel-2),var(--panel));padding:1.4rem}.card h2{font-size:1.05rem;margin:.3rem 0}.card p{color:var(--muted);margin:.35rem 0}.steps{counter-reset:step;display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:4rem}.step{border-top:1px solid var(--line);padding-top:1.2rem;color:var(--muted)}.step:before{counter-increment:step;content:"0" counter(step);display:block;color:var(--cyan);font-size:.8rem;font-weight:800;letter-spacing:.12em;margin-bottom:.6rem}.content{max-width:820px;margin:auto}.content h1{font-size:2.6rem;line-height:1.1}.content h2{margin-top:2rem}.content p,.content li{color:var(--muted)}.content strong{color:var(--text)}.footer{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid var(--line);padding:1.5rem 0 2.5rem;color:var(--muted);font-size:.9rem}.footer-links{display:flex;gap:1rem}@media(max-width:760px){.nav{display:none}main{padding-top:1rem}.grid,.steps{grid-template-columns:1fr}.hero{padding-bottom:3rem}.footer{display:block}.footer-links{margin-top:.5rem}}
`;

const mark = `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M28 32h24" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M15 51h11c15 0 15-19 4-19" fill="none" stroke="#f02baa" stroke-width="9" stroke-linecap="round"/><path d="M17 13h10c15 0 15 19 3 23" fill="none" stroke="#10d9f5" stroke-width="9" stroke-linecap="round"/><circle cx="17" cy="13" r="7" fill="#10d9f5"/><circle cx="15" cy="51" r="7" fill="#f02baa"/><circle cx="52" cy="32" r="7" fill="#fff"/></svg>`;

function layout(title: string, description: string, content: string): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="description" content="${description}"><title>${title}</title><style>${styles}</style></head><body><div class="shell"><header class="site-header"><a class="brand" href="/">${mark}<span>Automerge</span></a><nav class="nav" aria-label="Main navigation"><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="${REPOSITORY_URL}">Source</a></nav></header><main>${content}</main><footer class="footer"><span>Free and open source from <a href="https://actions.python-templates.dev">actions-ext</a></span><span class="footer-links"><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/healthz">Status</a></span></footer></div></body></html>`,
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        "Content-Type": "text/html; charset=utf-8",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export function landingPage(): Response {
  return layout(
    "Automerge — Label-driven pull request merging",
    "Automerge merges labeled pull requests after GitHub checks and commit statuses finish.",
    `<section class="hero"><div class="eyebrow">GitHub App</div><h1>Merge when GitHub says it is ready.</h1><p>Add an <code>automerge</code> or <code>tag: automerge</code> label. The App waits for reported work to finish, rechecks the pull request, and asks GitHub to merge the exact checked commit.</p><div class="actions"><a class="button primary" href="${INSTALL_URL}">Install Automerge</a><a class="button" href="${REPOSITORY_URL}#readme">View documentation</a></div></section><section class="grid" aria-label="Benefits"><article class="card"><div class="eyebrow">Explicit</div><h2>Labels opt pull requests in</h2><p>Nothing merges until a maintainer adds one of the two recognized labels.</p></article><article class="card"><div class="eyebrow">Patient</div><h2>Reported work finishes first</h2><p>Automerge waits while checks run or commit statuses remain pending.</p></article><article class="card"><div class="eyebrow">Protected</div><h2>GitHub keeps final control</h2><p>Required reviews, rulesets, branch protection, and merge policies still apply.</p></article></section><section id="how-it-works" class="steps" aria-label="How Automerge works"><div class="step">Add an automerge label to an open, non-draft pull request.</div><div class="step">Checks and commit statuses reach terminal states.</div><div class="step">A 10-second grace period passes and eligibility is checked again.</div><div class="step">GitHub receives a merge request pinned to the checked head commit.</div></section>`,
  );
}

export function supportPage(): Response {
  return layout(
    "Support — Automerge",
    "Get technical support for the Automerge GitHub App.",
    `<article class="content"><div class="eyebrow">Support</div><h1>Get help with Automerge</h1><p>For installation, behavior, or account questions, <a class="button primary" href="${SUPPORT_URL}">open a support issue</a>.</p><h2>Include useful details</h2><ul><li>Repository and pull request URL</li><li>Label used and approximate event time</li><li>Expected and observed behavior</li><li>Relevant check, ruleset, or branch-protection state</li></ul><p>Do not include private keys, webhook secrets, access tokens, or private repository content. Public source and current behavior are available in the <a href="${REPOSITORY_URL}">Automerge repository</a>.</p></article>`,
  );
}

export function privacyPage(): Response {
  return layout(
    "Privacy policy — Automerge",
    "Privacy policy for the Automerge GitHub App.",
    `<article class="content"><div class="eyebrow">Effective August 4, 2026</div><h1>Privacy policy</h1><p>Automerge processes GitHub data only to evaluate and merge eligible pull requests in repositories where the App is installed.</p><h2>Data processed</h2><p>Webhook payloads and GitHub API responses may include installation and repository identifiers, repository names, pull request metadata, labels, reviews, check runs, commit statuses, and merge settings. Automerge does not request OAuth authorization, fetch source files, or maintain a customer database.</p><h2>Use and retention</h2><p>Data is used to authenticate the installation, determine merge eligibility, remove automerge labels after new commits, and request merges. Request data exists in Worker memory while an event is processed. Operational logs may contain repository names, pull request numbers, outcomes, and error messages, and age out according to Cloudflare account settings.</p><h2>Third-party services</h2><ul><li><strong>GitHub</strong> delivers webhooks and provides the API used to inspect and merge pull requests under the <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub privacy statement</a>.</li><li><strong>Cloudflare</strong> hosts the Worker, terminates network connections, and may process security and operational logs under the <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare privacy policy</a>.</li></ul><h2>Sharing and sale</h2><p>Automerge does not sell personal data, use advertising, run analytics, or share data except with GitHub and Cloudflare as required to operate the service.</p><h2>Control and deletion</h2><p>Repository owners control access through the GitHub App installation. Suspending or uninstalling the App stops new processing. Automerge stores no customer profile or application database to delete. For privacy questions, use the <a href="/support">support page</a>.</p><h2>Changes</h2><p>Material changes will be published on this page with a revised effective date.</p></article>`,
  );
}
