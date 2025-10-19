# 🐳 Guia Docker - Overlay Chat

Este guia mostra como rodar o Overlay Chat usando Docker, incluindo suporte completo ao Puppeteer para captura de áudio do LivePix.

---

## 📋 Pré-requisitos

- Docker instalado ([Download](https://www.docker.com/get-started))
- Docker Compose instalado (geralmente vem com Docker Desktop)

---

## 🚀 Início Rápido

### 1. Configure as variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.docker .env

# Edite com seus canais e URLs do LivePix
nano .env  # ou use seu editor favorito
```

**Exemplo de .env:**
```env
TWITCH_CHANNELS=sacy,aspas,loud_coringa
LIVEPIX_URLS=https://sua-url-1.livepix.gg,https://sua-url-2.livepix.gg
```

### 2. Build e inicie o container

```bash
# Build da imagem e start do container
docker-compose up -d

# Ou rebuild se já existir
docker-compose up -d --build
```

### 3. Acesse a aplicação

- **Chat Overlay:** http://localhost:3000
- **Mobile:** http://localhost:3000/mobile.html
- **API Health:** http://localhost:3000/api/health

---

## 🛠️ Comandos Úteis

### Ver logs em tempo real
```bash
docker-compose logs -f
```

### Ver logs apenas do Puppeteer
```bash
docker-compose logs -f | grep "AudioCapture"
```

### Parar o container
```bash
docker-compose down
```

### Restart do container
```bash
docker-compose restart
```

### Ver status do container
```bash
docker-compose ps
```

### Acessar shell do container
```bash
docker-compose exec overlay-chat sh
```

---

## 🔧 Configurações Avançadas

### Limites de Recursos

Edite `docker-compose.yml` para ajustar limites de memória:

```yaml
deploy:
  resources:
    limits:
      memory: 2G  # Máximo 2GB
    reservations:
      memory: 1G   # Mínimo 1GB
```

### Variáveis de Ambiente

Todas as variáveis podem ser configuradas no `.env`:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `TWITCH_CHANNELS` | Canais do Twitch (separados por vírgula) | `sacy,aspas` |
| `LIVEPIX_URLS` | URLs do LivePix (separados por vírgula) | (vazio) |
| `MESSAGE_BUFFER_SIZE` | Tamanho do buffer de mensagens | `1000` |
| `MESSAGE_TTL_MS` | TTL das mensagens em ms | `3600000` (1h) |
| `PORT` | Porta do servidor | `3000` |
| `HOST` | Host do servidor | `0.0.0.0` |

### Persistência de Logs

Os logs são salvos em `./logs` no host machine. Para desabilitar:

```yaml
# Comente esta linha no docker-compose.yml
# - ./logs:/app/server/logs
```

---

## 📊 Monitoramento

### Health Check

O container possui health check automático:

```bash
# Ver status de saúde
docker inspect --format='{{.State.Health.Status}}' overlay-chat-overlay-chat-1
```

Estados possíveis:
- `starting`: Iniciando (primeiros 40s)
- `healthy`: Funcionando normalmente
- `unhealthy`: Com problemas (reiniciará automaticamente)

### Logs Estruturados

Os logs incluem informações do Puppeteer:

```
[AudioCapture] Starting Puppeteer browser...
[AudioCapture] Opening 1 LivePix page(s)...
[AudioCapture] Page loaded successfully
[AudioCapture] Audio detected [200]: https://...
[AudioCapture] Audio captured [200]: 61869 bytes
[AudioCapture] Broadcasting audio to clients
```

---

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs de erro
docker-compose logs

# Verificar se a porta 3000 está em uso
lsof -i :3000

# Tentar em outra porta
# Edite docker-compose.yml: "3001:3000"
```

### Puppeteer não funciona

```bash
# Rebuild forçando instalação de dependências
docker-compose build --no-cache
docker-compose up -d
```

### Áudio não captura

```bash
# Verificar se LIVEPIX_URLS está configurado
docker-compose exec overlay-chat env | grep LIVEPIX

# Ver logs do Puppeteer
docker-compose logs -f | grep "AudioCapture"
```

### Container consome muita memória

Ajuste os limites no `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Reduzir para 512MB
```

---

## 📦 Build Manual da Imagem

Se quiser fazer build sem docker-compose:

```bash
# Build
docker build -t overlay-chat:latest .

# Run
docker run -d \
  -p 3000:3000 \
  -e TWITCH_CHANNELS=sacy,aspas \
  -e LIVEPIX_URLS=https://url.livepix.gg \
  --name overlay-chat \
  overlay-chat:latest
```

---

## 🌐 Deploy em Produção

### Docker Hub

```bash
# Tag
docker tag overlay-chat:latest seu-usuario/overlay-chat:latest

# Push
docker push seu-usuario/overlay-chat:latest
```

### Deploy em servidor

```bash
# No servidor
git clone https://github.com/seu-usuario/overlay-chat.git
cd overlay-chat
cp .env.docker .env
nano .env  # Configure

docker-compose up -d
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name chat.seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔄 Atualização

```bash
# Pull últimas mudanças
git pull

# Rebuild e restart
docker-compose up -d --build
```

---

## 📝 Notas Importantes

1. **Puppeteer**: A imagem inclui todas as dependências do Chrome headless (~200MB extras)
2. **Memória**: Recomendado mínimo 512MB, ideal 1GB
3. **Persistência**: Logs são salvos em `./logs`, mensagens em memória (não persistem)
4. **Segurança**: Container roda com `no-new-privileges` para segurança

---

## 📞 Suporte

- **Logs**: `docker-compose logs -f`
- **Health**: `docker-compose ps`
- **Shell**: `docker-compose exec overlay-chat sh`

Para mais informações, consulte:
- [Documentação do Puppeteer](https://pptr.dev/)
- [Documentação do Docker](https://docs.docker.com/)
