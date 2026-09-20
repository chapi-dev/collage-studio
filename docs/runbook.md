# Runbook

Day-two operations for Collage Studio. Everything below assumes `az` and `gh` are
authenticated against the subscription and the repository used during bootstrap.

## Environments

| Environment | Resource group           | Identity                          | Promoted by                 |
| ----------- | ------------------------ | --------------------------------- | --------------------------- |
| dev         | `rg-collage-studio-dev`  | `id-collage-studio-github` (OIDC) | every push to `main`        |
| prod        | `rg-collage-studio-prod` | `id-collage-studio-github` (OIDC) | `prod` environment approval |

Resource names are suffixed with `uniqueString(resourceGroup().id, ...)`, so read the real
names from the deployment outputs instead of guessing them:

```bash
az deployment group list -g rg-collage-studio-dev --query "[0].properties.outputs" -o json
```

## Deploy

```bash
# full pipeline: build -> dev -> prod
gh workflow run cd.yml

# infrastructure only, from a workstation
az deployment group create \
  -g rg-collage-studio-dev \
  --template-file infra/main.bicep \
  --parameters infra/dev.bicepparam \
  --parameters appVersion=local
```

Preview infrastructure changes before merging — the same command CI runs on pull requests:

```bash
az deployment group what-if -g rg-collage-studio-prod \
  --template-file infra/main.bicep --parameters infra/prod.bicepparam
```

## Rollback

The deployment package artifact is kept for 30 days on every CD run. To roll back, re-run
the deployment job of the last good run:

```bash
gh run list --workflow cd.yml --limit 10
gh run rerun <run-id> --job <deploy-job-id>
```

If the site itself is broken but the infrastructure is fine, redeploy the previous package
directly:

```bash
gh run download <run-id> -n web-package -D ./rollback
cd rollback && zip -r ../rollback.zip . && cd ..
az webapp deploy -g rg-collage-studio-prod -n <site-name> --src-path rollback.zip --type zip
```

## Health and diagnostics

```bash
# liveness, the exact probe App Service and the pipeline use
curl -s https://<site>.azurewebsites.net/healthz

# live log stream
az webapp log tail -g rg-collage-studio-prod -n <site-name>
```

Failed requests over the last hour, from Application Insights:

```kusto
requests
| where timestamp > ago(1h) and success == false
| summarize count() by resultCode, bin(timestamp, 5m)
| order by timestamp desc
```

Slowest pages:

```kusto
requests
| where timestamp > ago(6h)
| summarize p95 = percentile(duration, 95), count() by name
| order by p95 desc
```

## Common issues

**`AADSTS700213: No matching federated identity record found`**
GitHub issued a subject the identity does not know. Print the subject from the failing job
log and register it:

```bash
az identity federated-credential create \
  --name gha-extra --identity-name id-collage-studio-github \
  --resource-group rg-collage-studio-cicd \
  --issuer https://token.actions.githubusercontent.com \
  --subject '<subject from the log>' \
  --audiences api://AzureADTokenExchange
```

Remember that a job with `environment:` uses `:environment:<name>`, not the branch, and
that GitHub sometimes emits numeric ids (`repo:owner@123/repo@456:...`). The bootstrap
script registers both spellings.

**Smoke test fails with HTTP 503 right after a deploy**
App Service is still warming the new package. The workflow retries for ten minutes; if it
still fails, check `az webapp log tail` for a startup crash — the most common cause is a
package missing `server.mjs`, which means `npm run package -w @collage/web` did not run.

**`az webapp deploy` reports "site failed to start" while the site is serving traffic**
Once a release crashes on boot, the site keeps a sticky
`LastError: ContainerStartupFailure` in its container status. The synchronous OneDeploy
poller reads that flag and reports `FailedInstances: 1` for every later deployment, even
after `Site started.` appears in the startup log with the new deployment id. That is why
the workflow deploys with `--async true` and treats the `/healthz` probe — which must
report the commit being deployed — as the real gate. To confirm by hand:

```bash
az webapp log download -n <site> -g <group> --log-file logs.zip
# LogFiles/StartupLogs/*_success.log ends with "Site started."
curl -s https://<site>.azurewebsites.net/healthz
```

**The site starts but every request 404s, and `/home/site/wwwroot` only holds
`hostingstart.html`**
`WEBSITE_RUN_FROM_PACKAGE=1` was set. On Linux that only stages the archive under
`/home/data/SitePackages`; it never mounts it on the site root. Remove the setting and
redeploy so zip deploy extracts the package.

**`az webapp deploy` returns 401**
Basic publishing credentials are disabled on purpose. Deployments must use an Azure AD
token, i.e. run after `azure/login`, never with a publish profile.

**Mobile build fails with a missing native module**
`react-native-view-shot` needs a development build. Expo Go cannot run this app:

```bash
npx eas build --profile development --platform android
```

## Cost control

`dev` runs on B1 (~13 EUR/month) and `prod` on P0v3 (~60 EUR/month). To pause the
non-production environment without losing the configuration:

```bash
az webapp stop -g rg-collage-studio-dev -n <site-name>
az appservice plan update -g rg-collage-studio-dev -n <plan-name> --sku F1
```

Deleting the whole environment is a single command, since no data is stored anywhere:

```bash
az group delete -g rg-collage-studio-dev --yes --no-wait
```
