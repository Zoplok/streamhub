param(
  [Parameter(Mandatory = $true)]
  [string] $HostName,

  [string] $WebProtocol = "https",
  [string] $RtmpProtocol = "rtmp"
)

$ErrorActionPreference = "Stop"

$hostNoSlash = $HostName.Trim().TrimEnd("/")
$webBase = "${WebProtocol}://${hostNoSlash}"
$rtmpUrl = "${RtmpProtocol}://${hostNoSlash}/live"
$wsUrl = "${webBase}/api/ws/stream"
$hlsUrl = "${webBase}/hls"

function Set-VercelEnv($Name, $Value) {
  Write-Host "Setting $Name..."
  $Value | vercel env add $Name production
}

Set-VercelEnv "NEXT_PUBLIC_RTMP_INGEST_URL" $rtmpUrl
Set-VercelEnv "NEXT_PUBLIC_INGEST_WS_URL" $wsUrl
Set-VercelEnv "HLS_PUBLIC_URL" $hlsUrl
Set-VercelEnv "RTMP_INGEST_URL" $rtmpUrl

Write-Host ""
Write-Host "Configured ingest URLs:"
Write-Host "  OBS RTMP: $rtmpUrl"
Write-Host "  Browser WS: $wsUrl"
Write-Host "  HLS: $hlsUrl"
Write-Host ""
Write-Host "Run: vercel --prod --yes"
