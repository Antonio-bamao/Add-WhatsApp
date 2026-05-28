param(
  [string]$ContainerName = "add-whatsapp-postgres",
  [string]$Database = "addwhatsapp",
  [string]$User = "addwhatsapp"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverRoot = Split-Path -Parent $scriptDir
$schemaPath = Join-Path $serverRoot "src\db\schema.sql"

if (-not (Test-Path -LiteralPath $schemaPath)) {
  throw "Schema file not found: $schemaPath"
}

docker cp $schemaPath "${ContainerName}:/tmp/add-whatsapp-schema.sql"
docker exec $ContainerName psql -v ON_ERROR_STOP=1 -U $User -d $Database -f /tmp/add-whatsapp-schema.sql
docker exec $ContainerName psql -U $User -d $Database -c "\dt"
