@description('Azure region.')
param location string

@description('Tags applied to every resource.')
param tags object

@description('App Service plan name.')
param planName string

@description('Web app name. Must be globally unique.')
param siteName string

@description('App Service plan SKU name.')
param skuName string

@description('Number of workers in the plan.')
param workerCount int

@description('Deployment environment (dev or prod).')
param environmentName string

@description('Build or release identifier surfaced by the app at runtime.')
param appVersion string

@description('Application Insights connection string.')
@secure()
param appInsightsConnectionString string

@description('Log Analytics workspace used for platform diagnostics.')
param workspaceId string

var isProduction = environmentName == 'prod'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: skuName
    capacity: workerCount
  }
  kind: 'linux'
  properties: {
    reserved: true
    zoneRedundant: false
  }
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: siteName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    publicNetworkAccess: 'Enabled'
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: !startsWith(skuName, 'B')
      http20Enabled: true
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/healthz'
      // The deployment package flattens apps/web/server/server.mjs to the site
      // root, next to public/, so the entry point has no directory prefix.
      appCommandLine: 'node server.mjs'
      numberOfWorkers: workerCount
      use32BitWorkerProcess: false
      remoteDebuggingEnabled: false
      webSocketsEnabled: false
      httpLoggingEnabled: true
      detailedErrorLoggingEnabled: !isProduction
      requestTracingEnabled: !isProduction
      logsDirectorySizeLimit: 50
      cors: {
        allowedOrigins: []
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'APP_ENVIRONMENT'
          value: environmentName
        }
        {
          name: 'APP_VERSION'
          value: appVersion
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          // WEBSITE_RUN_FROM_PACKAGE=1 is a Windows-only feature: on Linux the
          // package is staged under /home/data/SitePackages but never mounted
          // on /home/site/wwwroot, so the worker starts against an empty site.
          // Zip deploy extracts the package instead.
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        {
          name: 'XDT_MicrosoftApplicationInsights_Mode'
          value: 'recommended'
        }
      ]
    }
  }
}

resource siteScm 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: site
  name: 'scm'
  properties: {
    allow: false
  }
}

resource siteFtp 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: site
  name: 'ftp'
  properties: {
    allow: false
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: site
  name: 'platform-logs'
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
      }
      {
        category: 'AppServicePlatformLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output name string = site.name
output defaultHostName string = site.properties.defaultHostName
output principalId string = site.identity.principalId
