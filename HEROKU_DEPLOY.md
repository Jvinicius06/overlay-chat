# Deploy no Heroku

## Pré-requisitos

1. Conta no Heroku: https://www.heroku.com/
2. Heroku CLI instalado: https://devcenter.heroku.com/articles/heroku-cli

## Passos para Deploy

### 1. Fazer login no Heroku

```bash
heroku login
```

### 2. Criar aplicação no Heroku

```bash
# Na raiz do projeto
heroku create overlay-chat-app

# Ou se quiser um nome específico:
heroku create seu-nome-aqui
```

### 3. Configurar variáveis de ambiente

```bash
# Configurar os canais do Twitch que deseja monitorar
heroku config:set TWITCH_CHANNELS=canal1,canal2,canal3

# Configurar ambiente de produção
heroku config:set NODE_ENV=production

# (Opcional) Configurar outras variáveis se necessário
heroku config:set MAX_BUFFER_SIZE=1000
heroku config:set MESSAGE_TTL_MS=600000
```

### 4. Deploy da aplicação

```bash
# Adicionar remote do Heroku (se não foi feito automaticamente)
heroku git:remote -a overlay-chat-app

# Fazer commit de suas alterações
git add .
git commit -m "Preparar para deploy no Heroku"

# Push para o Heroku
git push heroku main
```

Se sua branch principal for `master` ao invés de `main`:
```bash
git push heroku master
```

### 5. Verificar o deploy

```bash
# Ver logs
heroku logs --tail

# Abrir a aplicação no navegador
heroku open
```

## Estrutura de URLs após deploy

Assumindo que sua aplicação foi criada com o nome `overlay-chat-app`:

- **Overlay**: https://overlay-chat-app.herokuapp.com/
- **API de SSE**: https://overlay-chat-app.herokuapp.com/api/chat/stream
- **Health Check**: https://overlay-chat-app.herokuapp.com/api/health
- **Status**: https://overlay-chat-app.herokuapp.com/api/status

## Comandos úteis

```bash
# Ver logs em tempo real
heroku logs --tail

# Ver configurações
heroku config

# Reiniciar aplicação
heroku restart

# Abrir console no Heroku
heroku run bash

# Ver informações da aplicação
heroku info
```

## Verificar se está funcionando

Após o deploy, você pode testar:

1. Abrir a URL da aplicação no navegador
2. Verificar se o overlay está carregando
3. Testar a conexão SSE: https://sua-app.herokuapp.com/api/chat/stream

## Solução de problemas

### Aplicação não inicia

```bash
# Verificar logs
heroku logs --tail
```

### Variáveis de ambiente não configuradas

```bash
# Listar variáveis configuradas
heroku config

# Adicionar variável que falta
heroku config:set NOME_VARIAVEL=valor
```

### Build falhou

```bash
# Ver logs do build
heroku logs --tail

# Tentar fazer push novamente
git push heroku main --force
```

### Erro "Cannot find package 'fastify'"

Se você receber o erro `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'fastify'`, isso significa que as dependências não foram instaladas corretamente. Isso pode acontecer por alguns motivos:

**Solução 1: Verificar se o heroku-postbuild foi executado**
```bash
# Verificar logs do build
heroku logs --tail

# Procurar por linhas como:
# "Running heroku-postbuild"
# "cd server && npm install"
```

**Solução 2: Forçar rebuild**
```bash
# Limpar cache do Heroku
heroku repo:purge_cache -a sua-app

# Fazer push novamente
git commit --allow-empty -m "Rebuild"
git push heroku main
```

**Solução 3: Verificar arquivos**
Certifique-se de que os seguintes arquivos estão commitados no git:
- `package.json` (raiz)
- `Procfile` (raiz)
- `server/package.json`
- `client/package.json`

```bash
git status
git add .
git commit -m "Add missing files"
git push heroku main
```

## Como funciona o build no Heroku

O processo de deploy no Heroku segue esta ordem:

1. **npm install** (na raiz): Instala dependências do package.json raiz (se houver)
2. **heroku-postbuild**: Script customizado que:
   - Instala dependências do servidor (`cd server && npm install`)
   - Instala dependências do client (`cd client && npm install`)
   - Faz build do client (`npm run build` - gera arquivos em `server/public/`)
3. **npm start**: Inicia o servidor

## Notas importantes

1. **Porta**: O Heroku define automaticamente a porta através da variável de ambiente `PORT`. O código já está configurado para usar essa variável.

2. **Canais do Twitch**: Não esqueça de configurar a variável `TWITCH_CHANNELS` com os canais que deseja monitorar.

3. **LivePix URLs** (se necessário): Configure a variável `LIVEPIX_URLS` se estiver usando integração com LivePix.

4. **Dyno gratuito**: O Heroku oferece dynos gratuitos que "dormem" após 30 minutos de inatividade. Para aplicações em produção, considere usar um dyno pago.

5. **HTTPS**: O Heroku fornece HTTPS automaticamente para todas as aplicações.

6. **Build process**: O script `heroku-postbuild` garante que todas as dependências sejam instaladas corretamente antes de iniciar o servidor.

## Atualizar aplicação

Sempre que fizer mudanças no código:

```bash
git add .
git commit -m "Descrição das mudanças"
git push heroku main
```

O Heroku irá automaticamente:
1. Instalar dependências
2. Fazer build do client
3. Reiniciar a aplicação
