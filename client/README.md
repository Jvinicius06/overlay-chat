# Overlay Chat Client

Cliente web para visualização de chat da Twitch com dois modos: **Overlay** (transparente para OBS) e **Mobile** (para leitura em celular durante lives IRL).

## Funcionalidades

- ✅ **Modo Overlay**: Fundo transparente, ideal para OBS Browser Source
- ✅ **Modo Mobile**: Interface otimizada para celular, perfeito para lives IRL
- ✅ Conexão SSE com reconexão automática
- ✅ Buffer local de mensagens
- ✅ Badges coloridos por canal
- ✅ Suporte a emotes da Twitch
- ✅ Auto-scroll inteligente
- ✅ Indicador de status de conexão
- ✅ Resiliência para conexões 4G instáveis

## Instalação

```bash
cd client
npm install
```

## Desenvolvimento

```bash
npm run dev
```

O servidor Vite iniciará em `http://localhost:5173`

## Build para Produção

```bash
npm run build
```

Os arquivos estarão em `dist/`

## Modos de Uso

### 1. Página Inicial
Acesse `http://localhost:5173/` para escolher o modo

### 2. Modo Overlay (OBS)
URL: `http://localhost:5173/overlay.html`

**Configuração no OBS:**
1. Adicionar → Browser Source
2. URL: `http://localhost:5173/overlay.html`
3. Largura: 800 (ajuste conforme necessário)
4. Altura: 600 (ajuste conforme necessário)
5. ✅ Marcar "Shutdown source when not visible"
6. ✅ Marcar "Refresh browser when scene becomes active"

**Características:**
- Fundo transparente
- Mensagens aparecem de baixo para cima
- Últimas 20 mensagens visíveis
- Animações suaves
- Badge colorido por canal
- Status de conexão no canto superior direito

### 3. Modo Mobile (IRL)
URL: `http://localhost:5173/mobile.html`

**Como usar:**
1. Abra no navegador do celular
2. Adicione à tela inicial (Add to Home Screen)
3. Use durante lives IRL para ler o chat

**Características:**
- Fundo escuro para economia de bateria
- Até 100 mensagens mantidas em memória
- Auto-scroll com botão de voltar ao final
- Indicador de canais ativos no header
- Otimizado para touch (sem zoom acidental)
- Timestamps visíveis
- Contador de mensagens

## Estrutura de Arquivos

```
client/
├── src/
│   ├── overlay.js              # Lógica do modo overlay
│   ├── mobile.js               # Lógica do modo mobile
│   ├── services/
│   │   └── sseClient.js        # Cliente SSE com reconnect
│   ├── utils/
│   │   ├── messageStore.js     # Store de mensagens
│   │   └── chatRenderer.js     # Renderização de mensagens
│   └── styles/
│       ├── overlay.css         # Estilos do overlay
│       └── mobile.css          # Estilos mobile
├── index.html                  # Página de seleção de modo
├── overlay.html                # Modo overlay
├── mobile.html                 # Modo mobile
├── package.json
└── vite.config.js
```

## Configuração

### Mudar URL do Servidor

Edite os arquivos `src/overlay.js` e `src/mobile.js`:

```javascript
const SERVER_URL = 'http://localhost:3000'; // Altere aqui
```

### Ajustar Número de Mensagens

**Overlay** (`src/overlay.js`):
```javascript
const MAX_MESSAGES = 20; // Altere aqui
```

**Mobile** (`src/mobile.js`):
```javascript
const MAX_MESSAGES = 100; // Altere aqui
```

## Screenshots

### Modo Overlay
```
┌──────────────────────────────┐
│                    [●] Live  │ ← Status
│                              │
│                              │
│ [Canal A] User1: msg...     │ ← Última msg
│ [Canal B] User2: msg...     │
│ [Canal A] User3: msg...     │
└──────────────────────────────┘
  ↑ Fundo transparente
```

### Modo Mobile
```
┌──────────────────────────────┐
│ Twitch Chat                  │ ← Header
│ #canal1 #canal2              │ ← Canais ativos
├──────────────────────────────┤
│ [Canal A] User1    12:34    │
│ Message content here...      │
├──────────────────────────────┤
│ [Canal B] User2    12:35    │
│ Another message...           │
├──────────────────────────────┤
│                              │
│          [↓]                 │ ← Scroll button
│                              │
├──────────────────────────────┤
│ ● Connected | 50 messages   │ ← Status bar
└──────────────────────────────┘
```

## Troubleshooting

### Overlay não aparece no OBS
- Verifique se o servidor está rodando (`npm run dev`)
- Teste a URL no navegador primeiro
- Certifique-se de que a fonte do navegador está configurada corretamente
- Tente recarregar a fonte (botão direito → Atualizar)

### Mensagens não aparecem
- Verifique se o servidor backend está rodando
- Abra o console do navegador (F12) e veja os logs
- Verifique a conexão com `http://localhost:3000/api/health`
- Certifique-se de que há canais configurados no servidor

### Mobile muito lento no 4G
- O sistema já é otimizado para conexões lentas
- Verifique a qualidade do sinal 4G
- A reconexão automática cuidará de quedas de conexão
- Mensagens perdidas serão recuperadas automaticamente

### Emotes não aparecem
- Emotes são carregados da CDN da Twitch
- Requer conexão com internet ativa
- Verifique bloqueadores de conteúdo

## Personalizações Comuns

### Alterar Cores dos Badges

Edite `src/utils/chatRenderer.js`:

```javascript
// As cores são atribuídas automaticamente pelo servidor
// mas você pode customizar o contraste
```

### Alterar Tamanho da Fonte

**Overlay** (`src/styles/overlay.css`):
```css
.message-content {
  font-size: 16px; /* Altere aqui */
}
```

**Mobile** (`src/styles/mobile.css`):
```css
.mobile-content {
  font-size: 16px; /* Altere aqui */
}
```

### Alterar Número de Mensagens Visíveis no Overlay

Além de alterar `MAX_MESSAGES` no código, ajuste a altura do container:

```css
.messages-container {
  max-height: 80vh; /* Ajuste conforme necessário */
}
```

## Deploy

### Build
```bash
npm run build
```

### Servir Arquivos Estáticos
```bash
npm run preview
```

### Produção
Os arquivos em `dist/` podem ser servidos por qualquer servidor web estático (nginx, Apache, etc).

## Acesso Remoto (IRL)

Para acessar de outro dispositivo na mesma rede:

1. Inicie o servidor: `npm run dev`
2. Vite mostrará algo como: `Network: http://192.168.x.x:5173/`
3. Acesse esse endereço no celular

Para acesso via internet (lives IRL fora de casa):
- Use um serviço como ngrok, localtunnel, ou similar
- Ou configure port forwarding no roteador
- **Atenção:** Considere segurança ao expor portas

## Compatibilidade

- Chrome/Edge 90+
- Firefox 90+
- Safari 14+
- Chrome Mobile (Android)
- Safari Mobile (iOS)

## Performance

- **Overlay**: ~5-10 MB RAM
- **Mobile**: ~20-30 MB RAM
- **CPU**: < 5% em idle
- **Network**: ~1-2 KB/s (apenas mensagens)

## Licença

Uso proprietário - Não distribuir publicamente.
