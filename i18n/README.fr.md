<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**Un seul endpoint pour tous les fournisseurs d'IA.**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[Démarrage rapide](#démarrage-rapide) · [Fonctionnalités clés](#fonctionnalités-clés) · [Fournisseurs](#fournisseurs-pris-en-charge) · [Guide d'installation](#guide-dinstallation) · [Documentation](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](./README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router est une passerelle d'IA locale pour les outils de codage. Elle s'exécute sur votre propre machine et présente un unique endpoint compatible OpenAI — `http://localhost:667/v1` — devant chaque fournisseur que vous y connectez.

Configurez votre outil une seule fois. Dès lors, Bansur Router gère les connexions aux fournisseurs derrière cet endpoint : quel compte répond à une requête, comment le format de la requête est traduit, combien de quota il reste, et ce qui se passe quand un fournisseur refuse. Les abonnements que vous payez déjà sont utilisés en premier, les API moins chères prennent le relais quand ils s'épuisent, et les offres gratuites maintiennent la session active en bout de chaîne.

Le tableau de bord s'exécute à l'adresse `http://localhost:667/dashboard`, où vous connectez les fournisseurs, créez des combinaisons de modèles et suivez l'utilisation. Les clés restent sur votre machine, le trafic est routé localement, et la passerelle est distribuée sous forme de package npm et d'image Docker construits sur une application Next.js tournant sur Node.js.

- **Un endpoint, une clé** — chaque fournisseur connecté, accessible depuis chaque outil
- **Plus de 800 modèles** — listés en direct via `GET /v1/models`
- **Bascule à 3 niveaux** — Abonnement, puis Économique, puis Gratuit
- **Économie de tokens intégrée** — les sorties des outils sont compressées avant d'atteindre le modèle
- **Local d'abord** — vos clés et votre trafic restent sur votre machine

Version actuelle : v1.0.5. Nécessite Node.js 20.9 ou ultérieur.

---

## Pourquoi Bansur Router ?

| Problème | Ce que fait Bansur Router |
| --- | --- |
| Le quota d'abonnement expire inutilisé chaque mois | Suit le quota par compte et le dépense avant sa réinitialisation |
| Une limite de débit vous arrête au milieu d'une session de codage | Bascule automatiquement : Abonnement → Économique → Gratuit |
| Les sorties d'outils telles que `git diff`, `grep` et `ls` brûlent des tokens | Compresse les résultats des outils avec RTK, économisant 20–40% des tokens par requête |
| Chaque fournisseur veut $20–50 par mois | Route le travail vers les niveaux économiques et gratuits quand ils suffisent |
| Passer d'un fournisseur à l'autre à la main, séparément pour chaque outil | Donne à chaque outil un seul endpoint et une seule clé, avec une répartition round-robin entre plusieurs comptes derrière |

---

## Démarrage rapide

### 1. Installation et lancement

```bash
npm install -g bansur-router
bansur-router
```

Le tableau de bord s'ouvre à l'adresse `http://localhost:667`.

### 2. Connecter un fournisseur

Ouvrez **Tableau de bord → Fournisseurs → Connecter**.

Vous n'avez pas besoin d'un compte payant pour commencer. Connectez **Kiro AI** pour une offre gratuite d'environ 50 crédits par mois, qui inclut Claude 4.5, GLM-5 et MiniMax, ou connectez **OpenCode Free**, qui ne nécessite aucune authentification. Si vous avez déjà des abonnements ou des clés API, connectez-les à la place — ou en plus.

### 3. Pointer votre outil vers Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

C'est toute la configuration. L'outil atteint désormais chaque fournisseur connecté via l'unique endpoint, et Bansur Router décide où va chaque requête.

D'autres façons d'exécuter Bansur Router — Docker et la compilation depuis les sources — sont décrites dans le [Guide d'installation](#guide-dinstallation).

---

## Fonctionnement

Chaque requête arrive dans le format envoyé par votre outil, traverse la passerelle et repart dans le format attendu par le fournisseur sélectionné.

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

La bascule est automatique. Quand le niveau actif renvoie une erreur de quota ou une limite de débit, la requête descend dans la chaîne au lieu d'échouer dans votre éditeur.

---

## Fonctionnalités clés

| Fonctionnalité | Ce qu'elle fait |
| --- | --- |
| Économie de tokens RTK | Compresse les sorties des outils — `git diff`, `grep`, `ls` et résultats similaires — avant leur envoi au modèle, économisant 20–40% des tokens par requête |
| Économie de tokens Headroom | Applique une compression supplémentaire au contexte des requêtes, réduisant encore les tokens consommés par une longue session |
| Bascule intelligente à 3 niveaux | Route chaque requête Abonnement → Économique → Gratuit, changeant de niveau automatiquement en cas d'épuisement du quota ou de limite de débit |
| Suivi des quotas en temps réel | Affiche l'utilisation en direct et les échéances de réinitialisation par compte, afin que le quota d'abonnement soit dépensé avant son expiration plutôt qu'après |
| Traduction de formats | Traduit entre les formats de requête OpenAI, Claude et Gemini, de sorte qu'un outil conçu pour une API peut utiliser des fournisseurs conçus pour une autre |
| Prise en charge multi-comptes | Conserve plusieurs comptes par fournisseur et répartit les requêtes entre eux en round-robin |
| Rafraîchissement automatique des tokens | Rafraîchit automatiquement les tokens OAuth, afin que les fournisseurs connectés le restent sans reconnexions répétées |
| Combos personnalisés | Regroupe des modèles de différents fournisseurs et niveaux en combinaisons nommées que vous sélectionnez comme un seul modèle dans votre outil |
| Journalisation des requêtes | Enregistre les requêtes et les réponses à des fins d'inspection, ce qui rend les problèmes de routage et de fournisseurs visibles au lieu de silencieux |
| Synchronisation cloud | Synchronise votre configuration entre machines, afin qu'un second ordinateur parte des mêmes fournisseurs et combos |
| Analyse d'utilisation | Détaille l'utilisation des tokens au fil du temps par fournisseur, compte et modèle |
| Déploiement partout | S'exécute en local, dans Docker ou sur un VPS, avec le même tableau de bord et le même endpoint dans chaque cas |

---

## Outils CLI pris en charge

Tout outil qui accepte un endpoint personnalisé compatible OpenAI peut utiliser Bansur Router. Les outils ci-dessous sont pris en charge directement, et la plupart d'entre eux peuvent être configurés depuis la section CLI Tools du tableau de bord plutôt qu'en modifiant les fichiers de configuration à la main.

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

Pour chaque outil, la configuration repose sur les trois mêmes valeurs : l'endpoint `http://localhost:667/v1`, la clé API copiée depuis le tableau de bord, et le modèle ou combo que vous voulez affecter à cet outil.

---

## Fournisseurs pris en charge

Les fournisseurs connectés exposent plus de 800 modèles via un seul endpoint. Appelez `GET /v1/models` sur une instance en cours d'exécution pour obtenir la liste exacte disponible pour vos connexions.

### Fournisseurs OAuth

Connectez-vous depuis le tableau de bord. Bansur Router stocke la session, rafraîchit ses tokens automatiquement et suit son quota.

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### Fournisseurs gratuits

Aucun paiement n'est requis pour utiliser ces offres, ce qui en fait le moyen le plus rapide d'obtenir une première requête fonctionnelle.

| Fournisseur | Ce que l'offre gratuite vous apporte |
| --- | --- |
| Kiro AI | Environ 50 crédits par mois gratuits, incluant Claude 4.5, GLM-5 et MiniMax |
| OpenCode Free | Accès sans aucune authentification |
| Vertex AI | $300 de crédits pour les nouveaux comptes Google Cloud |

### Fournisseurs par clé API

Plus de 40 fournisseurs se connectent avec une clé API, y compris des services de type OpenAI et Anthropic et un large éventail d'hébergeurs de modèles. Les options à bas coût les plus souvent utilisées comme deuxième niveau sont :

| Fournisseur | Prix |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### Fournisseurs auto-hébergés

Tout endpoint qui parle le format compatible OpenAI peut être connecté comme fournisseur, de sorte que les modèles que vous servez vous-même siègent dans la même chaîne de routage — et les mêmes combos — que les fournisseurs hébergés.

---

## Référence de l'API

Bansur Router expose une API compatible OpenAI sur son endpoint local. Authentifiez-vous avec la clé API affichée dans le tableau de bord.

### Lister les modèles

```text
GET /v1/models
```

Renvoie chaque modèle disponible chez vos fournisseurs connectés — plus de 800 modèles une fois les fournisseurs courants connectés.

### Créer une complétion de chat

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

La forme de la requête et de la réponse suit le format des complétions de chat d'OpenAI. Bansur Router les traduit dans le format natif du fournisseur que la chaîne de routage sélectionne.

URL clés d'une installation par défaut :

- Tableau de bord : `http://localhost:667/dashboard`
- Base de l'API : `http://localhost:667/v1`

---

## Guide d'installation

### Exécuter avec Docker

Depuis un clone de ce dépôt :

```bash
docker compose up -d
```

Les images publiées sont disponibles sous le nom `bansur/router` sur Docker Hub et `ghcr.io/mas-ajam/bansur-router` sur le GitHub Container Registry. Le tableau de bord et l'API sont servis sur le port 667, comme pour une installation locale.

### Exécuter depuis les sources

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### Connecter un fournisseur

1. Démarrez Bansur Router et ouvrez `http://localhost:667/dashboard`.
2. Allez dans **Fournisseurs** et choisissez **Connecter** sur le fournisseur souhaité.
3. Pour les fournisseurs OAuth, terminez la connexion dans la fenêtre qui s'ouvre. Pour les fournisseurs par clé API, collez la clé émise par ce fournisseur.
4. Envoyez une requête. Le quota et l'utilisation du fournisseur apparaissent dans le tableau de bord à mesure que les requêtes sont routées.

Commencez par un fournisseur gratuit si vous voulez seulement vérifier l'installation : Kiro AI et OpenCode Free fonctionnent tous deux sans offre payante.

### Créer un combo

Un combo est une liste ordonnée de modèles traitée comme un seul modèle sélectionnable. Placez votre modèle d'abonnement en premier, un modèle économique en second et un modèle gratuit en dernier, puis sélectionnez le combo dans votre outil. Quand le premier modèle est indisponible — quota épuisé, limite de débit atteinte ou en erreur — la requête passe automatiquement à l'entrée suivante.

### Changer le port

Le port 667 est la valeur par défaut, pas une obligation.

```bash
bansur-router --port 8080
```

La forme courte `-p` fonctionne également, et la variable d'environnement `PORT` définit le port pour les déploiements depuis les sources, Docker et serveur. Si vous changez le port, mettez à jour l'endpoint dans vos outils en conséquence, par exemple `http://localhost:8080/v1`. Séparer le port est aussi le moyen le plus simple d'exécuter Bansur Router à côté d'un autre service local qui occupe déjà le 667.

---

## Questions fréquentes

### Qu'est-ce que Bansur Router ?

Une passerelle d'IA locale pour les outils de codage. Elle place un unique endpoint compatible OpenAI devant tous vos fournisseurs d'IA et route chaque requête vers le meilleur disponible, de sorte que vos outils gardent une seule configuration pendant que les fournisseurs, les comptes et les quotas changent derrière.

### Est-ce gratuit ?

Oui. Bansur Router lui-même est gratuit et open source sous licence MIT. Le coût d'une requête dépend du fournisseur vers lequel elle est routée : les offres gratuites comme Kiro AI et OpenCode Free ne coûtent rien, et pour le reste vous apportez vos propres abonnements et clés API et payez ces fournisseurs directement, exactement comme vous le feriez sans la passerelle.

### Où vivent mes données ?

Sur votre machine. Bansur Router est local d'abord : les clés des fournisseurs sont stockées localement, les requêtes sont routées depuis votre propre installation, et le travail de la passerelle consiste à les transmettre au fournisseur que vous avez sélectionné. Il n'y a aucun compte séparé à créer avant la première requête.

### Quel port utilise-t-il ?

667 par défaut, pour le tableau de bord comme pour l'API. Changez-le avec `--port` (ou `-p`) au démarrage de la CLI, ou avec la variable d'environnement `PORT`.

### Avec quels outils fonctionne-t-il ?

Claude Code, OpenAI Codex, Cursor, Cline, OpenCode, Antigravity, GitHub Copilot, OpenClaw, Continue et RooCode sont pris en charge directement. Tout autre outil qui vous permet de définir un endpoint personnalisé compatible OpenAI et une clé API peut l'utiliser avec les trois mêmes valeurs.

### Remarque pour les utilisateurs Windows

Arrêtez l'instance de Bansur Router en cours d'exécution avant de mettre à jour le package npm global. Windows verrouille les fichiers d'une installation en cours d'exécution, donc une mise à jour tentée pendant que la passerelle tourne échouera tant que le processus n'est pas arrêté.

---

## Dépannage

### Le port est déjà utilisé

Quelque chose sur votre machine écoute déjà sur le 667, souvent un processus Bansur Router antérieur toujours en cours d'exécution. Arrêtez ce processus, ou démarrez sur un autre port et dirigez vos outils vers lui :

```bash
bansur-router --port 8080
```

### Un fournisseur ne parvient pas à se connecter

Reconnectez-le depuis le tableau de bord : **Fournisseurs → Connecter** pour ce fournisseur, et terminez à nouveau la connexion ou la saisie de la clé. Une nouvelle connexion remplace la session stockée, et le rafraîchissement automatique des tokens la garde valide à partir de là.

### La mise à jour échoue sous Windows

Arrêtez d'abord l'instance en cours d'exécution, puis relancez la mise à jour. Une installation en cours d'exécution verrouille ses propres fichiers programme sous Windows, ce qui empêche le remplacement du package npm global.

### Les requêtes échouent après le changement de port

Votre outil pointe toujours vers l'ancienne adresse. Mettez à jour son endpoint avec le nouveau port — par exemple `http://localhost:8080/v1` — et vérifiez que la clé API est bien celle affichée dans le tableau de bord de l'instance maintenant en cours d'exécution.

---

## Assistance

Signalez les bugs et demandez des fonctionnalités via [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) sur le dépôt `mas-ajam/bansur-router`. Indiquez la version que vous exécutez, la façon dont Bansur Router a été démarré (npm, Docker ou sources), ainsi que le journal de requête pertinent lorsqu'un problème de routage est en cause.

La documentation complète se trouve sur [bansur-router.pages.dev](https://bansur-router.pages.dev).

---

## Licence

Bansur Router est publié sous la [licence MIT](../LICENSE).
