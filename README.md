# Overlay Chat

Sistema de overlay para chat da Twitch com suporte a múltiplos canais.

## Estrutura

- `client/` - Frontend (Vite + Vanilla JS)
- `server/` - Backend (Fastify + SSE)

## Configuração

### Server

1. Entre na pasta do servidor:
```bash
cd server
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo `.env`:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure:
- `TWITCH_CHANNELS` - Lista de canais separados por vírgula
- `NODE_ENV` - `development` ou `production`

### Client

1. Entre na pasta do client:
```bash
cd client
```

2. Instale as dependências:
```bash
npm install
```

## Desenvolvimento

### Modo Desenvolvimento (com hot reload)

1. Inicie o servidor:
```bash
cd server
npm run dev
```

2. Em outro terminal, inicie o client:
```bash
cd client
npm run dev
```

3. Acesse:
- Client: http://localhost:5173
- API: http://localhost:3000/api

No modo desenvolvimento, o client acessa a API em `http://localhost:3000`.

### Modo Produção

1. Faça o build do client (cria arquivos em `server/public/`):
```bash
cd server
npm run build
```

2. Inicie o servidor:
```bash
cd server
npm start
```

3. Acesse tudo em http://localhost:3000:
- Interface: http://localhost:3000
- Overlay: http://localhost:3000/overlay.html
- Mobile: http://localhost:3000/mobile.html
- API: http://localhost:3000/api

No modo produção, o client acessa a API em `/api` (mesmo domínio).

## Páginas

- `/` - Página inicial com escolha de modo
- `/overlay.html` - Modo overlay (transparente, para OBS)
- `/mobile.html` - Modo mobile (para ler no celular durante lives IRL)

## API Endpoints

- `GET /api/health` - Status do servidor
- `GET /api/status` - Status das conexões
- `GET /api/chat/stream` - SSE stream de mensagens
- `GET /api/messages/history` - Histórico de mensagens
- `GET /api/channels` - Lista de canais ativos
- `GET /api/channels/colors` - Cores dos canais

## Tecnologias

- **Frontend**: Vite, Vanilla JS, CSS
- **Backend**: Fastify, SSE, WebSocket (Twitch IRC)
- **Logging**: Pino
