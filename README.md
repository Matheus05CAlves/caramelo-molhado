# Caramelo Molhado Pet Shop Inc. — v2.0

Sistema de gestão do pet shop em **quatro peças que usam o mesmo banco de dados**:

| Peça | Para quem | Onde roda | Pasta |
|---|---|---|---|
| **App desktop** | Recepção / administração | Windows (instalador .exe) | `electron/` + `src/` |
| **App da equipe (APK)** | Funcionários | Android | `src/` (modo celular) + `mobile/empresa/` |
| **App do cliente (APK)** | Tutores dos pets | Android (e navegador, para iPhone) | `cliente/` + `mobile/cliente/` |
| **Servidor** | Guarda o banco e atende os celulares | Embutido no app desktop, ou standalone/nuvem | `server/` |

```
 Celular da equipe ─┐                         ┌─ App do cliente (APK)
                    ├──► Servidor  ◄──────────┤
 App desktop (PC) ──┘   (SQLite)              └─ Navegador (http://servidor:3737)
```

## O que há de novo na v2
- **Banco v2** (migração automática a partir da v1, sem perder dados): contas de clientes, sessões dos apps,
  caixa de avisos do cliente, gatilhos que avisam o cliente quando o status/horário muda. Detalhes em
  [`docs/BANCO-DE-DADOS.md`](docs/BANCO-DE-DADOS.md).
- **App do cliente**: cadastro (aberto ou por código da loja), pets com foto e carteira de vacinação,
  catálogo de serviços e preços, **agendamento com horários livres reais** (respeita funcionamento, bloqueios
  e capacidade), acompanhamento do atendimento, cancelamento, adoção, avisos e perfil com busca por CEP.
- **App da equipe no celular**: a mesma interface do desktop, responsiva, falando com o servidor.
- **Novas telas na empresa**: *Pedidos pelo App* (confirmar / remarcar / recusar), cartão *App do cliente* na
  ficha (gera código de acesso e envia por WhatsApp; bloqueia acesso), aba *Configurações → App do cliente e
  celulares* (regras de agendamento e endereço do servidor), serviços com descrição e opção "aparece no app".

## Primeiro acesso
| Onde | Usuário | Senha |
|---|---|---|
| Equipe (desktop e APK) | `admin` | `admin123` (troca obrigatória no 1º login) |
| Equipe demo | `maria` / `joao` | `maria123` / `joao123` |
| App do cliente demo | `carlos.lima@email.demo` | `Cliente@123` |

Os dados de exemplo saem em **Configurações → Dados, backup e exportação**.

## Como colocar para funcionar (na loja)
1. Instale o app desktop no PC da loja (`npm run dist` gera o instalador). Ele já liga o servidor na porta **3737**.
   Na primeira vez o Windows pergunta sobre o firewall: marque **Redes privadas** e permita.
2. Em **Configurações → App do cliente e celulares** aparece o endereço, ex. `http://192.168.0.10:3737`.
3. Instale os APKs nos celulares. Na primeira abertura, digite esse endereço.
   - Na mesma rede Wi-Fi da loja funciona direto.
   - Para clientes usarem de casa (4G), siga [`docs/ACESSO-PELA-INTERNET.md`](docs/ACESSO-PELA-INTERNET.md).
4. Quem tem iPhone pode usar o app do cliente pelo navegador: é o mesmo endereço do servidor.

## Gerar os APKs
Veja [`docs/GERAR-APK.md`](docs/GERAR-APK.md). Resumo: envie o projeto para o GitHub e rode o workflow
**APKs Android** (`.github/workflows/android.yml`) — ele devolve `caramelo-empresa.apk` e `caramelo-cliente.apk`.
Ou, com Android Studio instalado: `npm run apk:empresa` e `npm run apk:cliente`.

## Comandos
```
npm install
npm run dev               # desktop com recarga automática
npm run dev:cliente       # app do cliente no navegador (http://localhost:5174)
npm run server            # servidor standalone (dados em ./data)
npm run build:all         # compila desktop, equipe-celular e cliente
npm run dist              # instalador Windows
npm run android:sync      # compila e copia as interfaces para os projetos Android
npm run android:assets    # regera ícones e telas de abertura dos APKs
```

## Estrutura
- `server/` — banco (`db.js`, com migrações), regras (`core.js`), agenda (`schedule.js`), HTTP (`http.js`), entrada standalone (`index.js`).
- `electron/` — janela do desktop; usa o `server/core.js` por IPC e liga o servidor HTTP embutido.
- `src/` — interface da empresa. `src/lib/bridge.ts` faz a mesma interface funcionar no desktop (IPC) e no celular (HTTP).
- `cliente/` — interface do app do cliente.
- `mobile/empresa`, `mobile/cliente` — projetos Android (Capacitor 8).
- `Dockerfile` — servidor para nuvem.

## Segurança
- Senhas com scrypt + salt; bloqueio de 60 s após 5 tentativas erradas (equipe e clientes).
- Tokens dos apps guardados só como hash SHA-256; expiram após 60 dias sem uso; caem ao bloquear o cliente ou trocar a senha.
- O cliente só enxerga os próprios dados (todas as consultas filtram pelo dono da sessão).
- A interface da equipe não consegue ler colunas de senha/token nem alterar tabelas de contas e sessões.
- Na rede local o tráfego é HTTP. Para expor na internet use HTTPS (túnel ou proxy) — ver o guia.
