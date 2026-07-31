# 1. Configurar limites do WSL
$wslConfigPath = "$env:USERPROFILE\.wslconfig"
$configContent = @"
[wsl2]
memory=4GB
processors=4
swap=2GB
"@
Set-Content -Path $wslConfigPath -Value $configContent
Write-Host "Arquivo .wslconfig criado e limites definidos (4GB RAM, 4 CPUs)."

# 2. Desligar WSL (fecha o backend do Docker)
Write-Host "Desligando a máquina virtual do WSL..."
wsl --shutdown

# 3. Compactar os arquivos VHDX usando DiskPart (já que optimize-vhd não está disponível)
$dataVhdx = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"
if (Test-Path $dataVhdx) {
    Write-Host "Compactando o disco de dados do Docker ($dataVhdx)... Isso pode levar 1-2 minutos."
    $script = "select vdisk file=`"$dataVhdx`"`r`nattach vdisk readonly`r`ncompact vdisk`r`ndetach vdisk"
    $script | diskpart | Out-Null
    Write-Host "Disco de dados compactado!"
}

$mainVhdx = "$env:LOCALAPPDATA\Docker\wsl\main\ext4.vhdx"
if (Test-Path $mainVhdx) {
    Write-Host "Compactando o disco principal do Docker ($mainVhdx)..."
    $script2 = "select vdisk file=`"$mainVhdx`"`r`nattach vdisk readonly`r`ncompact vdisk`r`ndetach vdisk"
    $script2 | diskpart | Out-Null
    Write-Host "Disco principal compactado!"
}

Write-Host "=== Tudo pronto! ==="
Write-Host "Espaço recuperado. Você pode abrir o Docker Desktop novamente."
