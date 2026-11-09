<#
    记日插件 · Windows 上的开发/发版入口。

    用法（在仓库根目录，或任意目录调用全路径）：
        scripts\win.cmd setup      一次性：装依赖（react 等 devDependency）
        scripts\win.cmd test       跑全部测试（101 项）
        scripts\win.cmd pack       只打包，产物在 dist\
        scripts\win.cmd install    测试 + 打包 + 装进 desktop profile（不发版看效果）
        scripts\win.cmd auth       检查 npm 令牌（pnpm whoami）
        scripts\win.cmd publish    测试 + 干跑 + 发布到 npm
        scripts\win.cmd push [-Message "..."]   提交全部改动并推到 GitHub

    为什么要 .cmd 包一层：Windows 默认执行策略是 Restricted，直接跑 .ps1 会被拒绝；
    win.cmd 用 -ExecutionPolicy Bypass 只对这一次进程放行，不改系统设置。
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('setup', 'test', 'pack', 'install', 'login', 'auth', 'publish', 'push')]
    [string]$Task = 'test',

    [string]$Message = ''
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
    # ---- 定位 DSH、自带 node/pnpm、可用的 git ----
    $appCandidates = @(
        $env:DSH_APP,
        (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness'),
        'S:\DSHAPP'
    ) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'DeepSeek Harness.exe')) }

    $app = $appCandidates | Select-Object -First 1

    if ($app) {
        $runtime = Join-Path $app 'resources\runtime'
        $node = Join-Path $runtime 'primary-runtime\dependencies\node\bin\node.exe'
        $pnpm = Join-Path $runtime 'primary-runtime\dependencies\pnpm\bin\pnpm.cjs'
        $dsh = Join-Path $runtime 'cli\bin\dsh.cmd'
    }

    if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
    if (-not $node) {
        throw "找不到 Node：既没有 DSH 自带的，也不在 PATH 里。设 `$env:DSH_APP 指向 DSH 安装目录（含 DeepSeek Harness.exe）。"
    }
    $env:PATH = (Split-Path $node) + ';' + $env:PATH

    if (-not (Test-Path $pnpm)) { $pnpm = $null }
    if (-not (Test-Path $dsh)) { $dsh = (Get-Command dsh -ErrorAction SilentlyContinue).Source }

    $gitCandidates = @(
        (Get-Command git -ErrorAction SilentlyContinue).Source,
        $env:DSH_GIT,
        'S:\DSHData\tools\PortableGit\cmd\git.exe'
    ) | Where-Object { $_ -and (Test-Path $_) }
    $git = $gitCandidates | Select-Object -First 1
    if ($git) { $env:PATH = (Split-Path $git) + ';' + $env:PATH }

    Write-Host "repo : $repo"
    Write-Host "app  : $(if ($app) { $app } else { '<未找到，用 PATH 里的 node/npm>' })"
    Write-Host "node : $node ($(& $node -v))"
    Write-Host "git  : $(if ($git) { "$git ($(& $git --version))" } else { '<未找到>' })"
    Write-Host ''

    function Invoke-Pnpm {
        param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
        if (-not $pnpm) { throw '找不到 pnpm.cjs，且 PATH 里也没有 pnpm。' }
        # Out-Host：pnpm 的 stdout 不能进函数返回值，否则 pack 的日志会被当成 tgz 路径
        & $node $pnpm @Args 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { throw "pnpm $($Args -join ' ') 失败（exit $LASTEXITCODE）" }
    }

    function Invoke-Tests {
        Write-Host '== 测试 ==' -ForegroundColor Cyan
        & $node --test
        if ($LASTEXITCODE -ne 0) { throw "测试失败（exit $LASTEXITCODE）" }
    }

    function Invoke-Pack {
        New-Item -ItemType Directory -Force -Path (Join-Path $repo 'dist') | Out-Null
        $version = (Get-Content (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
        Write-Host "== pack $version ==" -ForegroundColor Cyan
        Invoke-Pnpm pack --pack-destination dist
        $tgz = Get-ChildItem (Join-Path $repo 'dist') -Filter '*.tgz' |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $tgz) { throw 'pnpm pack 没有产出 tgz' }
        return $tgz.FullName
    }

    function Assert-NpmToken {
        $npmrc = Join-Path $env:USERPROFILE '.npmrc'
        if (-not (Test-Path $npmrc) -or
            -not (Select-String -Path $npmrc -Pattern '^\s*//registry\.npmjs\.org/:_authToken=\S+' -Quiet)) {
            throw "没有 npm 令牌：$npmrc 里缺 //registry.npmjs.org/:_authToken=...（见 PUBLISH.md）"
        }
    }

    switch ($Task) {
        'setup' {
            Write-Host '== 装依赖 ==' -ForegroundColor Cyan
            # 宿主 SDK 是 peerDependency，不该从 registry 装（要用 profile 里宿主那份）
            Invoke-Pnpm install --config.auto-install-peers=false
        }

        'test' { Invoke-Tests }

        'pack' {
            $tgz = Invoke-Pack
            Write-Host "产物: $tgz"
        }

        'install' {
            Invoke-Tests
            $tgz = Invoke-Pack

            Write-Host ''
            Write-Host '== 装进 profile desktop ==' -ForegroundColor Cyan
            if (-not $dsh) { throw '找不到 dsh CLI：设 $env:DSH_APP 指向 DSH 安装目录。' }
            & $dsh plugin --profile desktop add $tgz
            if ($LASTEXITCODE -ne 0) { throw "dsh plugin add 失败（exit $LASTEXITCODE）" }

            Write-Host ''
            Write-Host '== 完成 ==' -ForegroundColor Green
            Write-Host '客户端 bundle 在启动时加载：完全退出桌面端（含托盘）再开，页面改动才看得到。'
        }

        'login' {
            Write-Host '== 登录 npm（按提示输入用户名 / 密码 / 动态码）==' -ForegroundColor Cyan
            Invoke-Pnpm login
            Write-Host ''
            Write-Host '登录成功的话，令牌已写进 %USERPROFILE%\.npmrc；用 scripts\win.cmd auth 复查。' -ForegroundColor Green
        }

        'auth' {
            Assert-NpmToken
            Write-Host '== 令牌检查 ==' -ForegroundColor Cyan
            Invoke-Pnpm whoami
        }

        'publish' {
            Assert-NpmToken
            Invoke-Tests

            $version = (Get-Content (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
            Write-Host ''
            Write-Host "== 干跑（版本 $version）==" -ForegroundColor Cyan
            Invoke-Pnpm publish --dry-run --no-git-checks --access public

            Write-Host ''
            Write-Host "== 发布 $version ==" -ForegroundColor Cyan
            Invoke-Pnpm publish --no-git-checks --access public

            Write-Host ''
            Write-Host "已发布。等 1-5 分钟内容扫描，然后：" -ForegroundColor Green
            Write-Host "  $dsh plugin --profile desktop add `"@sunr/dsh-reminder@^$version`""
        }

        'push' {
            if (-not $git) { throw '找不到 git：装 Git for Windows，或设 $env:DSH_GIT 指向 git.exe。' }
            if (-not (Test-Path (Join-Path $repo '.git'))) { throw '这不是 git 仓库（没有 .git）。' }

            $changes = & $git status --porcelain
            if (-not $changes) {
                Write-Host '没有改动，直接推。' -ForegroundColor Yellow
            }
            else {
                if (-not $Message) { $Message = Read-Host '输入提交说明（一句话）' }
                & $git add -A
                & $git commit -m $Message
                if ($LASTEXITCODE -ne 0) { throw "git commit 失败（exit $LASTEXITCODE）" }
            }

            Write-Host '== push ==' -ForegroundColor Cyan
            & $git push
            if ($LASTEXITCODE -ne 0) {
                throw "git push 失败（exit $LASTEXITCODE）：多半是没登录。第一次推会弹 GitHub 登录窗，登一次就好；或用 PAT 写进凭据。"
            }
        }
    }
}
finally {
    Pop-Location
}
