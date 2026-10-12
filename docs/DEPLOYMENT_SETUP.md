# Automated deployment: one-time setup

After this setup, merging to `main` releases Fully Involved Pour with no
terminal commands:

```
push to main
  ├─ Web checks (type check, lint, unit tests)
  ├─ Detect backend changes (functions/ or firebase.json)
  ├─ If the backend changed → "Deploy Cloud Functions" (deploy-functions.yml)
  │     tests on the emulator → waits for your approval → deploy
  │     → verifies askSommelier is live → live AXE smoke test → log check
  └─ Website deploy (unchanged step), only if all of the above succeeded
```

If anything in the backend path fails, or you reject the approval, the
website is **not** deployed, so a new web client never runs against an old
backend. Pull requests run `ci.yml` (web checks, plus functions and rules
tests on the emulator) with no credentials at all.

## How credentials work

| | Website (unchanged) | Cloud Functions (new) |
|---|---|---|
| Credential | `FIREBASE_SERVICE_ACCOUNT_FULLY_INVOLVED_POUR` secret (long-lived key from `firebase init hosting:github`) | **No key.** GitHub's short-lived OIDC token, exchanged via Workload Identity Federation (WIF) |
| Can deploy functions? | No: that account only has Hosting/Auth/viewer roles, and widening a long-lived key to backend code isn't recommended | Yes, but only from `main` of this repository |

Nothing secret is stored in the repo or in GitHub variables. The two values
you'll add are identifiers, not credentials. `ANTHROPIC_API_KEY` stays in
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

7. Copy the provider's full name from the pool's provider page. It looks like
   `projects/801004541737/locations/global/workloadIdentityPools/github/providers/github-actions`.

## Step 2: GitHub (repository Settings)

1. **Variables.** Secrets and variables → Actions → **Variables** tab → New
   repository variable:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER` = the provider name from step 1.7
   - `GCP_SERVICE_ACCOUNT` = `github-functions-deployer@fully-involved-pour.iam.gserviceaccount.com`
   - Optional: `FUNCTIONS_DEPLOY_TARGET` = `functions:askSommelier` to deploy
     only that function on merges (the default `functions` deploys all).
   - Optional: `AXE_SMOKE_TEST` = `false` to skip the live smoke test. It
     makes two model calls per backend release.

2. **Approval gate.** Environments → **New environment** → `production`.
   - Required reviewers: yourself.
   - Deployment branches and tags: *Selected branches* → `main`.

   Every backend deploy then pauses with a **Review deployments** button on
   the workflow run until you approve it.

## Releasing AXE (after setup)

1. Open the pull request `claude/ecstatic-mayer-9126ud` → `main` and confirm
   the CI checks are green.
2. Merge it. In the Actions tab, open **Deploy to Firebase Hosting**.
3. When **Cloud Functions / Deploy** asks for review, click **Review
   deployments → Approve**.
4. Watch these go green in order: deploy, askSommelier liveness check, live
   AXE smoke test, log check. The website deploy runs only after all of them.
5. On fullyinvolvedpour.com, accept the update banner and try **Ask AXE**.

If a step fails, the website stays on the previous version. The run's
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
