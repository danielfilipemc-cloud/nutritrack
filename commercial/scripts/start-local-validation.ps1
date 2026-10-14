param([ValidateSet('baseline','restore')][string]$Instance='baseline')
$ErrorActionPreference='Stop'
# Only prepares/starts a named local runtime. Does not install app migrations,
# delete/reset data, connect to a cloud project or publish the Next.js app.
$commercialRoot=Split-Path $PSScriptRoot -Parent
if((& node -p 'process.versions.node') -ne '22.23.3'){throw 'Activate the repository Node 22.23.3 runtime before starting local validation.'}
$dockerCommand=Get-Command docker -ErrorAction SilentlyContinue
$dockerExe=if($dockerCommand){$dockerCommand.Source}else{Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'}
if(-not(Test-Path -LiteralPath $dockerExe)){throw 'Docker Desktop is not installed'}
if($env:DOCKER_HOST -and $env:DOCKER_HOST -notlike 'npipe:////./pipe/*'){throw 'Remote DOCKER_HOST refused'}
$context=(& $dockerExe context inspect | ConvertFrom-Json)
if($LASTEXITCODE -ne 0 -or $context.Endpoints.docker.Host -notlike 'npipe:////./pipe/*'){throw 'Only a local Windows Docker engine is permitted'}
$engine=& $dockerExe info --format '{{.OSType}}'
if($LASTEXITCODE -ne 0 -or $engine -ne 'linux'){throw 'Start Docker Desktop with a healthy Linux engine first; WSL/reboot may be required'}
$network="aura-foundations-loopback-$Instance"
$existing=& $dockerExe network ls --filter "name=^$network`$" --format '{{.Name}}'
if($LASTEXITCODE -ne 0){throw 'Cannot inspect local networks'}
if($existing){
 $details=& $dockerExe network inspect $network | ConvertFrom-Json
 if($details.Driver -ne 'bridge' -or $details.Options.'com.docker.network.bridge.host_binding_ipv4' -ne '127.0.0.1' -or $details.Labels.'com.aura.synthetic' -ne 'true'){throw 'Existing network does not match the isolated validation configuration'}
}else{
 & $dockerExe network create --label com.aura.synthetic=true -o com.docker.network.bridge.host_binding_ipv4=127.0.0.1 $network | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Cannot create dedicated loopback network'}
}
$runtime=Join-Path $commercialRoot ".aura-integration/local-runtime/$Instance"
$configDir=Join-Path $runtime 'supabase'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$config=[IO.File]::ReadAllText((Join-Path $commercialRoot 'supabase/local-validation/config.toml'))
if($Instance -eq 'restore'){$config=$config.Replace('aura-foundations-local','aura-foundations-restore').Replace('573','583')}
$configPath=Join-Path $configDir 'config.toml'
if(Test-Path -LiteralPath $configPath){
 if([IO.File]::ReadAllText($configPath) -ne $config){throw 'Existing runtime configuration differs; review it instead of overwriting'}
}else{[IO.File]::WriteAllText($configPath,$config)}
$env:Path=(Split-Path $dockerExe -Parent)+';'+$env:Path
$log=Join-Path $runtime 'start.private.log'
& npm exec --yes --package=supabase@2.120.0 -- supabase --workdir $runtime --network-id $network start --exclude studio,postgres-meta,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor *> $log
if($LASTEXITCODE -ne 0){throw "Local startup failed. Review the private log at $log; do not publish credentials it may contain."}
Write-Output "Local $Instance runtime started. Private startup output retained in ignored .aura-integration. No AURA migrations have been applied by this script."
