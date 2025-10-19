import { config } from './config.js';

const SERVER_URL = config.apiUrl;
let livePixUrls = [];

// Log functions - show logs on screen
function log(message, type = 'info') {
  const logsDiv = document.getElementById('logs');
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;

  const timestamp = new Date().toLocaleTimeString('pt-BR');
  entry.innerHTML = `<span class="timestamp">${timestamp}</span>${message}`;

  logsDiv.appendChild(entry);
  logsDiv.scrollTop = logsDiv.scrollHeight;

  // Also log to console
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function logInfo(msg) {
  log(msg, 'info');
}

function logSuccess(msg) {
  log(msg, 'success');
}

function logError(msg) {
  log(msg, 'error');
}

function logWarn(msg) {
  log(msg, 'warn');
}

// Clear logs
window.clearLogs = function() {
  document.getElementById('logs').innerHTML = '';
  logInfo('Logs limpos');
};

// Show device info
function showDeviceInfo() {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
    cookieEnabled: navigator.cookieEnabled,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  };

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  let deviceType = 'Desktop';
  if (isIOS) deviceType = 'iOS';
  else if (isAndroid) deviceType = 'Android';
  else if (isMobile) deviceType = 'Mobile';

  const infoText = `
    <strong>Tipo:</strong> ${deviceType}<br>
    <strong>Navegador:</strong> ${navigator.userAgent.split(' ').slice(-2).join(' ')}<br>
    <strong>Plataforma:</strong> ${info.platform}<br>
    <strong>Resolução:</strong> ${info.screenWidth}x${info.screenHeight}<br>
    <strong>Janela:</strong> ${info.windowWidth}x${info.windowHeight}<br>
    <strong>Online:</strong> ${info.online ? 'Sim ✅' : 'Não ❌'}<br>
    <strong>Cookies:</strong> ${info.cookieEnabled ? 'Habilitado ✅' : 'Desabilitado ❌'}
  `;

  document.getElementById('deviceInfo').innerHTML = infoText;

  logInfo(`Dispositivo detectado: ${deviceType}`);
  logInfo(`User Agent: ${navigator.userAgent}`);
}

// Fetch LivePix URLs from server
async function fetchLivePixUrls() {
  try {
    logInfo(`Buscando URLs do LivePix em: ${SERVER_URL}/api/livepix/urls`);

    const response = await fetch(`${SERVER_URL}/api/livepix/urls`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    logSuccess(`Resposta recebida: ${JSON.stringify(data)}`);

    if (data.enabled && data.urls && data.urls.length > 0) {
      livePixUrls = data.urls;
      logSuccess(`✅ LivePix configurado! ${data.count} URL(s) encontrada(s)`);
      data.urls.forEach((url, i) => {
        logInfo(`URL ${i + 1}: ${url}`);
      });
      return true;
    } else {
      logWarn('⚠️ LivePix não configurado (LIVEPIX_URLS vazio)');
      return false;
    }
  } catch (error) {
    logError(`❌ Erro ao buscar URLs: ${error.message}`);
    logError(`Stack: ${error.stack}`);
    return false;
  }
}

// Load LivePix iframe
window.loadLivePixIframe = async function() {
  logInfo('═══════════════════════════════════════');
  logInfo('🚀 INICIANDO TESTE DE LIVEPIX');
  logInfo('═══════════════════════════════════════');

  // Update status
  const statusDiv = document.getElementById('iframeStatus');
  statusDiv.innerHTML = '<span class="status status-loading">⏳ Carregando...</span>';

  // Fetch URLs first
  const success = await fetchLivePixUrls();

  if (!success || livePixUrls.length === 0) {
    statusDiv.innerHTML = '<span class="status status-error">❌ Erro: Nenhuma URL configurada</span>';
    logError('Não foi possível carregar LivePix. Configure LIVEPIX_URLS no .env');
    return;
  }

  // Clear existing iframes
  const container = document.getElementById('iframeContainer');
  container.innerHTML = '';
  container.style.display = 'block';
  container.classList.remove('minimized');

  // Create header with controls
  const header = document.createElement('div');
  header.className = 'iframe-header';
  header.innerHTML = `
    <span>📺 LivePix Iframe(s)</span>
    <div class="iframe-controls">
      <button class="iframe-btn" onclick="toggleIframeContainer()" title="Minimizar">─</button>
      <button class="iframe-btn" onclick="closeIframeContainer()" title="Fechar">✕</button>
    </div>
  `;
  container.appendChild(header);

  // Make header draggable
  makeDraggable(container, header);

  logInfo(`Criando ${livePixUrls.length} iframe(s)...`);

  livePixUrls.forEach((url, index) => {
    logInfo(`───────────────────────────────────────`);
    logInfo(`📦 Criando iframe ${index + 1}/${livePixUrls.length}`);

    // Add label for this iframe
    const label = document.createElement('div');
    label.className = 'iframe-label';
    label.textContent = `Iframe ${index + 1}: ${url.substring(0, 50)}${url.length > 50 ? '...' : ''}`;
    container.appendChild(label);

    const iframe = document.createElement('iframe');
    iframe.id = `livepix-test-${index}`;
    iframe.src = url;

    // Set attributes
    logInfo(`  - ID: livepix-test-${index}`);
    logInfo(`  - URL: ${url}`);

    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; microphone; camera; encrypted-media');
    logInfo(`  - Allow: autoplay; fullscreen; picture-in-picture; microphone; camera; encrypted-media`);

    iframe.setAttribute('loading', 'eager');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

    logInfo(`  - Sem sandbox (permite WebSocket)`);

    // Event listeners
    iframe.onload = function() {
      logSuccess(`✅ Iframe ${index + 1} carregado com sucesso!`);
      try {
        logInfo(`  - contentWindow: ${iframe.contentWindow ? 'Disponível' : 'Não disponível'}`);
        logInfo(`  - contentDocument: ${iframe.contentDocument ? 'Disponível' : 'Não disponível (cross-origin)'}`);
      } catch (e) {
        logWarn(`  - Erro ao acessar contentWindow/contentDocument: ${e.message}`);
      }
    };

    iframe.onerror = function(error) {
      logError(`❌ Erro ao carregar iframe ${index + 1}: ${error}`);
    };

    // Monitor iframe messages
    window.addEventListener('message', function(event) {
      logInfo(`📨 Mensagem recebida do iframe: ${JSON.stringify(event.data)}`);
      logInfo(`  - Origin: ${event.origin}`);
    });

    container.appendChild(iframe);
    logSuccess(`Iframe ${index + 1} adicionado ao DOM`);
  });

  statusDiv.innerHTML = '<span class="status status-loaded">✅ Iframe(s) carregado(s)</span>';

  logInfo('═══════════════════════════════════════');
  logSuccess(`✅ ${livePixUrls.length} iframe(s) criado(s) com sucesso!`);
  logInfo('═══════════════════════════════════════');
  logInfo('👀 Verifique se o conteúdo do LivePix está visível acima');
  logInfo('🔊 Verifique se você consegue ouvir o áudio');
};

// Test audio unlock
window.testAudioUnlock = async function() {
  logInfo('═══════════════════════════════════════');
  logInfo('🔓 TESTANDO DESBLOQUEIO DE ÁUDIO');
  logInfo('═══════════════════════════════════════');

  // Test 1: Silent audio
  try {
    logInfo('Teste 1: Tocando áudio silencioso...');
    const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAhgCmLqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');

    await silentAudio.play();
    logSuccess('✅ Áudio silencioso tocado com sucesso!');
    logInfo('  - AudioContext desbloqueado');
  } catch (e) {
    logError(`❌ Erro ao tocar áudio silencioso: ${e.message}`);
    logWarn('  - Pode ser necessário interação do usuário primeiro');
  }

  // Test 2: Try to interact with iframes
  const iframes = document.querySelectorAll('iframe[id^="livepix-test-"]');
  if (iframes.length > 0) {
    logInfo(`Teste 2: Enviando mensagem para ${iframes.length} iframe(s)...`);

    iframes.forEach((iframe, index) => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'user-interaction', action: 'play' }, '*');
          logSuccess(`✅ Mensagem enviada para iframe ${index + 1}`);
        } else {
          logWarn(`⚠️ contentWindow não disponível para iframe ${index + 1}`);
        }
      } catch (e) {
        logError(`❌ Erro ao enviar mensagem para iframe ${index + 1}: ${e.message}`);
      }
    });

    // Test 3: Reload iframes
    logInfo('Teste 3: Recarregando iframes para ativar WebSocket...');
    iframes.forEach((iframe, index) => {
      const originalSrc = iframe.src;
      logInfo(`  - Recarregando iframe ${index + 1}...`);

      iframe.src = '';
      setTimeout(() => {
        iframe.src = originalSrc;
        logSuccess(`  ✅ Iframe ${index + 1} recarregado`);
      }, 100);
    });
  } else {
    logWarn('⚠️ Nenhum iframe encontrado. Clique em "Carregar LivePix Iframe" primeiro.');
  }

  logInfo('═══════════════════════════════════════');
  logSuccess('✅ Teste de desbloqueio concluído!');
  logInfo('═══════════════════════════════════════');
};

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  logInfo('🎬 Página de teste carregada');
  showDeviceInfo();
  logInfo('💡 Clique em "Carregar LivePix Iframe" para começar');
});

// Monitor network status
window.addEventListener('online', () => {
  logSuccess('🌐 Rede online');
});

window.addEventListener('offline', () => {
  logError('📡 Rede offline');
});

// Monitor visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    logWarn('👁️ Página oculta');
  } else {
    logInfo('👁️ Página visível');
  }
});

// Toggle iframe container minimize/maximize
window.toggleIframeContainer = function() {
  const container = document.getElementById('iframeContainer');
  container.classList.toggle('minimized');

  if (container.classList.contains('minimized')) {
    logInfo('📦 Iframes minimizados');
  } else {
    logInfo('📦 Iframes maximizados');
  }
};

// Close iframe container
window.closeIframeContainer = function() {
  const container = document.getElementById('iframeContainer');
  container.style.display = 'none';
  logInfo('✕ Container de iframes fechado');
};

// Make element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  handle.onmousedown = dragMouseDown;
  handle.ontouchstart = dragTouchStart;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function dragTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    document.ontouchend = closeDragElement;
    document.ontouchmove = elementDragTouch;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.right = "auto";
  }

  function elementDragTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    pos1 = pos3 - touch.clientX;
    pos2 = pos4 - touch.clientY;
    pos3 = touch.clientX;
    pos4 = touch.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    element.style.right = "auto";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
  }
}
