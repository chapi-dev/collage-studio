using './main.bicep'

param appName = 'collage'
param environmentName = 'prod'
param location = 'westeurope'
param appServicePlanSku = 'P0v3'
param workerCount = 2
param logRetentionInDays = 90
param appVersion = readEnvironmentVariable('APP_VERSION', 'local')
param tags = {
  costCenter: 'demo'
  owner: 'chapi-dev'
}
