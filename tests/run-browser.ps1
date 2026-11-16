param(
 [string]$SiteUrl = 'http://127.0.0.1:8087/',
 [string]$LocalSiteUrl = 'http://127.0.0.1:8087/'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot
$profilePath = Join-Path $projectRoot 'tmp/chrome-cdp'
$localBaseUrl = $LocalSiteUrl.TrimEnd('/') + '/'
$chromeArgs = @('--headless', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9228', ('--user-data-dir=' + $profilePath), ($localBaseUrl + 'tests/browser.html'))
$chrome = Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList $chromeArgs -WindowStyle Hidden -PassThru
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
try {
 $target = $null
 for ($attempt=0; $attempt -lt 15 -and -not $target; $attempt++) {
  Start-Sleep -Milliseconds 500
  try { $targets = Invoke-RestMethod 'http://127.0.0.1:9228/json'; $target = $targets | Where-Object { $_.url -like '*tests/browser.html' } | Select-Object -First 1 } catch { }
 }
 if (-not $target) { throw 'Chrome no abrió la página de prueba.' }
 $socket.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
 $requestId = 0
 function Send-Cdp($method, $parameters) {
  $script:requestId++
  $bytes = [Text.Encoding]::UTF8.GetBytes((@{id=$script:requestId;method=$method;params=$parameters} | ConvertTo-Json -Depth 12 -Compress))
  $socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  do {
   $buffer = New-Object byte[] 65536
   $message = [IO.MemoryStream]::new()
   do {
    $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $message.Write($buffer, 0, $received.Count)
   } while (-not $received.EndOfMessage)
   $reply = [Text.Encoding]::UTF8.GetString($message.ToArray()) | ConvertFrom-Json
   $message.Dispose()
  } while ($reply.id -ne $script:requestId)
  if ($reply.error) { throw ($reply.error | ConvertTo-Json -Compress) }
  return $reply.result
 }
 $text = ''
 for ($attempt=0; $attempt -lt 80; $attempt++) {
  $result = Send-Cdp 'Runtime.evaluate' @{expression='document.getElementById("results").textContent';returnByValue=$true}
  $text = $result.result.value
  if ($text -match '^(PASS|FAIL)') { break }
  Start-Sleep -Milliseconds 500
 }
 Write-Output $text
 $shot = Send-Cdp 'Page.captureScreenshot' @{format='png';captureBeyondViewport=$true}
 [IO.File]::WriteAllBytes((Join-Path $projectRoot 'tmp/browser-test.png'), [Convert]::FromBase64String($shot.data))
 if ($text -notmatch '^PASS') { throw 'Las pruebas no terminaron correctamente.' }
 $null = Send-Cdp 'Page.navigate' @{url=($localBaseUrl + 'tests/cotizador-core.html')}
 $quoteTest = ''
 for ($attempt=0; $attempt -lt 80; $attempt++) {
  $result = Send-Cdp 'Runtime.evaluate' @{expression='document.getElementById("results").textContent';returnByValue=$true}
  $quoteTest = $result.result.value
  if ($quoteTest -match '^(PASS|FAIL)') { break }
  Start-Sleep -Milliseconds 500
 }
 Write-Output ('COTIZADOR: ' + $quoteTest)
 if ($quoteTest -notmatch '^PASS') { throw 'Las pruebas del cotizador no terminaron correctamente.' }
 $null = Send-Cdp 'Page.navigate' @{url=$SiteUrl}
 Start-Sleep -Milliseconds 700
 if ($SiteUrl -like 'https://*') {
  for ($attempt=0; $attempt -lt 30; $attempt++) {
   $ready = Send-Cdp 'Runtime.evaluate' @{expression='!!globalThis.JustificadorDocumento && !!globalThis.XLSX && document.readyState === "complete"';returnByValue=$true}
   if ($ready.result.value) { break }
   Start-Sleep -Milliseconds 500
  }
  if (-not $ready.result.value) { throw 'La aplicación publicada no terminó de cargar.' }
  $testHtml = Get-Content (Join-Path $PSScriptRoot 'browser.html') -Raw -Encoding UTF8
  $testJs = [regex]::Match($testHtml, '<script>([\s\S]*)</script>').Groups[1].Value
  $testJs = $testJs.Replace("document.querySelector('iframe').addEventListener('load', async () => {", '(async () => {')
  $testJs = $testJs.Replace("const output = document.getElementById('results'), win = document.querySelector('iframe').contentWindow, doc = win.document;", "const output = document.createElement('pre'), win = window, doc = document; output.id='results'; document.body.prepend(output);")
  $fixture = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot 'sample.docx')))
  $testJs = $testJs.Replace("await win.fetch('tests/sample.docx').then(r=>r.arrayBuffer())", "Uint8Array.from(atob('$fixture'), c=>c.charCodeAt(0)).buffer")
  $testJs = [regex]::Replace($testJs, '\}\);\s*$', '})();')
  $null = Send-Cdp 'Runtime.evaluate' @{expression=$testJs;awaitPromise=$true;returnByValue=$true}
  $live = Send-Cdp 'Runtime.evaluate' @{expression='document.getElementById("results").textContent';returnByValue=$true}
  Write-Output ('PUBLICADO: ' + $live.result.value)
  if ($live.result.value -notmatch '^PASS') { throw 'Fallaron las pruebas del sitio publicado.' }
 }
 $null = Send-Cdp 'Page.navigate' @{url=$SiteUrl}
 $menuReady = $false
 for ($attempt=0; $attempt -lt 80; $attempt++) {
  $result = Send-Cdp 'Runtime.evaluate' @{expression='!!document.querySelector(".app-nav__group-toggle") && document.querySelectorAll(".app-nav__sublink").length === 3';returnByValue=$true}
  $menuReady = $result.result.value
  if ($menuReady) { break }
  Start-Sleep -Milliseconds 500
 }
 if (-not $menuReady) { throw 'El menú desplegable de cotizadores no terminó de cargar.' }
 $menuLinks = Send-Cdp 'Runtime.evaluate' @{expression='Array.from(document.querySelectorAll(".app-nav__sublink")).map(link=>link.textContent.trim()).join("|") === "Cotizador RC|Productos Cerrados|Macro Pesados"';returnByValue=$true}
 if (-not $menuLinks.result.value) { throw 'El menú no muestra las tres opciones de cotizador esperadas.' }
 $null = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__group-toggle").click()';returnByValue=$true}
 $menuExpanded = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__group-toggle").getAttribute("aria-expanded") === "true" && !document.querySelector(".app-nav__submenu").hidden';returnByValue=$true}
 if (-not $menuExpanded.result.value) { throw 'El menú de cotizadores no se despliega.' }
 $null = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__group-toggle").click()';returnByValue=$true}
 $menuCollapsed = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__group-toggle").getAttribute("aria-expanded") === "false" && document.querySelector(".app-nav__submenu").hidden';returnByValue=$true}
 if (-not $menuCollapsed.result.value) { throw 'El menú de cotizadores no se puede contraer.' }
 $null = Send-Cdp 'Page.navigate' @{url=($SiteUrl.TrimEnd('/') + '/cotizador.html')}
 Start-Sleep -Milliseconds 500
 $activeQuote = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__sublink[aria-current=page]")?.textContent.trim() === "Cotizador RC" && document.querySelector(".app-nav__group-toggle").getAttribute("aria-expanded") === "true"';returnByValue=$true}
 if (-not $activeQuote.result.value) { throw 'La navegación no identifica el Cotizador RC activo.' }
 Write-Output 'PASS: menú Cotizadores expandible, contraíble y con ruta activa'
 $null = Send-Cdp 'Emulation.setDeviceMetricsOverride' @{width=390;height=844;deviceScaleFactor=1;mobile=$true}
 $null = Send-Cdp 'Page.navigate' @{url=$SiteUrl}
 Start-Sleep -Milliseconds 500
 $null = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__group-toggle").click()';returnByValue=$true}
 $mobileMenu = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__group-toggle").getAttribute("aria-expanded") === "true" && document.documentElement.scrollWidth <= innerWidth';returnByValue=$true}
 if (-not $mobileMenu.result.value) { throw 'El menú de cotizadores no funciona correctamente en móvil.' }
 Write-Output 'PASS: menú Cotizadores móvil'
 $null = Send-Cdp 'Page.navigate' @{url=($SiteUrl.TrimEnd('/') + '/macro-pesados.html')}
 $macroReady = $false
 for ($attempt=0; $attempt -lt 80; $attempt++) {
  $result = Send-Cdp 'Runtime.evaluate' @{expression='!!document.getElementById("dashboard") && !!document.getElementById("addVehicle")';returnByValue=$true}
  $macroReady = $result.result.value
  if ($macroReady) { break }
  Start-Sleep -Milliseconds 500
 }
 if (-not $macroReady) { throw 'El módulo Macro pesados no terminó de cargar.' }
 $macroFooter = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector("footer").innerText.includes("Mauricio Balseca") && document.querySelector("footer").innerText.includes("Cristian heredia")';returnByValue=$true}
 if (-not $macroFooter.result.value) { throw 'El pie de página de Macro pesados no coincide.' }
 $macroMobile = Send-Cdp 'Runtime.evaluate' @{expression='document.documentElement.scrollWidth <= innerWidth';returnByValue=$true}
 if (-not $macroMobile.result.value) { throw 'Macro pesados desborda el ancho del móvil.' }
 $macroActive = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__sublink[aria-current=page]")?.textContent.trim() === "Macro Pesados"';returnByValue=$true}
 if (-not $macroActive.result.value) { throw 'La navegación no identifica Macro Pesados como módulo activo.' }
 $null = Send-Cdp 'Page.navigate' @{url=($SiteUrl.TrimEnd('/') + '/cotizador-productos-cerrados.html')}
 $productsReady = $false
 for ($attempt=0; $attempt -lt 80; $attempt++) {
  $result = Send-Cdp 'Runtime.evaluate' @{expression='!!document.getElementById("category") && document.getElementById("category").options.length > 1';returnByValue=$true}
  $productsReady = $result.result.value
  if ($productsReady) { break }
  Start-Sleep -Milliseconds 500
 }
 if (-not $productsReady) { throw 'El módulo Productos cerrados no terminó de cargar.' }
 $productsActions = Send-Cdp 'Runtime.evaluate' @{expression='!Array.from(document.querySelectorAll(".action button")).some(button=>button.textContent.trim()==="Exportar JSON") && Array.from(document.querySelectorAll(".action button")).some(button=>button.textContent.trim()==="Imprimir / PDF") && Array.from(document.querySelectorAll(".action button")).some(button=>button.textContent.trim()==="Restablecer producto")';returnByValue=$true}
 if (-not $productsActions.result.value) { throw 'Las acciones de Productos cerrados no coinciden con las esperadas.' }
 $productsFooter = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector("footer").innerText.includes("Mauricio Balseca") && document.querySelector("footer").innerText.includes("Cristian heredia")';returnByValue=$true}
 if (-not $productsFooter.result.value) { throw 'El pie de página de Productos cerrados no coincide.' }
 $productsMobile = Send-Cdp 'Runtime.evaluate' @{expression='document.documentElement.scrollWidth <= innerWidth';returnByValue=$true}
 if (-not $productsMobile.result.value) { throw 'Productos cerrados desborda el ancho del móvil.' }
 $productsActive = Send-Cdp 'Runtime.evaluate' @{expression='document.querySelector(".app-nav__sublink[aria-current=page]")?.textContent.trim() === "Productos Cerrados"';returnByValue=$true}
 if (-not $productsActive.result.value) { throw 'La navegación no identifica Productos Cerrados como módulo activo.' }
 Write-Output 'PASS: Macro pesados y Productos cerrados cargan con navegación, pie solicitado y sin desbordamiento móvil'
} finally {
 $socket.Dispose()
 if (-not $chrome.HasExited) { Stop-Process -Id $chrome.Id }
}
