# Setup de Desenvolvimento

## 🚀 Modo Desenvolvimento com Proxy

O projeto está configurado para usar proxy do Vite em desenvolvimento, permitindo acessar o client via dev server enquanto as APIs são redirecionadas para o servidor backend.

### Como funciona:

```
┌─────────────────────────────────────────────────────────────┐
│                    Modo Desenvolvimento                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Navegador                                                   │
│  http://localhost:5173  (ou IP:5173 para celular)          │
│        │                                                     │
│        ├── /index.html ────────► Vite Dev Server :5173      │
│        ├── /mobile.html ───────► Vite Dev Server :5173      │
│        ├── /test-livepix.html ─► Vite Dev Server :5173      │
│        │                                                     │
│        └── /api/* ──────────────► Proxy ──► Backend :3000   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Configuração do Proxy (vite.config.js):

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    ws: true, // Proxy WebSocket (para SSE)
  },
  '/manifest.json': 'http://localhost:3000',
  '/icons': 'http://localhost:3000'
}
```

## 📱 Como usar em desenvolvimento:

### 1. Inicie o servidor backend:

```bash
# Terminal 1 - Servidor backend
cd server
npm start

# Servidor roda em: http://localhost:3000
```

### 2. Inicie o dev server do client:

```bash
# Terminal 2 - Vite dev server
cd client
npm run dev

# Dev server roda em: http://localhost:5173
```

### 3. Acesse no navegador:

**Desktop:**
- http://localhost:5173 (página inicial)
- http://localhost:5173/mobile.html (modo mobile)
- http://localhost:5173/overlay.html (modo overlay)
- http://localhost:5173/test-livepix.html (teste LivePix)

**Celular na mesma rede:**
```bash
# Encontre o IP do seu computador:
# macOS/Linux: ifconfig | grep "inet "
# Windows: ipconfig

# Exemplo: Se seu IP é 192.168.1.100
http://192.168.1.100:5173
http://192.168.1.100:5173/mobile.html
http://192.168.1.100:5173/test-livepix.html
```

## ✅ Vantagens do modo dev com proxy:

1. **Hot Module Replacement (HMR)**: Mudanças no código refletem instantaneamente
2. **Acesso via IP**: Teste no celular na mesma rede WiFi
3. **Source Maps**: Debug mais fácil no DevTools
4. **Fast Refresh**: Não perde o estado da aplicação ao editar
5. **API Proxy**: Client e server em portas diferentes, sem CORS

## 🔧 Troubleshooting:

### Erro: "Failed to fetch" nas APIs

**Problema:** O proxy não está funcionando
**Solução:**
```bash
# 1. Verifique se o servidor backend está rodando
curl http://localhost:3000/api/health

# 2. Reinicie o Vite dev server
cd client
# Ctrl+C para parar
npm run dev
```

### Celular não consegue acessar via IP

**Problema:** Firewall bloqueando
**Solução:**
```bash
# macOS - Permitir conexões na porta 5173
sudo pfctl -d  # Desabilita firewall temporariamente (não recomendado)

# Ou adicione exceção para a porta 5173 em:
# System Preferences > Security & Privacy > Firewall > Firewall Options
```

**Solução alternativa:**
```bash
# Use host: '0.0.0.0' no vite.config.js (já configurado!)
# Isso permite conexões externas
```

### SSE não funciona

**Problema:** WebSocket proxy não configurado
**Solução:** Já configurado com `ws: true` no proxy

## 🏗️ Modo Produção:

```bash
# Build do client
cd client
npm run build

# Arquivos vão para: server/public/

# Inicie apenas o servidor
cd server
npm start

# Acesse tudo em: http://localhost:3000
```

## 🎯 Comparação Modos:

| Modo          | URL                  | Client Server | API Server | HMR |
|---------------|----------------------|---------------|------------|-----|
| **Dev**       | localhost:5173       | Vite :5173    | Node :3000 | ✅  |
| **Produção**  | localhost:3000       | Node :3000    | Node :3000 | ❌  |

## 📝 Comandos úteis:

```bash
# Desenvolvimento (2 terminais)
npm run dev:server  # Terminal 1 - Backend
npm run dev:client  # Terminal 2 - Frontend

# Build para produção
npm run build       # Build do client para server/public/
npm start          # Inicia servidor com build

# Teste rápido no celular
# 1. Encontre seu IP: ifconfig (macOS/Linux)
# 2. Acesse: http://SEU_IP:5173/test-livepix.html
```

## 🧪 Teste do LivePix via Dev Server:

1. **Configure .env no servidor:**
```bash
cd server
# Edite .env e adicione:
LIVEPIX_URLS=https://sua-url-livepix.com
```

2. **Inicie servidor e dev server:**
```bash
# Terminal 1
cd server && npm start

# Terminal 2
cd client && npm run dev
```

3. **Acesse no celular:**
```
http://SEU_IP:5173/test-livepix.html
```

4. **Clique em "🔊 Carregar LivePix Iframe"**

5. **Observe os logs na tela!**

## 🎨 Editando o código:

Com o dev server rodando, você pode editar qualquer arquivo em `client/src/` e as mudanças aparecerão instantaneamente no navegador!

```bash
# Exemplo: Edite mobile.js
code client/src/mobile.js

# Salve o arquivo (Ctrl+S)
# Navegador atualiza automaticamente! ✨
```
