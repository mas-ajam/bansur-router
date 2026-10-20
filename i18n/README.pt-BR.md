<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**Um único endpoint para todos os provedores de IA.**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[Início rápido](#início-rápido) · [Principais recursos](#principais-recursos) · [Provedores](#provedores-compatíveis) · [Guia de configuração](#guia-de-configuração) · [Documentação](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](./README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router é um gateway de IA local para ferramentas de programação. Ele roda na sua própria máquina e apresenta um único endpoint compatível com OpenAI — `http://localhost:667/v1` — à frente de todos os provedores que você conectar a ele.

Configure sua ferramenta uma única vez. A partir daí, o Bansur Router cuida das conexões com os provedores por trás desse endpoint: qual conta responde a uma requisição, como o formato da requisição é traduzido, quanta cota resta e o que acontece quando um provedor diz não. As assinaturas que você já paga são usadas primeiro, as APIs mais baratas assumem quando elas acabam, e os planos gratuitos mantêm a sessão ativa no fim da cadeia.

O painel roda em `http://localhost:667/dashboard`, onde você conecta provedores, monta combinações de modelos e acompanha o uso. As chaves ficam na sua máquina, o tráfego é roteado localmente, e o gateway é distribuído como um pacote npm e uma imagem Docker construídos sobre um aplicativo Next.js executado no Node.js.

- **Um endpoint, uma chave** — todos os provedores conectados, acessíveis de qualquer ferramenta
- **Mais de 800 modelos** — listados ao vivo via `GET /v1/models`
- **Fallback em 3 níveis** — Assinatura, depois Econômico, depois Gratuito
- **Economia de tokens integrada** — as saídas das ferramentas são compactadas antes de chegar ao modelo
- **Local primeiro** — suas chaves e seu tráfego ficam na sua máquina

Versão atual: v1.0.5. Requer Node.js 20.9 ou posterior.

---

## Por que Bansur Router?

| Problema | O que o Bansur Router faz |
| --- | --- |
| A cota da assinatura expira sem uso todo mês | Acompanha a cota por conta e a gasta antes da renovação |
| Um limite de requisições interrompe você no meio de uma sessão de programação | Faz fallback automaticamente: Assinatura → Econômico → Gratuito |
| Saídas de ferramentas como `git diff`, `grep` e `ls` queimam tokens | Compacta os resultados das ferramentas com RTK, economizando 20–40% dos tokens por requisição |
| Todo provedor quer $20–50 por mês | Roteia o trabalho para os níveis econômicos e gratuitos quando eles são bons o suficiente |
| Trocar de provedor manualmente, separadamente para cada ferramenta | Dá a cada ferramenta um único endpoint e uma única chave, com round-robin entre várias contas por trás |

---

## Início rápido

### 1. Instale e execute

```bash
npm install -g bansur-router
bansur-router
```

O painel abre em `http://localhost:667`.

### 2. Conecte um provedor

Abra **Painel → Provedores → Conectar**.

Você não precisa de uma conta paga para começar. Conecte o **Kiro AI** para um plano gratuito de cerca de 50 créditos por mês, que inclui Claude 4.5, GLM-5 e MiniMax, ou conecte o **OpenCode Free**, que não exige autenticação alguma. Se você já tem assinaturas ou chaves de API, conecte-as no lugar — ou também.

### 3. Aponte sua ferramenta para o Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

Essa é toda a configuração. A ferramenta agora alcança todos os provedores conectados por meio do único endpoint, e o Bansur Router decide para onde vai cada requisição.

Outras formas de executar o Bansur Router — Docker e a compilação a partir do código-fonte — são abordadas no [Guia de configuração](#guia-de-configuração).

---

## Como funciona

Cada requisição chega no formato que sua ferramenta envia, passa pelo gateway e sai no formato que o provedor selecionado espera.

```text
Your CLI tool
  Claude Code, Codex, Cursor, Cline, ...
        |
        |  http://localhost:667/v1
        v
Bansur Router
  - RTK token saver (compress tool results)
  - Format translation (OpenAI <-> Claude <-> Gemini)
  - Quota tracking per account
  - Automatic OAuth token refresh
        |
        +--> Tier 1: SUBSCRIPTION
        |    Claude Code, Codex, GitHub Copilot
        |    (used first, while quota lasts)
        |
        +--> Tier 2: CHEAP
        |    GLM ($0.6 / 1M tokens), MiniMax ($0.20 / 1M tokens)
        |    (takes over when subscription quota runs out)
        |
        +--> Tier 3: FREE
             Kiro, OpenCode Free, Vertex AI ($300 credits
             for new Google Cloud accounts)
             (keeps the session running at no cost)
```

O fallback é automático. Quando o nível ativo retorna um erro de cota ou um limite de requisições, a requisição desce pela cadeia em vez de falhar no seu editor.

---

## Principais recursos

| Recurso | O que faz |
| --- | --- |
| Economia de tokens RTK | Compacta as saídas das ferramentas — `git diff`, `grep`, `ls` e resultados semelhantes — antes de serem enviadas ao modelo, economizando 20–40% dos tokens por requisição |
| Economia de tokens Headroom | Aplica compactação adicional ao contexto das requisições, reduzindo ainda mais os tokens que uma sessão longa consome |
| Fallback inteligente em 3 níveis | Roteia cada requisição Assinatura → Econômico → Gratuito, trocando de nível automaticamente em caso de esgotamento da cota ou limites de requisições |
| Acompanhamento de cota em tempo real | Mostra o uso ao vivo e o momento da renovação por conta, para que a cota da assinatura seja gasta antes de expirar, e não depois |
| Tradução de formatos | Traduz entre os formatos de requisição OpenAI, Claude e Gemini, para que uma ferramenta feita para uma API possa usar provedores feitos para outra |
| Suporte a várias contas | Mantém várias contas por provedor e distribui as requisições entre elas com roteamento round-robin |
| Atualização automática de tokens | Atualiza os tokens OAuth automaticamente, para que os provedores conectados permaneçam conectados sem logins repetidos |
| Combos personalizados | Agrupa modelos de diferentes provedores e níveis em combinações nomeadas que você seleciona como um único modelo na sua ferramenta |
| Registro de requisições | Registra requisições e respostas para inspeção, o que torna os problemas de roteamento e de provedores visíveis em vez de silenciosos |
| Sincronização na nuvem | Sincroniza sua configuração entre máquinas, para que um segundo computador comece com os mesmos provedores e combos |
| Análise de uso | Detalha o uso de tokens ao longo do tempo por provedor, conta e modelo |
| Implante em qualquer lugar | Roda localmente, no Docker ou em um VPS, com o mesmo painel e endpoint em todos os casos |

---

## Ferramentas CLI compatíveis

Qualquer ferramenta que aceite um endpoint personalizado compatível com OpenAI pode usar o Bansur Router. As ferramentas abaixo são atendidas diretamente, e a maioria delas pode ser configurada na seção CLI Tools do painel, em vez de editar arquivos de configuração manualmente.

- Claude Code
- OpenAI Codex
- Cursor
- Cline
- OpenCode
- Antigravity
- GitHub Copilot
- OpenClaw
- Continue
- RooCode

Para cada ferramenta, a configuração são os mesmos três valores: o endpoint `http://localhost:667/v1`, a chave de API copiada do painel e o modelo ou combo que você quer que essa ferramenta use.

---

## Provedores compatíveis

Os provedores conectados expõem mais de 800 modelos por meio de um único endpoint. Chame `GET /v1/models` em uma instância em execução para ver a lista exata disponível para as suas conexões.

### Provedores OAuth

Conecte-se fazendo login a partir do painel. O Bansur Router armazena a sessão, atualiza seus tokens automaticamente e acompanha sua cota.

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### Provedores gratuitos

Nenhum pagamento é necessário para usar esses planos, o que os torna a forma mais rápida de obter uma primeira requisição funcionando.

| Provedor | O que o plano gratuito oferece |
| --- | --- |
| Kiro AI | Cerca de 50 créditos por mês grátis, incluindo Claude 4.5, GLM-5 e MiniMax |
| OpenCode Free | Acesso sem autenticação |
| Vertex AI | $300 em créditos para contas novas do Google Cloud |

### Provedores por chave de API

Mais de 40 provedores se conectam com uma chave de API, incluindo serviços nos estilos OpenAI e Anthropic e uma ampla variedade de hospedagens de modelos. As opções de baixo custo mais usadas como segundo nível são:

| Provedor | Preço |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### Provedores auto-hospedados

Qualquer endpoint que fale o formato compatível com OpenAI pode ser conectado como provedor, para que os modelos que você mesmo serve fiquem na mesma cadeia de roteamento — e nos mesmos combos — que os provedores hospedados.

---

## Referência da API

O Bansur Router expõe uma API compatível com OpenAI em seu endpoint local. Autentique-se com a chave de API exibida no painel.

### Listar modelos

```text
GET /v1/models
```

Retorna todos os modelos disponíveis nos seus provedores conectados — mais de 800 modelos depois que os provedores comuns estão conectados.

### Criar uma conclusão de chat

```text
POST /v1/chat/completions
Authorization: Bearer <dashboard API key>
```

```bash
curl http://localhost:667/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [
      { "role": "user", "content": "Explain what this function does." }
    ]
  }'
```

Os formatos da requisição e da resposta seguem o formato de conclusões de chat da OpenAI. O Bansur Router os traduz para o formato nativo do provedor que a cadeia de roteamento selecionar.

URLs principais em uma instalação padrão:

- Painel: `http://localhost:667/dashboard`
- Base da API: `http://localhost:667/v1`

---

## Guia de configuração

### Executar com Docker

A partir de um checkout deste repositório:

```bash
docker compose up -d
```

As imagens publicadas estão disponíveis como `bansur/router` no Docker Hub e como `ghcr.io/mas-ajam/bansur-router` no GitHub Container Registry. O painel e a API são servidos na porta 667, igual a uma instalação local.

### Executar a partir do código-fonte

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### Conecte um provedor

1. Inicie o Bansur Router e abra `http://localhost:667/dashboard`.
2. Vá para **Provedores** e escolha **Conectar** no provedor desejado.
3. Para provedores OAuth, conclua o login na janela que se abre. Para provedores por chave de API, cole a chave emitida por esse provedor.
4. Envie uma requisição. A cota e o uso do provedor aparecem no painel conforme as requisições são roteadas.

Comece com um provedor gratuito se você só quer verificar a configuração: o Kiro AI e o OpenCode Free funcionam sem um plano pago.

### Criar um combo

Um combo é uma lista ordenada de modelos tratada como um único modelo selecionável. Coloque primeiro o seu modelo de assinatura, depois um modelo econômico e por último um modelo gratuito, e então selecione o combo na sua ferramenta. Quando o primeiro modelo está indisponível — cota esgotada, limite de requisições atingido ou em erro — a requisição passa automaticamente para a próxima entrada.

### Alterar a porta

A porta 667 é o padrão, não um requisito.

```bash
bansur-router --port 8080
```

A forma curta `-p` também funciona, e a variável de ambiente `PORT` define a porta para implantações a partir do código-fonte, Docker e servidor. Se você alterar a porta, atualize o endpoint nas suas ferramentas para corresponder, por exemplo `http://localhost:8080/v1`. Separar a porta também é a forma mais simples de executar o Bansur Router ao lado de outro serviço local que já ocupe a 667.

---

## Perguntas frequentes

### O que é o Bansur Router?

Um gateway de IA local para ferramentas de programação. Ele coloca um único endpoint compatível com OpenAI à frente de todos os seus provedores de IA e roteia cada requisição para o melhor disponível, para que suas ferramentas mantenham uma única configuração enquanto provedores, contas e cotas mudam por trás.

### É gratuito?

Sim. O Bansur Router em si é gratuito e de código aberto sob a licença MIT. O custo de uma requisição depende do provedor para o qual ela é roteada: planos gratuitos como Kiro AI e OpenCode Free não custam nada, e para o restante você traz suas próprias assinaturas e chaves de API e paga esses provedores diretamente, exatamente como faria sem o gateway.

### Onde ficam os meus dados?

Na sua máquina. O Bansur Router é local primeiro: as chaves dos provedores são armazenadas localmente, as requisições são roteadas a partir da sua própria instalação, e o trabalho do gateway é encaminhá-las ao provedor que você selecionou. Não há nenhuma conta separada para criar antes da primeira requisição.

### Qual porta ele usa?

A 667 por padrão, tanto para o painel quanto para a API. Altere com `--port` (ou `-p`) ao iniciar a CLI, ou com a variável de ambiente `PORT`.

### Com quais ferramentas ele funciona?

Claude Code, OpenAI Codex, Cursor, Cline, OpenCode, Antigravity, GitHub Copilot, OpenClaw, Continue e RooCode são atendidos diretamente. Qualquer outra ferramenta que permita definir um endpoint personalizado compatível com OpenAI e uma chave de API pode usá-lo com os mesmos três valores.

### Uma observação para usuários do Windows

Pare a instância do Bansur Router em execução antes de atualizar o pacote npm global. O Windows bloqueia os arquivos de uma instalação em execução, então uma atualização tentada enquanto o gateway ainda está rodando falhará até que o processo seja encerrado.

---

## Solução de problemas

### A porta já está em uso

Algo na sua máquina já está ouvindo na 667, geralmente um processo anterior do Bansur Router que ainda está em execução. Encerre esse processo, ou inicie em uma porta diferente e aponte suas ferramentas para ela:

```bash
bansur-router --port 8080
```

### Um provedor não conecta

Reconecte-o a partir do painel: **Provedores → Conectar** para esse provedor, e conclua o login ou a inserção da chave novamente. Uma conexão nova substitui a sessão armazenada, e a atualização automática de tokens a mantém válida a partir daí.

### A atualização falha no Windows

Pare primeiro a instância em execução e depois execute a atualização novamente. Uma instalação em execução bloqueia seus próprios arquivos de programa no Windows, o que impede a substituição do pacote npm global.

### As requisições falham após alterar a porta

Sua ferramenta ainda está apontando para o endereço antigo. Atualize o endpoint dela para a nova porta — por exemplo `http://localhost:8080/v1` — e confirme que a chave de API é a exibida no painel da instância que está rodando agora.

---

## Suporte

Relate bugs e solicite recursos por meio do [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) no repositório `mas-ajam/bansur-router`. Inclua a versão que você está executando, como o Bansur Router foi iniciado (npm, Docker ou código-fonte) e o registro da requisição relevante quando houver um problema de roteamento envolvido.

A documentação completa está em [bansur-router.pages.dev](https://bansur-router.pages.dev).

---

## Licença

O Bansur Router é publicado sob a [Licença MIT](../LICENSE).
