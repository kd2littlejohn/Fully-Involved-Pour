# Automated deployment: one-time setup

After this setup, merging to `main` releases Fully Involved Pour with no
terminal commands:

```
push to main
  ├─ Web checks (type check, lint, unit tests)
  ├─ Approval gates check: both environments must have required reviewers
  ├─ If the backend changed → "Deploy Cloud Functions" (deploy-functions.yml)
  │     tests on the emulator → ⏸ approval 1 (production-functions) → deploy
  │     → askSommelier liveness check → live AXE smoke test → log check
  └─ ⏸ approval 2 (production-website) → website deploy (unchanged step)
```

The current website keeps serving until approval 2 is given, and approval 2
is only offered after the backend path succeeded. If a check fails, or you
reject an approval, nothing after it runs. The first AXE release deploys
only `askSommelier`. Pull requests run `ci.yml` (web checks, plus functions and rules
tests on the emulator) with no credentials at all.

## How credentials work

| | Website (unchanged) | Cloud Functions (new) |
|---|---|---|
| Credential | `FIREBASE_SERVICE_ACCOUNT_FULLY_INVOLVED_POUR` secret (long-lived key from `firebase init hosting:github`) | **No key.** GitHub's short-lived OIDC token, exchanged via Workload Identity Federation (WIF) |
| Can deploy functions? | No: that account only has Hosting/Auth/viewer roles, and widening a long-lived key to backend code isn't recommended | Yes, but only from `main` of this repository |

Nothing secret is stored anywhere in GitHub. The workflows already contain
the pool and service-account *names* used below (identifiers, not
credentials), so no GitHub variables are needed. `ANTHROPIC_API_KEY` stays in
Google Secret Manager. Workflows only check that it exists (metadata), never
read it.

**This repository is public, so its Actions logs are public too.** The
workflows print only test data, counts, and timestamps, never tokens, keys,
or log payloads. Keep it that way when editing them.

## Step 1: Google Cloud console (project `fully-involved-pour`)

Project number: `801004541737`.

1. **Enable an API.** APIs & Services → Library → enable **IAM Service Account
   Credentials API**.

2. **Create the identity pool.** IAM & Admin → Workload Identity Federation →
   **Create pool**.
   - Name: `GitHub`, Pool ID: `github`.
   - Add a provider: type **OpenID Connect (OIDC)**, name `github-actions`,
     provider ID `github-actions`, issuer
     `https://token.actions.githubusercontent.com`, audience: *Default audience*.
   - Attribute mapping:
     - `google.subject` = `assertion.sub`
     - `attribute.repository` = `assertion.repository`
     - `attribute.repository_id` = `assertion.repository_id`
     - `attribute.ref` = `assertion.ref`
   - Attribute condition (only this repository, only `main`):
     ```
     assertion.repository_id == '1249687445' && assertion.ref == 'refs/heads/main'
     ```

3. **Create the deploy service account.** IAM & Admin → Service Accounts →
   **Create service account**.
   - Name: `github-functions-deployer`. This creates
     `github-functions-deployer@fully-involved-pour.iam.gserviceaccount.com`.
   - Grant it these project roles:

     | Role | Why |
     |---|---|
     | Cloud Functions Admin | deploy and update functions |
     | Cloud Run Admin | 2nd-gen functions run on Cloud Run (invoker settings) |
     | Secret Manager Viewer | confirm `ANTHROPIC_API_KEY` exists and is bound (cannot read the value) |
     | Firebase Viewer | the Firebase CLI reads project metadata |
     | Service Usage Consumer | the Firebase CLI checks which APIs are enabled |
     | Cloud Datastore User | the smoke test seeds its own test user document |
     | Logs Viewer | the post-deploy error check |

4. **Let it act as the functions' runtime account.** Service Accounts → open
   **Default compute service account**
   (`801004541737-compute@developer.gserviceaccount.com`) → Permissions →
   Grant access → principal `github-functions-deployer@…` → role **Service
   Account User**.

5. **Let it sign the smoke test's custom token.** Service Accounts → open
   `github-functions-deployer` → Permissions → Grant access → principal: the
   same account → role **Service Account Token Creator**.

6. **Connect GitHub to the service account.** Workload Identity Federation →
   pool `github` → **Grant access** → *Grant access using service account
   impersonation* → choose `github-functions-deployer` → principals:
   attribute `repository` = `kd2littlejohn/Fully-Involved-Pour` → Save.
   Dismiss the "configure your application" download: no key file is needed.

Use exactly the names above (pool `github`, provider `github-actions`,
service account `github-functions-deployer`), because the workflows expect
them. If you use different names, set `GCP_WORKLOAD_IDENTITY_PROVIDER` and
`GCP_SERVICE_ACCOUNT` repository variables to match.

## Step 2: GitHub approval gates

Open https://github.com/kd2littlejohn/Fully-Involved-Pour/settings/environments/new
and create two environments, each with **Required reviewers** = yourself and
**Deployment branches and tags** = *Selected branches* → `main`:

1. `production-functions`: approves the backend deploy.
2. `production-website`: approves making the new website public.

Releases refuse to run if either environment is missing its reviewers.

Optional repository variables (Settings → Secrets and variables → Actions → Variables):
- `FUNCTIONS_DEPLOY_TARGET` = `functions` after the AXE release, so any
  backend change ships (the default deploys only `functions:askSommelier`).
- `AXE_SMOKE_TEST` = `false` to skip the live smoke test (two model calls
  per backend release).

## Releasing AXE (after setup)

1. Open the pull request `claude/ecstatic-mayer-9126ud` → `main` and confirm
   the CI checks are green.
2. Merge it. In the Actions tab, open **Deploy to Firebase Hosting**.
3. **Approval 1:** when the run shows *Review deployments* for
   `production-functions`, approve it.
4. Watch these go green: deploy, askSommelier liveness check, live AXE smoke
   test, log check.
5. **Approval 2:** approve `production-website`. Only now does the new site
   go public.
6. On fullyinvolvedpour.com, accept the update banner and try **Ask AXE**.

If a step fails or you reject either approval, the website stays on the
previous version. The run's
summary names the failing step. Re-run the failed jobs from the Actions tab
after fixing the cause.

## Later backend changes

Any merge that changes `functions/` repeats the same path automatically.
To redeploy without a code change: Actions → **Deploy Cloud Functions** →
**Run workflow** (branch `main`). Target defaults to `functions:askSommelier`.

## Notes

- Deploys never delete functions. If production has a function that isn't in
  the source, the CLI refuses and the run fails rather than deleting it.
- If a run warns that the Artifact Registry cleanup policy isn't set, the
  functions still deployed. To clear the warning, in the console go to
  Artifact Registry → repository `gcf-artifacts` (us-central1) → Edit →
  Cleanup policies → delete images older than 1 day.
- To revoke automation, delete the pool's grant on
  `github-functions-deployer` or disable the pool. No keys exist to rotate.
