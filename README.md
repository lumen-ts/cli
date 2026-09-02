# @lumen/cli

CLI oficial do framework Lumen. Instala o binário **`lumen`** para scaffold de projetos, artefatos e clientes tipados, além de rodar o servidor com hot reload.

```bash
# instala o binário globalmente ou como devDependency
npm i -D @lumen/cli
pnpm add -D @lumen/cli
```

---

## Comandos

### `lumen new <name>`

Scaffold de um **projeto Lumen completo e executável**.

```bash
lumen new my-api            # my-api/ com /health e um módulo de tasks
lumen new api --contract    # contract-first: /contract/tasks guiado por um contrato tipado
lumen new api --force       # sobrescreve um diretório existente
```

| Opção | Descrição |
| --- | --- |
| `--force` | Sobrescreve arquivos existentes. |
| `--contract` | Inclui exemplo de tasks via `@lumen/contract` (contrato + handlers + client tipado). |

O projeto gerado inclui `package.json`, `tsconfig.json`, `.gitignore`, `.env.example` e `src/` com `main.ts`, `app.module.ts`, `app.service.ts`/`app.controller.ts` e um módulo de exemplo.

---

### `lumen generate <tipo> <nome>` (alias: `g`)

Gera **artefatos** Lumen (módulos, controllers, services, resources, guards, interceptors).

```bash
lumen generate controller users   # src/users/users.controller.ts
lumen generate guard auth         # src/auth/auth.guard.ts
lumen generate resource posts     # module + controller + service
lumen generate module admin --dir src/app --dry-run
```

Tipos válidos: `module`, `controller`, `service`, `resource`, `guard`, `interceptor`.

| Opção | Descrição |
| --- | --- |
| `-d, --dir <path>` | Diretório de saída relativo ao cwd (padrão: `src`). |
| `--dry-run` | Imprime os arquivos que seriam criados sem gravá-los. |

Resultado do `resource`: gera `service` + `controller` + `module` de uma vez.

---

### `lumen dev [entry]`

Roda a API com **hot reload** (observa o código-fonte e reinicia a cada mudança) via `@lumen/reload`.

```bash
lumen dev                       # observa dist/main.js (ou src/main.ts)
lumen dev src/main.ts -p 8080
lumen dev --watch src,shared
```

| Opção | Descrição |
| --- | --- |
| `[entry]` | Módulo de entrada (padrão: `./dist/main.js`, com fallback para `./src/main.ts`). |
| `-p, --port <port>` | Porta repassada ao processo filho via env `PORT`. |
| `--watch <dirs>` | Diretórios a observar (separados por vírgula). |

Fontes `.ts` rodam via `tsx`; saída compilada roda direto com `node`.

---

### `lumen gen-client <contrato>`

Gera um **client totalmente tipado** `@lumen/contract` a partir de um arquivo de contrato.

```bash
lumen gen-client src/contracts/tasks.contract.ts
lumen gen-client src/contracts/tasks.contract.ts -o src/api/client.ts
```

| Opção | Descrição |
| --- | --- |
| `-o, --out <file>` | Arquivo de saída (padrão: irmão do contrato, ex. `tasks.contract.client.ts`). |

O client gerado exporta `createXxxClient(config)` com entradas/saídas inferidas do contrato.

---

### `lumen info`

Mostra a versão da CLI, os tipos de artefato e os pacotes `@lumen/*` instalados no projeto atual.

### `lumen list-templates` (alias: `lt`)

Lista os tipos de artefato disponíveis para `generate`.

---

## API de programação

O `index` também exporta as funções utilitárias de `generators.ts` para reuso programático:

| Export | Descrição |
| --- | --- |
| `VALID_TYPES` / `ValidType` | Tipos de artefato válidos. |
| `isValidType(type)` / `isValidName(name)` | Validações de tipo e nome. |
| `toPascalCase(name)` | Converte `kebab/snake` em `PascalCase`. |
| `generateFiles(type, name)` | Retorna um `Map<arquivo, conteúdo>` para um artefato. |
| `newProjectFiles(name, options)` | Retorna os arquivos de um projeto novo. |
| `clientFromContract(...)` | Gera o código-fonte de um client tipado. |
| `contractConstName(fileBaseName)` | Deriva o nome do const de contrato. |

---

## Notas

- Binário nomeado `lumen` (veja `bin` no `package.json`).
- Depende de `commander` (parsing de args) e de `@lumen/reload` (comando `dev`).
