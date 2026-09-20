#Requires -Version 7.0
<#
.SYNOPSIS
    One-off bootstrap for the Collage Studio delivery pipeline.

.DESCRIPTION
    Creates everything the GitHub Actions workflows need in order to deploy without a
    single password:

      * three resource groups (cicd, dev, prod)
      * a user-assigned managed identity used by GitHub Actions through OIDC
      * federated credentials for main, pull requests and both environments
      * Contributor on the dev and prod resource groups
      * the dev and prod GitHub environments and the AZURE_* repository secrets

    A user-assigned managed identity is used instead of an Entra application because it
    needs no directory write permission, which many managed tenants do not grant.

    The script is idempotent: re-running it converges instead of failing.

.EXAMPLE
    pwsh ./scripts/bootstrap-azure.ps1 -Repository chapi-dev/collage-studio
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[^/]+/[^/]+$')]
    [string]$Repository,

    [string]$SubscriptionId,

    [string]$Location = 'westeurope',

    [string]$AppName = 'collage-studio',

    [string]$IdentityName = 'id-collage-studio-github'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step { param([string]$Message) Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Info { param([string]$Message) Write-Host "    $Message" -ForegroundColor DarkGray }

function Invoke-Az {
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = & az @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "az $($Arguments -join ' ') failed:`n$output"
    }
    return $output
}

foreach ($tool in @('az', 'gh')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' is required but was not found on PATH."
    }
}

# --------------------------------------------------------------------------------------
Write-Step 'Resolving Azure context'
if ($SubscriptionId) { Invoke-Az @('account', 'set', '--subscription', $SubscriptionId) | Out-Null }

$account = az account show -o json | ConvertFrom-Json
$SubscriptionId = $account.id
$tenantId = $account.tenantId
Write-Info "Subscription $($account.name) ($SubscriptionId)"
Write-Info "Tenant       $tenantId"

$resourceGroups = [ordered]@{
    cicd = "rg-$AppName-cicd"
    dev  = "rg-$AppName-dev"
    prod = "rg-$AppName-prod"
}

# --------------------------------------------------------------------------------------
Write-Step 'Registering resource providers'
foreach ($provider in @('Microsoft.Web', 'Microsoft.Insights', 'Microsoft.OperationalInsights', 'Microsoft.ManagedIdentity')) {
    $state = az provider show --namespace $provider --query registrationState -o tsv 2>$null
    if ($state -ne 'Registered') {
        Write-Info "$provider -> registering"
        Invoke-Az @('provider', 'register', '--namespace', $provider, '--wait') | Out-Null
    }
    else {
        Write-Info "$provider -> already registered"
    }
}

# --------------------------------------------------------------------------------------
Write-Step 'Creating resource groups'
foreach ($entry in $resourceGroups.GetEnumerator()) {
    Invoke-Az @('group', 'create', '--name', $entry.Value, '--location', $Location, '--tags', "application=$AppName", "environment=$($entry.Key)", 'managedBy=bootstrap') | Out-Null
    Write-Info "$($entry.Value) ready"
}

# --------------------------------------------------------------------------------------
Write-Step 'Creating the GitHub Actions managed identity'
Invoke-Az @('identity', 'create', '--name', $IdentityName, '--resource-group', $resourceGroups.cicd, '--location', $Location) | Out-Null
$identity = az identity show --name $IdentityName --resource-group $resourceGroups.cicd -o json | ConvertFrom-Json
Write-Info "clientId    $($identity.clientId)"
Write-Info "principalId $($identity.principalId)"

# --------------------------------------------------------------------------------------
Write-Step 'Creating federated credentials'
$owner, $repoName = $Repository.Split('/')
$repoInfo = gh api "repos/$Repository" | ConvertFrom-Json
$ownerId = $repoInfo.owner.id
$repoId = $repoInfo.id

# GitHub has been observed issuing the subject claim with numeric ids
# (repo:owner@123/repo@456:...). Both spellings are registered so the exchange works
# whichever form the runner presents.
$subjectSets = @(
    @{ Suffix = 'main'; Subject = "repo:${Repository}:ref:refs/heads/main" },
    @{ Suffix = 'pr'; Subject = "repo:${Repository}:pull_request" },
    @{ Suffix = 'env-dev'; Subject = "repo:${Repository}:environment:dev" },
    @{ Suffix = 'env-prod'; Subject = "repo:${Repository}:environment:prod" },
    @{ Suffix = 'main-id'; Subject = "repo:${owner}@${ownerId}/${repoName}@${repoId}:ref:refs/heads/main" },
    @{ Suffix = 'pr-id'; Subject = "repo:${owner}@${ownerId}/${repoName}@${repoId}:pull_request" },
    @{ Suffix = 'env-dev-id'; Subject = "repo:${owner}@${ownerId}/${repoName}@${repoId}:environment:dev" },
    @{ Suffix = 'env-prod-id'; Subject = "repo:${owner}@${ownerId}/${repoName}@${repoId}:environment:prod" }
)

$existing = az identity federated-credential list --identity-name $IdentityName --resource-group $resourceGroups.cicd -o json | ConvertFrom-Json
foreach ($set in $subjectSets) {
    $name = "gha-$($set.Suffix)"
    $match = $existing | Where-Object { $_.name -eq $name }
    if ($match -and $match.subject -eq $set.Subject) {
        Write-Info "$name -> up to date"
        continue
    }
    if ($match) { Invoke-Az @('identity', 'federated-credential', 'delete', '--name', $name, '--identity-name', $IdentityName, '--resource-group', $resourceGroups.cicd, '--yes') | Out-Null }
    Invoke-Az @(
        'identity', 'federated-credential', 'create',
        '--name', $name,
        '--identity-name', $IdentityName,
        '--resource-group', $resourceGroups.cicd,
        '--issuer', 'https://token.actions.githubusercontent.com',
        '--subject', $set.Subject,
        '--audiences', 'api://AzureADTokenExchange'
    ) | Out-Null
    Write-Info "$name -> $($set.Subject)"
}

# --------------------------------------------------------------------------------------
Write-Step 'Assigning Azure roles'
foreach ($scopeName in @($resourceGroups.dev, $resourceGroups.prod)) {
    $scope = "/subscriptions/$SubscriptionId/resourceGroups/$scopeName"
    $assigned = az role assignment list --assignee $identity.principalId --scope $scope --query "[?roleDefinitionName=='Contributor'] | length(@)" -o tsv
    if ($assigned -eq '0') {
        Invoke-Az @('role', 'assignment', 'create', '--assignee-object-id', $identity.principalId, '--assignee-principal-type', 'ServicePrincipal', '--role', 'Contributor', '--scope', $scope) | Out-Null
        Write-Info "Contributor granted on $scopeName"
    }
    else {
        Write-Info "Contributor already granted on $scopeName"
    }
}

# --------------------------------------------------------------------------------------
Write-Step 'Configuring the GitHub repository'
foreach ($environment in @('dev', 'prod')) {
    gh api --method PUT "repos/$Repository/environments/$environment" --silent
    Write-Info "environment $environment ready"
}

gh secret set AZURE_CLIENT_ID --repo $Repository --body $identity.clientId | Out-Null
gh secret set AZURE_TENANT_ID --repo $Repository --body $tenantId | Out-Null
gh secret set AZURE_SUBSCRIPTION_ID --repo $Repository --body $SubscriptionId | Out-Null
Write-Info 'AZURE_CLIENT_ID, AZURE_TENANT_ID and AZURE_SUBSCRIPTION_ID stored'

Write-Host ''
Write-Host 'Bootstrap complete.' -ForegroundColor Green
Write-Host "  dev  resource group : $($resourceGroups.dev)"
Write-Host "  prod resource group : $($resourceGroups.prod)"
Write-Host "  identity            : $IdentityName ($($identity.clientId))"
Write-Host ''
Write-Host 'Next: push to main, or run "gh workflow run cd.yml".'
