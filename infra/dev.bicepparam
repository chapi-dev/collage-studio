using './main.bicep'

param appName = 'collage'
param environmentName = 'dev'
param location = 'westeurope'
param appServicePlanSku = 'B1'
param workerCount = 1
param logRetentionInDays = 30
param appVersion = readEnvironmentVariable('APP_VERSION', 'local')
param tags = {
  costCenter: 'demo'
  owner: 'chapi-dev'
}
