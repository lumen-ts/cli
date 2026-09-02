export const VALID_TYPES = ['module', 'controller', 'service', 'resource', 'guard', 'interceptor'] as const;
export type ValidType = (typeof VALID_TYPES)[number];

export function isValidType(type: string): type is ValidType {
  return (VALID_TYPES as readonly string[]).includes(type);
}

export function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim() !== '' && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name);
}

export function serviceTemplate(name: string, pascal: string): string {
  return `import { Injectable } from '@lumen/core';

@Injectable()
export class ${pascal}Service {}
`;
}

export function controllerTemplate(name: string, pascal: string): string {
  return `import { Controller, Get } from '@lumen/core';

@Controller('/${name}')
export class ${pascal}Controller {
  @Get()
  list() { return []; }
}
`;
}

export function moduleTemplate(name: string, pascal: string): string {
  return `import { Module } from '@lumen/core';
import { ${pascal}Controller } from './${name}.controller.js';
import { ${pascal}Service } from './${name}.service.js';

@Module({ controllers: [${pascal}Controller], providers: [${pascal}Service] })
export class ${pascal}Module {}
`;
}

export function guardTemplate(name: string, pascal: string): string {
  return `import { Injectable } from '@lumen/core';
import type { ExecutionContext, Guard } from '@lumen/core';

@Injectable()
export class ${pascal}Guard implements Guard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
`;
}

export function interceptorTemplate(name: string, pascal: string): string {
  return `import { Injectable } from '@lumen/core';
import type { ExecutionContext, Interceptor } from '@lumen/core';

@Injectable()
export class ${pascal}Interceptor implements Interceptor {
  async intercept(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    return next();
  }
}
`;
}

export function generateFiles(type: ValidType, name: string): Map<string, string> {
  const pascal = toPascalCase(name);
  const files = new Map<string, string>();
  if (type === 'guard') files.set(`${name}.guard.ts`, guardTemplate(name, pascal));
  if (type === 'interceptor') files.set(`${name}.interceptor.ts`, interceptorTemplate(name, pascal));
  if (type === 'service' || type === 'resource') files.set(`${name}.service.ts`, serviceTemplate(name, pascal));
  if (type === 'controller' || type === 'resource') files.set(`${name}.controller.ts`, controllerTemplate(name, pascal));
  if (type === 'module' || type === 'resource') files.set(`${name}.module.ts`, moduleTemplate(name, pascal));
  return files;
}

function projectPkgJson(projectName: string, contract: boolean): string {
  const contractDep = contract ? ',\n    "@lumen/contract": "latest"' : '';
  return `{
  "name": "${projectName}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "predev": "tsc -p tsconfig.json",
    "dev": "lumen dev",
    "prestart": "tsc -p tsconfig.json",
    "start": "node dist/main.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@lumen/core": "latest",
    "@lumen/openapi": "latest",
    "@lumen/fastify": "latest",
    "@lumen/zod": "latest",
    "zod": "^4.5.4"${contractDep}
  },
  "devDependencies": {
    "@lumen/cli": "latest",
    "typescript": "latest",
    "@types/node": "latest"
  }
}
`;
}

function projectTsconfig(): string {
  return `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*.ts"]
}
`;
}

function projectMainTemplate(title: string, contract: boolean): string {
  const contractImports = contract
    ? `import { createContractServer } from '@lumen/contract';
import { tasksContract } from './contracts/tasks.contract.js';
import { tasksHandlers } from './contracts/tasks.handlers.js';
`
    : '';
  const contractMount = contract
    ? `
const tasksServer = createContractServer(tasksContract, tasksHandlers, adapter);
tasksServer.register();
`
    : '';
  return `import { LumenFactory } from '@lumen/core';
import { registerOpenApi } from '@lumen/openapi';
import { FastifyAdapter } from '@lumen/fastify';
${contractImports}import { AppModule } from './app.module.js';

const adapter = new FastifyAdapter({ logger: true });
await registerOpenApi(adapter, { title: '${title}', version: '0.1.0', description: 'Scaffolded by lumen new.' });
${contractMount}const app = await LumenFactory.create(AppModule, adapter);

const shutdown = async (signal: string) => {
  await app.close(signal);
  process.exit(0);
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? '0.0.0.0' });
`;
}

function projectAppModuleTemplate(contract: boolean): string {
  const tasksImport = contract ? '' : `import { TasksModule } from './tasks/tasks.module.js';
`;
  const imports = contract ? '' : 'imports: [TasksModule], ';
  return `import { Module } from '@lumen/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
${tasksImport}@Module({ ${imports}controllers: [AppController], providers: [AppService] })
export class AppModule {}
`;
}

function projectAppServiceTemplate(): string {
  return `import { Injectable } from '@lumen/core';

@Injectable()
export class AppService {
  uptime(): { status: string; uptime: number; timestamp: string } {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }
}
`;
}

function projectAppControllerTemplate(): string {
  return `import { Controller, Get } from '@lumen/core';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get('/health')
  health() {
    return this.app.uptime();
  }
}
`;
}

function projectTaskSchemaTemplate(): string {
  return `import { z } from 'zod';
import { zodSchema } from '@lumen/zod';

export const TaskZod = z.object({
  title: z.string().min(1).max(120),
  done: z.boolean().optional(),
});
export const CreateTaskSchema = zodSchema(TaskZod);
export type CreateTaskInput = z.infer<typeof TaskZod>;
`;
}

function projectTasksServiceTemplate(): string {
  return `import { Injectable, NotFoundException } from '@lumen/core';
import type { CreateTaskInput } from './tasks.schema.js';

export interface Task {
  id: string;
  title: string;
  done: boolean;
}

@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, Task>();

  constructor() {
    this.tasks.set('demo', { id: 'demo', title: 'Scaffolded by lumen new', done: false });
  }

  list(): Task[] {
    return [...this.tasks.values()];
  }

  find(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new NotFoundException(\`Task \${id} not found\`, { id }, 'TASK_NOT_FOUND');
    return task;
  }

  create(input: CreateTaskInput): Task {
    const task: Task = { id: crypto.randomUUID(), title: input.title, done: input.done ?? false };
    this.tasks.set(task.id, task);
    return task;
  }
}
`;
}

function projectTasksControllerTemplate(): string {
  return `import { Body, Controller, Get, HttpCode, Param, Post } from '@lumen/core';
import { CreateTaskSchema, type CreateTaskInput } from './tasks.schema.js';
import { TasksService } from './tasks.service.js';

@Controller('/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list() {
    return this.tasks.list();
  }

  @Get('/:id')
  find(@Param('id') id: string) {
    return this.tasks.find(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body(CreateTaskSchema) input: CreateTaskInput) {
    return this.tasks.create(input);
  }
}
`;
}

function projectTasksModuleTemplate(): string {
  return `import { Module } from '@lumen/core';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({ controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
`;
}

function projectTasksContractTemplate(): string {
  return `import { defineContract } from '@lumen/contract';
import { z } from 'zod';

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
});

export const tasksContract = defineContract({
  list: {
    method: 'GET',
    path: '/contract/tasks',
    output: z.array(taskSchema),
  },
  get: {
    method: 'GET',
    path: '/contract/tasks/:id',
    params: z.object({ id: z.string() }),
    output: taskSchema,
  },
  create: {
    method: 'POST',
    path: '/contract/tasks',
    body: z.object({ title: z.string().min(1), done: z.boolean().optional() }),
    output: taskSchema,
  },
});

export type TasksContract = typeof tasksContract;
`;
}

function projectTasksHandlersTemplate(): string {
  return `import type { ContractHandlers } from '@lumen/contract';
import type { tasksContract } from './tasks.contract.js';

interface TaskRecord {
  id: string;
  title: string;
  done: boolean;
}

const store = new Map<string, TaskRecord>([
  ['t1', { id: 't1', title: 'Write a contract', done: true }],
  ['t2', { id: 't2', title: 'Ship an API', done: false }],
]);

export const tasksHandlers: ContractHandlers<typeof tasksContract> = {
  async list() {
    return [...store.values()].map((t) => ({ ...t }));
  },
  async get({ params }) {
    const task = store.get(params.id);
    if (!task) throw new Error(\`Task not found: \${params.id}\`);
    return { ...task };
  },
  async create({ body }) {
    const task: TaskRecord = { id: \`t\${store.size + 1}\`, title: body.title, done: body.done ?? false };
    store.set(task.id, task);
    return { ...task };
  },
};
`;
}

function projectTasksClientTemplate(): string {
  return `import { createClient } from '@lumen/contract';
import { tasksContract } from './tasks.contract.js';

/**
 * Fully typesafe client for a Tasks API. Import it anywhere and call the
 * endpoint methods â€” inputs and outputs are inferred from the contract,
 * so the client can never drift from the server.
 */
export const createTasksClient = (config: { baseUrl: string; fetch?: typeof fetch }) =>
  createClient(tasksContract, { baseUrl: config.baseUrl, fetchImpl: config.fetch });
`;
}

export interface NewProjectOptions {
  contract?: boolean;
}

/** Scaffolds a complete, runnable Lumen project. */
export function newProjectFiles(name: string, options: NewProjectOptions = {}): Map<string, string> {
  const { contract = false } = options;
  const title = toPascalCase(name);
  const files = new Map<string, string>();
  files.set('package.json', projectPkgJson(name, contract));
  files.set('tsconfig.json', projectTsconfig());
  files.set('.gitignore', 'node_modules\ndist\n.env\n*.log\n');
  files.set('.env.example', 'PORT=3000\nHOST=0.0.0.0\n');
  files.set('src/main.ts', projectMainTemplate(title, contract));
  files.set('src/app.module.ts', projectAppModuleTemplate(contract));
  files.set('src/app.service.ts', projectAppServiceTemplate());
  files.set('src/app.controller.ts', projectAppControllerTemplate());
  if (contract) {
    files.set('src/contracts/tasks.contract.ts', projectTasksContractTemplate());
    files.set('src/contracts/tasks.handlers.ts', projectTasksHandlersTemplate());
    files.set('src/contracts/tasks.client.ts', projectTasksClientTemplate());
  } else {
    files.set('src/tasks/tasks.schema.ts', projectTaskSchemaTemplate());
    files.set('src/tasks/tasks.service.ts', projectTasksServiceTemplate());
    files.set('src/tasks/tasks.controller.ts', projectTasksControllerTemplate());
    files.set('src/tasks/tasks.module.ts', projectTasksModuleTemplate());
  }
  return files;
}

/** Generates a fully-typed @lumen/contract client that only depends on zod + @lumen/contract. */
export function clientFromContract(fileBaseName: string, constName: string, pascalName: string): string {
  return `import { createClient } from '@lumen/contract';
import { ${constName} } from './${fileBaseName}.js';

/**
 * Fully typesafe client for a ${pascalName} API. Import it anywhere and call
 * the endpoint methods â€” inputs and outputs are inferred from the contract,
 * so the client can never drift from the server.
 */
export const create${pascalName}Client = (config: { baseUrl: string; fetch?: typeof fetch }) =>
  createClient(${constName}, { baseUrl: config.baseUrl, fetchImpl: config.fetch });
`;
}

/** Derives a valid camelCase identifier for a contract const from a file base name. */
export function contractConstName(fileBaseName: string): string {
  const base = fileBaseName.replace(/\.(contract|crud|api)$/i, '');
  const camel = base
    .split(/[-_]/)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
  return `${camel}Contract`;
}
