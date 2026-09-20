targetScope = 'resourceGroup'

@description('Short application name used to compose every resource name.')
@minLength(3)
@maxLength(12)
param appName string = 'collage'

@description('Deployment environment. Drives sizing, retention and diagnostics.')
@allowed([
  'dev'
  'prod'
])
param environmentName string

@description('Azure region for every resource.')
param location string = resourceGroup().location

@description('App Service plan SKU. B1 is enough for a static SPA host; P0v3 adds zone support.')
@allowed([
  'B1'
  'B2'
  'S1'
  'P0v3'
  'P1v3'
])
param appServicePlanSku string = environmentName == 'prod' ? 'P0v3' : 'B1'

@description('Number of workers in the plan.')
@minValue(1)
@maxValue(10)
param workerCount int = environmentName == 'prod' ? 2 : 1

@description('Log Analytics retention in days.')
@minValue(30)
@maxValue(730)
param logRetentionInDays int = environmentName == 'prod' ? 90 : 30

@description('Build or release identifier surfaced by the app at runtime.')
param appVersion string = 'local'

@description('Tags applied to every resource.')
param tags object = {}

var suffix = uniqueString(resourceGroup().id, appName, environmentName)
var namePrefix = '${appName}-${environmentName}'
var commonTags = union(
  {
    application: 'collage-studio'
    environment: environmentName
    managedBy: 'bicep'
  },
  tags
)

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    location: location
    tags: commonTags
    workspaceName: 'log-${namePrefix}-${suffix}'
    appInsightsName: 'appi-${namePrefix}-${suffix}'
    retentionInDays: logRetentionInDays
  }
}

module web 'modules/web-app.bicep' = {
  name: 'web-app'
  params: {
    location: location
    tags: commonTags
    planName: 'asp-${namePrefix}-${suffix}'
    siteName: 'app-${namePrefix}-${suffix}'
    skuName: appServicePlanSku
    workerCount: workerCount
    environmentName: environmentName
    appVersion: appVersion
    appInsightsConnectionString: monitoring.outputs.connectionString
    workspaceId: monitoring.outputs.workspaceId
  }
}

@description('Default hostname of the deployed web app.')
output webAppUrl string = 'https://${web.outputs.defaultHostName}'

@description('Resource name of the web app, used by the deployment workflow.')
output webAppName string = web.outputs.name

@description('Application Insights instrumentation resource id.')
output appInsightsId string = monitoring.outputs.appInsightsId
