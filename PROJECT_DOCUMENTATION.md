# Overlay Chat - Sistema de Chat da Twitch para Lives IRL

## 📋 Visão Geral

Sistema **proprietário** de overlay de chat da Twitch otimizado para lives IRL (In Real Life) com conectividade móvel 4G. O sistema consiste em um servidor que se conecta ao WebSocket da Twitch e uma interface UI **puramente visual** (read-only) que consome mensagens via Server-Sent Events (SSE), com resiliência a quedas de conexão e garantia de entrega de mensagens.

**⚠️ USO PROPRIETÁRIO:** Este sistema é desenvolvido para uso pessoal/privado e não será disponibilizado publicamente.

**📺 UI READ-ONLY:** A interface serve APENAS para visualização de mensagens em tempo real. Não há funcionalidade de envio de mensagens, interação com chat ou moderação.

## 🎯 Objetivos do Projeto

- **Exibir mensagens de chat da Twitch em overlay durante lives IRL (SOMENTE VISUALIZAÇÃO)**
- **Merge de múltiplos chats da Twitch em uma única visualização unificada**
- Suportar múltiplas lives simultaneamente
- Garantir resiliência em conexões instáveis (4G móvel)
- Reconexão automática sem perda de mensagens
- Interface leve e responsiva para dispositivos móveis
- Controle de quais canais exibir em tempo real
- **Sem funcionalidades de envio, resposta ou moderação de mensagens**

## 🏗️ Arquitetura do Sistema

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Twitch Chat 1│  │ Twitch Chat 2│  │ Twitch Chat N│
│ (Canal A)    │  │ (Canal B)    │  │ (Canal X)    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │ WebSocket       │ WebSocket       │ WebSocket
       └─────────────────┴─────────────────┘
                         ▼
              ┌─────────────────────┐
              │  Servidor Node.js   │
              │                     │
              │ - Multi-WS Client   │
              │ - Chat Merger       │◄── Merge Logic
              │ - Message Buffer    │
              │ - Channel Filter    │◄── Filter Control
              │ - SSE Server        │
              │ - REST API          │
              └──────────┬──────────┘
                         │ SSE (Unified Stream)
                         ▼
              ┌─────────────────────┐
              │   UI/Overlay        │
              │   (Navegador)       │
              │   READ-ONLY         │◄── Apenas Visualização
              │                     │
              │ - Auto-Reconnect    │
              │ - Unified Display   │◄── Merged Messages
              │ - Channel Toggle    │◄── Show/Hide Channels
              │ - Offline Buffer    │
              └─────────────────────┘
```

## 🔧 Componentes Principais

### 1. Servidor Backend

#### 1.1 Twitch WebSocket Client
- Conecta ao IRC da Twitch via WebSocket
- Autenticação OAuth
- Suporte a múltiplos canais simultaneamente
- Parsing de mensagens IRC (PRIVMSG, JOIN, PART, etc)
- Gerenciamento de PING/PONG para manter conexão ativa

#### 1.2 Chat Merger (Novo Componente)
- **Unificação de múltiplos chats em um único stream**
- Ordenação cronológica de mensagens de diferentes canais
- Identificação visual da origem (canal) de cada mensagem
- Suporte a filtros de canais em tempo real
- Normalização de dados de diferentes canais

#### 1.3 Message Buffer System
- Buffer circular de mensagens (últimas N mensagens)
- **Buffer unificado para todos os canais**
- Armazenamento em memória com timestamps
- IDs únicos por mensagem (incluindo identificador do canal)
- Suporte a recuperação de mensagens perdidas
- Limpeza automática de mensagens antigas
- Índice por canal para filtragem eficiente

#### 1.4 SSE (Server-Sent Events) Server
- Endpoint para streaming de mensagens **unificadas**
- Suporte a múltiplas conexões simultâneas
- Heartbeat/keep-alive automático
- Last-Event-ID para recuperação de mensagens
- **Suporte a filtros de canal via query params**
- Compressão de dados (opcional)

#### 1.5 REST API
- Gerenciamento de canais (adicionar/remover)
- **Controle de filtros de visualização (mostrar/ocultar canais)**
- Configurações do sistema
- Status de conexões por canal
- Estatísticas e health check
- **Listagem de mensagens por canal específico**

### 2. UI/Overlay Frontend (READ-ONLY)

**IMPORTANTE:** A UI é exclusivamente para visualização. Não há inputs, campos de texto, botões de envio ou qualquer forma de interação com o chat além da visualização.

#### 2.1 SSE Client (Consumo Apenas)
- Conexão persistente ao servidor (somente leitura)
- Tratamento de eventos de mensagens recebidas
- Detecção automática de desconexão
- Reconexão exponencial com backoff
- Last-Event-ID tracking
- **Sem capacidade de envio de dados**

#### 2.2 Offline/Resilience Layer
- Detecção de status de rede
- Buffer local de mensagens recebidas (cache)
- Sincronização ao reconectar
- Indicador visual de status de conexão
- Retry automático com estratégia inteligente
- **Foco em garantir continuidade da visualização**

#### 2.3 Message Display (Visualização Pura)
- **Renderização unificada de mensagens de múltiplos canais**
- **Indicador visual do canal de origem (tag/badge colorido)**
- Animações suaves de entrada de mensagens
- Suporte a emotes da Twitch (renderização de imagens)
- Badges de usuários (broadcaster, mod, subscriber, etc)
- Auto-scroll com controle manual (pausar scroll)
- Limite de mensagens exibidas (performance)
- **Sem inputs, sem campos de texto, sem envio**

#### 2.4 Channel Filter UI (Controles de Visualização)
- **Toggle visual para mostrar/ocultar canais específicos**
- **Salvar preferências de filtros localmente (localStorage)**
- **Indicador de atividade por canal (contadores de mensagens)**
- **Cores distintas por canal para identificação rápida**
- Interface colapsável/expansível para economizar espaço
- **Controles mínimos: apenas show/hide channels**

## 📡 Protocolos e APIs

### 3.1 Twitch IRC WebSocket

**URL:** `wss://irc-ws.chat.twitch.tv:443`

**Fluxo de Autenticação:**
```
PASS oauth:TOKEN
NICK username
CAP REQ :twitch.tv/tags twitch.tv/commands
JOIN #channel
```

**Mensagens Recebidas:**
```
@badge-info=;badges=broadcaster/1;color=#FF0000;display-name=User;emotes=;id=abc123;
user-type= :user!user@user.tmi.twitch.tv PRIVMSG #channel :Hello World
```

### 3.2 SSE Endpoint

**Endpoint:** `GET /api/chat/stream`

**Query Parameters:**
- `channels`: lista de canais para incluir no stream (comma-separated). Se omitido, retorna todos
- `exclude`: lista de canais para excluir (comma-separated)
- `lastEventId`: ID do último evento recebido (para recuperação)
- `merged`: boolean (default: true) - se false, separa mensagens por canal

**Event Format (Merged Stream):**
```
id: 1729134850123-channelA-abc123
event: message
data: {"channel":"channelA","channelColor":"#FF5733","user":"viewer1","message":"Hello!","timestamp":1729134850123}

id: 1729134850456-channelB-def456
event: message
data: {"channel":"channelB","channelColor":"#33FF57","user":"viewer2","message":"Hi there!","timestamp":1729134850456}

event: heartbeat
data: {"timestamp":1729134855000,"activeChannels":["channelA","channelB"]}
```

**Observações sobre o Merge:**
- Mensagens de diferentes canais são intercaladas em ordem cronológica
- Cada mensagem inclui `channel` e `channelColor` para identificação
- ID único global: `timestamp-channelName-randomId`
- Heartbeat inclui lista de canais ativos

### 3.3 REST API Endpoints

#### Channel Management
```
POST   /api/channels                    - Adicionar canal
DELETE /api/channels/:name              - Remover canal
GET    /api/channels                    - Listar canais ativos
GET    /api/channels/:name/stats        - Estatísticas do canal específico
```

#### Message & Filter Management
```
GET    /api/messages/history            - Histórico de mensagens (merged)
GET    /api/messages/history/:channel   - Histórico de canal específico
POST   /api/filters                     - Salvar filtros de visualização
GET    /api/filters                     - Obter filtros salvos
```

#### System
```
GET    /api/health                      - Health check
GET    /api/status                      - Status de todas conexões
GET    /api/status/:channel             - Status de conexão específica
GET    /api/channels/colors             - Mapa de cores por canal
```

**Exemplos de Requests:**

```javascript
// Adicionar múltiplos canais
POST /api/channels
{
  "channels": ["gaules", "alanzoka", "loud_coringa"]
}

// Salvar filtros (canais visíveis)
POST /api/filters
{
  "visible": ["gaules", "alanzoka"],
  "hidden": ["loud_coringa"]
}

// Obter histórico mesclado
GET /api/messages/history?limit=100&channels=gaules,alanzoka
```

## 🔀 Sistema de Merge de Chats

### Funcionamento do Merge

O sistema unifica mensagens de múltiplos canais da Twitch em um único stream ordenado cronologicamente.

#### Atribuição de Cores por Canal

```javascript
// Paleta de cores predefinidas para canais
const CHANNEL_COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33F5',
  '#F5FF33', '#33FFF5', '#FF8333', '#8333FF',
  '#33FF83', '#F533FF', '#FFD633', '#33D6FF'
];

// Atribuição determinística (hash do nome do canal)
function getChannelColor(channelName) {
  const hash = channelName.split('').reduce((acc, char) =>
    acc + char.charCodeAt(0), 0);
  return CHANNEL_COLORS[hash % CHANNEL_COLORS.length];
}
```

#### Algoritmo de Merge

1. **Recepção**: Mensagens chegam de diferentes canais via WebSocket
2. **Identificação**: Cada mensagem é taggeada com canal de origem e cor
3. **Buffer Unificado**: Todas mensagens vão para um único buffer circular
4. **Ordenação**: Buffer mantém ordem cronológica (timestamp)
5. **Distribuição**: SSE envia stream unificado para clientes

```javascript
// Pseudocódigo
class ChatMerger {
  constructor() {
    this.buffer = new MergedCircularBuffer(1000);
    this.channelColors = new Map();
  }

  onMessage(channel, ircMessage) {
    const color = this.getOrAssignColor(channel);
    const message = {
      id: `${Date.now()}-${channel}-${randomId()}`,
      channel: channel,
      channelColor: color,
      ...parseIRC(ircMessage),
      timestamp: Date.now()
    };

    this.buffer.add(message);
    this.broadcastToSSEClients(message);
  }

  getOrAssignColor(channel) {
    if (!this.channelColors.has(channel)) {
      this.channelColors.set(channel, getChannelColor(channel));
    }
    return this.channelColors.get(channel);
  }
}
```

### Filtragem de Canais

#### Server-Side Filtering
```javascript
// Cliente pode filtrar no servidor
GET /api/chat/stream?channels=gaules,alanzoka

// Ou excluir canais específicos
GET /api/chat/stream?exclude=loud_coringa
```

#### Client-Side Filtering
```javascript
// Cliente também pode filtrar localmente (mais rápido)
const visibleChannels = ['gaules', 'alanzoka'];
const filteredMessages = messages.filter(m =>
  visibleChannels.includes(m.channel)
);
```

### Exemplos de Uso (Read-Only)

#### Cenário 1: Live IRL - Visualizar chat enquanto transmite
```
Streamer fazendo live IRL no celular:
- Servidor roda em casa ou VPS
- Overlay aberto no celular (browser)
- Visualiza mensagens de seu próprio chat
- Pode adicionar chat de amigos/colaboradores
- Apenas lê mensagens, não responde pelo overlay
- Respostas são feitas verbalmente na live
```

#### Cenário 2: Acompanhar múltiplos streamers amigos
```javascript
// Conecta aos chats de 3 streamers simultaneamente
const channels = ['streamer1', 'streamer2', 'streamer3'];

// UI mostra mensagens mescladas com cores distintas:
// [Streamer1] User1: Olá!        (cor azul)
// [Streamer2] User2: E aí!        (cor verde)
// [Streamer1] User3: Beleza?      (cor azul)
// [Streamer3] User4: Fala galera! (cor laranja)

// Apenas visualização - sem envio de mensagens
```

#### Cenário 3: Monitorar chat principal + restream
```javascript
// Canal principal + canal de restream
const channels = ['canalPrincipal', 'canalRestream'];

// Visualiza mensagens de ambos unificadas
// Pode ocultar um temporariamente (via admin panel ou localStorage)
// Útil para ver interação em múltiplos destinos
```

#### Cenário 4: OBS Browser Source
```
Configuração no OBS:
1. Adicionar Browser Source
2. URL: http://localhost:3000/overlay
3. Dimensões: 400x800 (exemplo)
4. CSS: Background transparente
5. Overlay mostra chat em tempo real
6. Streamer vê no monitor/preview
```

#### Cenário 5: Live IRL com conexão instável (4G)
```javascript
// Múltiplos canais com reconexão independente
// Celular perde 4G temporariamente:
// - SSE detecta desconexão
// - Buffer local mantém mensagens visíveis
// - Ao reconectar: sincroniza mensagens perdidas
// - Continua visualização sem interrupção aparente
// Streamer não perde contexto do chat
```

## 🔐 Segurança e Autenticação

### Twitch OAuth (Servidor Apenas)
- Token de acesso OAuth 2.0
- Scopes necessários: **`chat:read`** apenas (read-only)
- **Não requer `chat:edit` ou `channel:moderate`** (sem envio)
- Armazenamento seguro de tokens (variáveis de ambiente)
- Refresh token automático

### API Protection (Uso Proprietário)
- **Autenticação simples (API key ou token fixo)**
- **CORS restrito ao domínio do overlay**
- **Sem necessidade de sistema complexo de usuários**
- Rate limiting básico para prevenir abuse
- Validação de input
- Sanitização de mensagens
- **Opcional: Whitelist de IPs permitidos**

## 🛡️ Resiliência e Recuperação

### Estratégias de Reconexão

#### Servidor → Twitch
1. Detecção de desconexão (timeout, erro de socket)
2. Backoff exponencial: 1s, 2s, 4s, 8s, 16s (max 30s)
3. Limpeza de estado anterior
4. Rejoin em todos os canais
5. Logging de eventos de reconexão

#### Cliente → Servidor
1. EventSource auto-reconnect nativo
2. Detecção de timeout (sem heartbeat por 30s)
3. Backoff exponencial: 1s, 2s, 5s, 10s, 30s
4. Envio de Last-Event-ID na reconexão
5. Sincronização de mensagens perdidas

### Message Recovery

**Buffer do Servidor:**
- Mantém últimas 1000 mensagens por canal
- Timestamp e ID único por mensagem
- TTL de 10 minutos

**Recuperação no Cliente:**
```javascript
// Cliente rastreia último ID recebido
lastEventId = "1729134850123-abc123"

// Na reconexão, servidor envia mensagens após esse ID
GET /api/chat/stream?lastEventId=1729134850123-abc123
```

### Network Status Detection

**Cliente:**
```javascript
// Navigator Online/Offline API
window.addEventListener('online', handleOnline)
window.addEventListener('offline', handleOffline)

// Connection quality detection
// RTT monitoring via heartbeat timestamps
```

## 🎨 UI/UX Specifications

### Layout (Display Only)
- Overlay transparente para uso em OBS/streaming software
- Posicionamento configurável via CSS
- Tamanho adaptável (responsivo)
- Modos: compacto, normal, expandido
- **Sem controles complexos de UI, foco em visualização limpa**
- **Ideal para chromeless browser/browser source**

### Mensagens
- **Badge/Tag do canal de origem (cor única)**
- Username colorido
- Badges (subscriber, moderator, etc)
- Emotes da Twitch renderizados
- Timestamps (opcional)
- Animação de entrada suave

**Exemplo visual:**
```
[Canal A] Username: Mensagem aqui
[Canal B] OtherUser: Outra mensagem
[Canal A] Username: Nova mensagem
```

### Status Indicators
- Conectado: verde
- Reconectando: amarelo/pulsante
- Desconectado: vermelho
- Número de tentativas de reconexão
- Última mensagem recebida (tempo)
- **Lista de canais ativos com contador de mensagens**

### Channel Control Panel (Opcional/Mínimo)
- Lista de canais conectados
- Toggle show/hide por canal (simples checkbox/botão)
- Indicador de atividade (msgs/min)
- Status de conexão por canal
- **Gerenciamento de canais via REST API (não na UI principal)**
- **Painel de controle pode ser em página separada (admin/config)**
- **Overlay principal é clean, sem controles visíveis**

### Performance
- Virtual scrolling para grandes quantidades
- Lazy loading de emotes
- Debouncing de animações
- Memory cleanup (remover mensagens antigas do DOM)

## 🚀 Stack Tecnológica Recomendada

### Backend
- **Runtime:** Node.js 18+ (ESM)
- **Framework:** Express ou Fastify
- **WebSocket Client:** `tmi.js` ou `ws` + custom IRC parser
- **Utilities:**
  - `eventsource-parser` (para parsing SSE)
  - `pino` (logging estruturado)
  - `dotenv` (configuração)

### Frontend
- **Framework:** React, Vue, ou Vanilla JS
- **SSE Client:** Native EventSource API
- **Styling:** CSS Modules ou Tailwind CSS
- **Build:** Vite
- **State Management:** Zustand ou Context API

### DevOps
- **Process Manager:** PM2
- **Reverse Proxy:** Nginx (para SSL/TLS)
- **Logging:** Pino + Log rotation
- **Monitoring:** Custom health checks

## 📊 Estrutura de Dados

### Message Object
```typescript
interface ChatMessage {
  id: string;                    // Unique ID: timestamp-channelName-random
  channel: string;               // Channel name (origem)
  channelColor: string;          // Cor associada ao canal (hex)
  username: string;              // User display name
  userId: string;                // Twitch user ID
  message: string;               // Message content
  timestamp: number;             // Unix timestamp (ms)
  color: string;                 // User color hex
  badges: Badge[];               // User badges
  emotes: Emote[];              // Emote data
  isModerator: boolean;
  isSubscriber: boolean;
  isVip: boolean;
}

interface Badge {
  type: string;                  // broadcaster, moderator, subscriber, etc
  version: string;
}

interface Emote {
  id: string;
  name: string;
  positions: [number, number][]; // Start and end positions in message
  url: string;
}

interface ChannelConfig {
  name: string;
  color: string;                 // Cor única para o canal no overlay
  visible: boolean;              // Se está visível no overlay
  connected: boolean;            // Status de conexão
  messageCount: number;          // Total de mensagens recebidas
}
```

### Server State
```typescript
interface ServerState {
  connections: Map<string, TwitchConnection>;
  channels: Map<string, ChannelConfig>;  // Configurações dos canais
  messageBuffer: MergedCircularBuffer;   // Buffer unificado
  sseClients: Set<SSEClient>;
  channelColors: Map<string, string>;    // Mapa de cores por canal
  config: ServerConfig;
}

interface TwitchConnection {
  channel: string;
  connected: boolean;
  reconnectAttempts: number;
  lastMessage: number;
  messageCount: number;
}

interface MergedCircularBuffer {
  messages: ChatMessage[];               // Array circular unificado
  maxSize: number;
  channelIndex: Map<string, number[]>;   // Índice: canal -> posições no buffer

  add(message: ChatMessage): void;
  getAll(): ChatMessage[];
  getByChannel(channel: string): ChatMessage[];
  getAfterTimestamp(timestamp: number): ChatMessage[];
  getFiltered(channels: string[]): ChatMessage[];
}
```

## 🔄 Fluxo de Dados Completo

### 1. Inicialização
```
1. Servidor inicia
2. Carrega configuração (channels, tokens)
3. Conecta ao Twitch IRC
4. Join nos canais configurados
5. Inicia servidor HTTP/SSE
6. Ready para aceitar conexões
```

### 2. Recepção de Mensagem (Múltiplos Canais)
```
1. Twitch envia PRIVMSG via WebSocket (de qualquer canal conectado)
2. Servidor identifica canal de origem
3. Parseia mensagem IRC
4. Atribui cor do canal à mensagem
5. Cria objeto ChatMessage com ID único (incluindo canal)
6. Adiciona ao buffer circular unificado (ordenação por timestamp)
7. Atualiza índice de canal no buffer
8. Broadcast para todos os clientes SSE (com info do canal)
9. Log da mensagem (opcional)
```

**Exemplo de Merge:**
```
Canal A (18:30:01.100): "Olá pessoal!"
Canal B (18:30:01.250): "E aí galera!"
Canal A (18:30:02.000): "Bora começar"
Canal C (18:30:02.500): "Presente!"

Resultado no buffer unificado (ordenado):
[
  {channel: "A", timestamp: 1730..100, message: "Olá pessoal!"},
  {channel: "B", timestamp: 1730..250, message: "E aí galera!"},
  {channel: "A", timestamp: 1730..000, message: "Bora começar"},
  {channel: "C", timestamp: 1730..500, message: "Presente!"}
]
```

### 3. Cliente Conecta (com Filtros)
```
1. Cliente abre GET /api/chat/stream?channels=canalA,canalB
2. Servidor adiciona à lista de clientes SSE
3. Servidor carrega filtros do cliente (se salvos)
4. Se lastEventId fornecido, envia mensagens perdidas (filtradas)
5. Inicia heartbeat (a cada 15s) com info de canais ativos
6. Cliente processa eventos recebidos
7. Cliente aplica cores distintas por canal
8. Cliente atualiza UI com indicadores de canal
9. Cliente carrega preferências de filtros do localStorage
```

### 4. Reconexão após Queda
```
SERVIDOR → TWITCH CAIU:
1. Servidor detecta socket close/error
2. Inicia timer de reconexão (backoff)
3. Limpa estado antigo
4. Tenta reconectar
5. Re-autentica e re-join canais
6. Continua enviando para clientes SSE

CLIENTE → SERVIDOR CAIU:
1. Cliente detecta timeout ou offline
2. EventSource dispara 'error'
3. Cliente fecha conexão antiga
4. Aguarda backoff delay
5. Cria novo EventSource com lastEventId
6. Servidor envia mensagens perdidas do buffer
7. Cliente sincroniza e continua
```

## 📝 Configuração

### Variáveis de Ambiente
```bash
# Twitch
TWITCH_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token_here
TWITCH_CHANNELS=channel1,channel2,channel3

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Message Buffer
MAX_BUFFER_SIZE=1000
MESSAGE_TTL_MS=600000

# SSE
SSE_HEARTBEAT_INTERVAL=15000
SSE_RETRY_MS=3000

# Security
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

### Arquivo de Configuração (config.json)
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "twitch": {
    "channels": ["channel1", "channel2"],
    "reconnect": {
      "maxAttempts": 10,
      "baseDelay": 1000,
      "maxDelay": 30000
    }
  },
  "messageBuffer": {
    "maxSize": 1000,
    "ttlMs": 600000
  },
  "sse": {
    "heartbeatInterval": 15000,
    "retryMs": 3000
  },
  "ui": {
    "maxDisplayMessages": 50,
    "animationDuration": 300,
    "autoScroll": true
  }
}
```

## 🧪 Casos de Teste

### Resiliência
1. ✅ Servidor perde conexão com Twitch → Reconecta automaticamente
2. ✅ Cliente perde conexão 4G → Reconecta e recupera mensagens
3. ✅ Servidor reinicia → Cliente detecta e reconecta
4. ✅ Múltiplas quedas rápidas → Backoff previne flood de conexões
5. ✅ Buffer cheio → Remove mensagens antigas primeiro

### Funcionalidade
1. ✅ Múltiplos canais simultâneos
2. ✅ **Merge de chats funcionando corretamente (ordem cronológica)**
3. ✅ **Identificação visual de origem (canal) em cada mensagem**
4. ✅ **Toggle de visibilidade por canal**
5. ✅ **Cores distintas por canal funcionando**
6. ✅ Emotes renderizam corretamente
7. ✅ Badges aparecem
8. ✅ Cores de usuário preservadas
9. ✅ Filtros salvos persistem após reload

### Performance
1. ✅ 1000+ mensagens/min sem lag
2. ✅ UI responsiva em 4G lento
3. ✅ Memória estável (sem leaks)
4. ✅ CPU baixo em idle

## 📱 Otimizações para 4G/Mobile

### Redução de Dados
- Compressão gzip em SSE
- Omitir dados desnecessários
- Batch de mensagens (opcional)
- CDN para emotes

### Battery Saving
- Reduzir frequência de heartbeat quando inativo
- Pausar quando tab não visível (Page Visibility API)
- Throttle de animações
- Lazy loading de recursos

### Network Efficiency
- Keep-alive connections
- Reuso de conexões HTTP/2
- Prefetch de emotes comuns
- Cache de badges/emotes

## 🗂️ Estrutura de Pastas Proposta

```
overlay-chat/
├── server/
│   ├── src/
│   │   ├── index.js                    # Entry point
│   │   ├── twitch/
│   │   │   ├── multiClient.js          # Multi-channel WS client
│   │   │   ├── parser.js               # IRC message parser
│   │   │   └── channelManager.js       # Channel connection manager
│   │   ├── merger/
│   │   │   ├── chatMerger.js           # Merge logic
│   │   │   └── channelColors.js        # Color assignment
│   │   ├── api/
│   │   │   ├── routes.js               # REST endpoints
│   │   │   ├── sse.js                  # SSE handler
│   │   │   └── filters.js              # Filter management
│   │   ├── buffer/
│   │   │   └── mergedBuffer.js         # Unified circular buffer
│   │   ├── utils/
│   │   │   ├── logger.js               # Pino logger
│   │   │   └── reconnect.js            # Backoff logic
│   │   └── config.js                   # Configuration
│   ├── package.json
│   └── .env
│
├── client/
│   ├── overlay/                        # Overlay principal (READ-ONLY)
│   │   ├── src/
│   │   │   ├── main.js                 # Entry point
│   │   │   ├── components/
│   │   │   │   ├── ChatOverlay.jsx     # Main overlay (display only)
│   │   │   │   ├── Message.jsx         # Message component
│   │   │   │   ├── ChannelBadge.jsx    # Channel origin badge
│   │   │   │   └── StatusIndicator.jsx # Connection status
│   │   │   ├── services/
│   │   │   │   ├── sseClient.js        # SSE connection (read-only)
│   │   │   │   └── messageStore.js     # State management
│   │   │   ├── utils/
│   │   │   │   ├── emoteParser.js      # Emote rendering
│   │   │   │   └── reconnect.js        # Reconnection logic
│   │   │   └── styles/
│   │   │       └── overlay.css
│   │   ├── index.html
│   │   └── vite.config.js
│   │
│   └── admin/                          # Painel de controle (opcional)
│       ├── src/
│       │   ├── main.js
│       │   ├── components/
│       │   │   ├── ChannelManager.jsx  # Add/Remove channels
│       │   │   └── ChannelFilter.jsx   # Filter controls
│       │   ├── services/
│       │   │   ├── apiClient.js        # REST API calls
│       │   │   └── filterStore.js      # Filter preferences
│       │   └── utils/
│       │       └── localStorage.js     # Persist settings
│       ├── index.html
│       └── vite.config.js
│
├── docs/
│   └── API.md
├── .gitignore
├── README.md
└── PROJECT_DOCUMENTATION.md      # Este arquivo
```

## 🎯 Próximos Passos

1. **Setup Inicial**
   - Inicializar projetos server e client
   - Configurar package.json e dependências
   - Setup de ambiente de desenvolvimento

2. **Desenvolvimento Backend**
   - Implementar Multi-channel Twitch WebSocket client
   - **Criar sistema de merge de chats**
   - **Implementar atribuição de cores por canal**
   - Criar unified message buffer system
   - Implementar SSE server com filtros
   - **Criar endpoints de gerenciamento de filtros**
   - Criar REST API completa

3. **Desenvolvimento Frontend**
   - **Overlay (Display Only):**
     - Setup do projeto Vite
     - Implementar SSE client com reconnect (read-only)
     - Criar componente de badge/tag de canal
     - Criar componentes de UI (visualização pura)
     - Implementar parsing de emotes
     - Estilizar para transparência (OBS browser source)
   - **Admin Panel (Opcional):**
     - Interface para gerenciar canais
     - Controles de filtros
     - Persistência de configurações (localStorage)

4. **Testes e Otimização**
   - Testar resiliência de conexão
   - Otimizar performance mobile
   - Testes de carga
   - Ajustes de UX

5. **Deploy e Monitoramento**
   - Setup de servidor
   - Configurar SSL/TLS
   - Implementar logging
   - Monitoramento de saúde

## 📚 Recursos e Referências

- [Twitch IRC Documentation](https://dev.twitch.tv/docs/irc)
- [EventSource/SSE Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [tmi.js Library](https://github.com/tmijs/tmi.js)
- [Network Information API](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

## 💡 Considerações de Design

### Por que Read-Only?

1. **Foco em Visualização**: Overlay é para acompanhar chat, não interagir
2. **Simplicidade**: Sem necessidade de autenticação complexa de usuário
3. **Performance**: Menos lógica, mais leve, ideal para 4G móvel
4. **Segurança**: Menor superfície de ataque (apenas leitura)
5. **Uso Prático**: Em lives IRL, streamer não interage via overlay, apenas visualiza

### Por que Merge?

1. **Simplicidade de Visualização**: Uma única área de chat ao invés de múltiplas janelas
2. **Economia de Espaço**: Ideal para overlays em dispositivos móveis (4G IRL)
3. **Contexto Unificado**: Facilita acompanhar conversas de múltiplas lives simultaneamente
4. **Flexibilidade**: Pode mostrar/ocultar canais específicos conforme necessidade

### Trade-offs

**Vantagens:**
- Menos confusão visual
- Mais eficiente em termos de espaço na tela
- Fácil de acompanhar timeline unificada
- Melhor para contexto "multi-stream"

**Desvantagens:**
- Pode ser confuso se muitos canais estiverem ativos simultaneamente
- Requer identificação visual clara do canal de origem
- Pode haver "spam" de um canal muito ativo sobrepondo outros

**Soluções Implementadas:**
- Cores distintas por canal (identificação rápida)
- Filtros para mostrar/ocultar canais
- Badges/tags visuais de origem
- Contadores de atividade por canal
- Client-side filtering (desempenho)

## 🚨 Limitações e Avisos

### Limitações da Twitch
- Rate limits no IRC (20 mensagens/10s para join/part)
- Máximo de ~50 canais simultâneos (limite não oficial)
- Possível throttling se muito ativo

### Uso Proprietário
- Sistema não deve ser compartilhado publicamente
- Tokens OAuth são pessoais e intransferíveis
- Respeitar ToS da Twitch
- **Sistema read-only não viola políticas (apenas visualização)**

### Performance
- Buffer limitado (últimas 1000 mensagens)
- Mensagens antigas são descartadas (não há persistência em DB)
- Client-side rendering pode ter lag com 100+ msgs/segundo

---

**Documento criado em:** 2025-10-16
**Versão:** 2.1.0 (Merge Support + Read-Only UI)
**Autor:** Claude Code
**Status:** Uso Proprietário - Read-Only Overlay

## 📋 Resumo Executivo

**O que é:**
Sistema proprietário que unifica múltiplos chats da Twitch em um único overlay visual para lives IRL.

**Principais características:**
- ✅ Merge de múltiplos canais em stream unificado
- ✅ UI puramente visual (read-only, sem envio de mensagens)
- ✅ Resiliência para conexões 4G instáveis
- ✅ SSE para streaming de mensagens em tempo real
- ✅ Cores distintas por canal
- ✅ Filtros de visualização
- ✅ Recuperação automática de mensagens perdidas

**O que NÃO é:**
- ❌ Não é um cliente de chat completo
- ❌ Não permite enviar mensagens
- ❌ Não tem moderação ou comandos
- ❌ Não é para uso público/compartilhado

**Ideal para:**
Streamers em lives IRL que precisam visualizar chat de múltiplos canais simultaneamente em dispositivo móvel com 4G.
