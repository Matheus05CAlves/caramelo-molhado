# Banco de dados (SQLite, versão 2)

Arquivo único `caramelo-molhado.sqlite`:
- desktop: `%APPDATA%\CarameloMolhadoPetShop\`
- servidor standalone: `./data/` (ou `DATA_DIR`)

A versão fica em `PRAGMA user_version`. Ao abrir um banco v1, `server/db.js` aplica a migração 2 numa transação
(se falhar, nada é alterado). Backups antigos restaurados também são migrados na hora.

## Tabelas

### Já existentes (v1)
| Tabela | Conteúdo |
|---|---|
| `users` | Equipe: login, hash da senha, papel (`admin`/`employee`), permissões (JSON) |
| `clients` | Tutores: contato, CPF, endereço, coordenadas do mapa, preferências |
| `pets` | Pets do tutor (`client_id`), saúde, temperamento, foto |
| `vaccines`, `weights` | Carteira de vacinação e histórico de peso |
| `services` | Catálogo: categoria, duração, preço |
| `appointments` | Agenda: pet, serviço, funcionário, data/hora, status, busca/entrega |
| `schedule_exceptions` | Bloqueios e horários extras |
| `adoption_animals`, `adoption_interested` | Adoção |
| `notifications` | Avisos internos da equipe |
| `audit_log` | Quem fez o quê |
| `settings` | Chave/valor (horários, capacidade, regras do app…) |

### Novas na v2
| Tabela | Campos principais | Para quê |
|---|---|---|
| `client_accounts` | `client_id` (único → `clients`), `email` (único), `password_hash`, `salt`, `active`, `last_login` | Login do cliente no app. Apagar o cliente apaga a conta (cascata). |
| `api_sessions` | `token_hash` (único), `kind` (`staff`/`client`), `subject_id`, `device`, `last_seen` | Sessões dos apps. O token em si nunca é gravado. |
| `client_notifications` | `client_id`, `type`, `title`, `body`, `appointment_id`, `read` | Caixa de avisos do cliente. |

### Colunas novas
| Tabela | Coluna | Uso |
|---|---|---|
| `services` | `description`, `client_visible` | Texto mostrado no app; ocultar serviços só da equipe |
| `appointments` | `origin` (`loja`/`app`), `cancel_reason` | Pedido veio do app? Motivo do cancelamento/recusa |
| `clients` | `origin`, `app_invite_code`, `app_invite_expires` | Cadastro pelo app; código de acesso (7 dias) |
| `adoption_interested` | `client_id`, `origin` | Interesse feito pelo app |

### Gatilhos (triggers)
Só disparam para clientes com conta ativa no app:
- `trg_client_appt_status` — status do agendamento mudou → aviso ("Thor: Confirmado", "pronto para retirada"…).
  Não avisa o próprio cliente quando foi ele quem cancelou.
- `trg_client_appt_moved` — data/hora mudou → "agendamento remarcado".
- `trg_client_appt_new` — a loja criou um agendamento → "Novo agendamento para Thor".

Como a regra está no banco, funciona qualquer que seja a tela (desktop, celular, agenda, lista).

### Configurações novas (`settings`)
| Chave | Padrão | Significado |
|---|---|---|
| `client_booking_enabled` | `1` | Clientes podem agendar pelo app |
| `client_signup_open` | `1` | Cadastro sem código permitido |
| `client_min_notice_hours` | `2` | Antecedência mínima para agendar |
| `client_max_days_ahead` | `30` | Até quantos dias à frente |
| `client_cancel_hours` | `2` | Cancelar pelo app até X horas antes |
| `client_welcome` | texto | Mensagem na tela de entrada |
| `server_enabled`, `server_port` | `1`, `3737` | Servidor embutido no desktop |

### Índices novos
`idx_appt_client`, `idx_pets_client`, `idx_vaccines_pet`, `idx_cnotif_client`, `idx_sessions_subject`, `idx_clients_invite`.

## API do app do cliente (`POST /api/cliente/<ação>`)
`loja`, `cadastro`, `login`, `logout`, `me`, `perfil:salvar`, `senha:alterar`, `cep`, `pets`, `pet:detalhe`,
`pet:salvar`, `dias`, `horarios`, `agendar`, `agendamentos`, `agendamento:cancelar`, `adocao`,
`adocao:interesse`, `avisos`, `avisos:lidos`. Autenticação: `Authorization: Bearer <token>`.

O app da equipe usa `POST /api/rpc/<canal>` com `{ "args": [...] }` — os mesmos canais do desktop.
