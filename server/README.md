# Overlay Chat Server

Servidor Node.js que conecta ao chat da Twitch (modo anônimo/read-only) e fornece um stream SSE (Server-Sent Events) para visualização de mensagens em overlay.

## Funcionalidades

- ✅ Conexão anônima com IRC da Twitch (sem necessidade de OAuth)
- ✅ Suporte a múltiplos canais simultaneamente
- ✅ Merge de mensagens de diferentes canais em stream unificado
- ✅ Server-Sent Events (SSE) para streaming em tempo real
- ✅ Buffer circular de mensagens com TTL
- ✅ Reconexão automática com backoff exponencial
- ✅ Cores distintas por canal
- ✅ REST API para gerenciamento
- ✅ Read-only (apenas visualização, sem envio de mensagens)

## Instalação

```bash
cd server
npm install
```

## Configuração

Copie o arquivo `.env.example` para `.env` e configure:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# Canais para monitorar (separados por vírgula)
TWITCH_CHANNELS=gaules,alanzoka

# Buffer de mensagens
MAX_BUFFER_SIZE=1000
MESSAGE_TTL_MS=600000

# SSE Configuration
SSE_HEARTBEAT_INTERVAL=15000
SSE_RETRY_MS=3000
```

## Uso

### Iniciar o servidor

```bash
npm start
```

### Modo desenvolvimento (com watch)

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000`

## Endpoints da API

### Health Check
```
GET /api/health
```

Retorna o status do servidor.

**Exemplo de resposta:**
```json
{
  "status": "ok",
  "timestamp": 1760671130203,
  "uptime": 37.50
}
```

### Status de Conexões
```
GET /api/status
```

Retorna o status de todas as conexões e estatísticas.

**Exemplo de resposta:**
```json
{
  "twitch": {
    "connected": true,
    "channels": ["gaules"]
  },
  "buffer": {
    "totalMessages": 150,
    "maxSize": 1000,
    "channels": {
      "gaules": 150
    }
  },
  "sse": {
    "connectedClients": 2,
    "clients": [...]
  }
}
```

### SSE Stream (Server-Sent Events)
```
GET /api/chat/stream?channels=gaules&lastEventId=<id>
```

**Query Parameters:**
- `channels` (opcional): Canais para incluir (separados por vírgula)
- `exclude` (opcional): Canais para excluir (separados por vírgula)
- `lastEventId` (opcional): ID do último evento recebido (para recuperar mensagens perdidas)

**Exemplo de uso (JavaScript):**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/chat/stream');

eventSource.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  console.log(`[${message.channel}] ${message.username}: ${message.message}`);
});

eventSource.addEventListener('heartbeat', (event) => {
  const data = JSON.parse(event.data);
  console.log('Heartbeat:', data);
});
```

### Histórico de Mensagens
```
GET /api/messages/history?limit=100&channels=gaules
```

**Query Parameters:**
- `limit` (opcional): Número máximo de mensagens (padrão: 100)
- `channels` (opcional): Filtrar por canais específicos
- `exclude` (opcional): Excluir canais específicos

**Exemplo de resposta:**
```json
{
  "messages": [
    {
      "id": "1760671069334-gaules-abc123",
      "channel": "gaules",
      "channelColor": "#33FFF5",
      "username": "viewer1",
      "userId": "12345",
      "message": "Hello chat!",
      "timestamp": 1760671069334,
      "color": "#FFFFFF",
      "badges": [],
      "emotes": [],
      "isModerator": false,
      "isSubscriber": false,
      "isVip": false
    }
  ],
  "total": 150,
  "returned": 100
}
```

### Listar Canais Ativos
```
GET /api/channels
```

### Adicionar Canal
```
POST /api/channels
Content-Type: application/json

{
  "channel": "alanzoka"
}
```

Ou múltiplos canais:
```json
{
  "channels": ["alanzoka", "loud_coringa"]
}
```

### Remover Canal
```
DELETE /api/channels/:name
```

### Estatísticas de Canal
```
GET /api/channels/:name/stats
```

### Cores dos Canais
```
GET /api/channels/colors
```

Retorna o mapa de cores atribuídas a cada canal.

## Estrutura de Mensagens

Cada mensagem possui o seguinte formato:

```typescript
{
  id: string;                    // Formato: timestamp-channel-randomId
  channel: string;               // Nome do canal
  channelColor: string;          // Cor atribuída ao canal (hex)
  username: string;              // Nome de exibição do usuário
  userId: string;                // ID do usuário na Twitch
  message: string;               // Conteúdo da mensagem
  timestamp: number;             // Unix timestamp (ms)
  color: string;                 // Cor do usuário (hex)
  badges: Badge[];               // Badges do usuário
  emotes: Emote[];              // Emotes na mensagem
  isModerator: boolean;
  isSubscriber: boolean;
  isVip: boolean;
}
```

## Teste com curl

### Testar SSE Stream
```bash
curl -N http://localhost:3000/api/chat/stream
```

Mantenha o comando rodando e você verá as mensagens em tempo real.

### Testar endpoints REST
```bash
# Health check
curl http://localhost:3000/api/health

# Status
curl http://localhost:3000/api/status

# Histórico
curl http://localhost:3000/api/messages/history?limit=10

# Canais
curl http://localhost:3000/api/channels
```

## Logs

O servidor usa `pino` com `pino-pretty` para logs coloridos e formatados.

Níveis de log disponíveis:
- `debug`: Informações detalhadas (cada mensagem)
- `info`: Informações gerais (padrão)
- `warn`: Avisos
- `error`: Erros

Configure em `.env`:
```env
LOG_LEVEL=info
```

## Modo Anônimo (Read-Only)

O servidor conecta ao IRC da Twitch usando login anônimo (`justinfan12345`), que permite:

✅ Ler mensagens de qualquer canal público
✅ Sem necessidade de conta Twitch
✅ Sem necessidade de OAuth token
✅ Ideal para visualização read-only

❌ Não permite:
- Enviar mensagens
- Moderação
- Acesso a canais privados
- Operações que requerem autenticação

## Arquitetura

```
Twitch IRC (WebSocket)
        ↓
TwitchClient (connection + reconnect)
        ↓
MergedCircularBuffer (unified buffer)
        ↓
SSEManager (broadcast to clients)
        ↓
HTTP Server (Fastify + SSE)
```

## Performance

- **Buffer:** Armazena até 1000 mensagens por padrão
- **TTL:** Mensagens expiram após 10 minutos
- **Reconexão:** Backoff exponencial (1s, 2s, 4s, 8s... até 30s)
- **SSE Heartbeat:** A cada 15 segundos
- **Memory:** Baixo consumo, buffer circular evita leaks

## Troubleshooting

### Servidor não conecta ao Twitch
- Verifique sua conexão com a internet
- Teste conectividade: `curl https://irc-ws.chat.twitch.tv`

### Mensagens não aparecem
- Verifique se o canal está ativo e tem mensagens
- Veja os logs do servidor (`LOG_LEVEL=debug`)
- Teste o endpoint de histórico: `curl http://localhost:3000/api/messages/history`

### SSE desconecta frequentemente
- Verifique a estabilidade da sua rede
- Aumente o heartbeat interval no `.env`
- Use proxy reverso (nginx) com configurações de timeout adequadas

## Próximos Passos

- [ ] Implementar UI/Overlay para visualização
- [ ] Adicionar filtros avançados
- [ ] Persistência opcional de mensagens (SQLite)
- [ ] Métricas e monitoramento
- [ ] Docker support

## Licença

Uso proprietário - Não distribuir publicamente.
