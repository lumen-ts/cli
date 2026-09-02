import { describe, expect, it } from 'vitest';
import {
  clientFromContract,
  contractConstName,
  generateFiles,
  isValidName,
  isValidType,
  newProjectFiles,
  toPascalCase,
} from './generators.js';

describe('generators', () => {
  it('validates types', () => {
    expect(isValidType('module')).toBe(true);
    expect(isValidType('controller')).toBe(true);
    expect(isValidType('service')).toBe(true);
    expect(isValidType('resource')).toBe(true);
    expect(isValidType('guard')).toBe(true);
    expect(isValidType('interceptor')).toBe(true);
    expect(isValidType('nope')).toBe(false);
  });

  it('validates names', () => {
    expect(isValidName('user')).toBe(true);
    expect(isValidName('user-profile')).toBe(true);
    expect(isValidName('')).toBe(false);
    expect(isValidName('123bad')).toBe(false);
    expect(isValidName('../etc')).toBe(false);
  });

  it('converts dashed names to PascalCase', () => {
    expect(toPascalCase('user-profile')).toBe('UserProfile');
    expect(toPascalCase('user_profile')).toBe('UserProfile');
    expect(toPascalCase('user')).toBe('User');
  });

  it('generates a service file only', () => {
    const files = generateFiles('service', 'user');
    expect([...files.keys()]).toEqual(['user.service.ts']);
    expect(files.get('user.service.ts')!).toContain('UserService');
  });

  it('generates a controller file only', () => {
    const files = generateFiles('controller', 'user');
    expect([...files.keys()]).toEqual(['user.controller.ts']);
    expect(files.get('user.controller.ts')!).toContain('UserController');
  });

  it('generates a module file plus its dependencies for resource', () => {
    const files = generateFiles('resource', 'user');
    expect([...files.keys()].sort()).toEqual(['user.controller.ts', 'user.module.ts', 'user.service.ts']);
    expect(files.get('user.module.ts')!).toContain('UserService');
    expect(files.get('user.module.ts')!).toContain('UserController');
  });

  it('generates a guard file implementing the Guard contract', () => {
    const files = generateFiles('guard', 'auth');
    expect([...files.keys()]).toEqual(['auth.guard.ts']);
    expect(files.get('auth.guard.ts')!).toContain('AuthGuard');
    expect(files.get('auth.guard.ts')!).toContain('implements Guard');
    expect(files.get('auth.guard.ts')!).toContain('canActivate');
  });

  it('generates an interceptor file implementing the Interceptor contract', () => {
    const files = generateFiles('interceptor', 'logging');
    expect([...files.keys()]).toEqual(['logging.interceptor.ts']);
    expect(files.get('logging.interceptor.ts')!).toContain('LoggingInterceptor');
    expect(files.get('logging.interceptor.ts')!).toContain('implements Interceptor');
    expect(files.get('logging.interceptor.ts')!).toContain('intercept');
  });

  it('scaffolds a complete runnable project with a feature module', () => {
    const files = newProjectFiles('my-api');
    expect([...files.keys()].sort()).toEqual([
      '.env.example',
      '.gitignore',
      'package.json',
      'src/app.controller.ts',
      'src/app.module.ts',
      'src/app.service.ts',
      'src/main.ts',
      'src/tasks/tasks.controller.ts',
      'src/tasks/tasks.module.ts',
      'src/tasks/tasks.schema.ts',
      'src/tasks/tasks.service.ts',
      'tsconfig.json',
    ]);
    expect(files.get('package.json')!).toContain('"name": "my-api"');
    expect(files.get('package.json')!).not.toContain('tsx');
    expect(files.get('package.json')!).toContain('"prestart": "tsc -p tsconfig.json"');
    expect(files.get('src/main.ts')!).toContain('LumenFactory.create');
    expect(files.get('src/app.controller.ts')!).toContain("@Get('/health')");
    expect(files.get('src/app.service.ts')!).toContain('@Injectable()');
    expect(files.get('src/tasks/tasks.module.ts')!).toContain('TasksModule');
    expect(files.get('src/tasks/tasks.controller.ts')!).toContain('@Controller(\'/tasks\')');
    expect(files.get('tsconfig.json')!).toContain('experimentalDecorators');
    expect(files.get('tsconfig.json')!).toContain('emitDecoratorMetadata');
    expect(files.get('.env.example')!).toContain('PORT=3000');
  });

  it('scaffolds the contract-first variant when requested', () => {
    const files = newProjectFiles('my-api', { contract: true });
    expect([...files.keys()].sort()).toEqual([
      '.env.example',
      '.gitignore',
      'package.json',
      'src/app.controller.ts',
      'src/app.module.ts',
      'src/app.service.ts',
      'src/contracts/tasks.client.ts',
      'src/contracts/tasks.contract.ts',
      'src/contracts/tasks.handlers.ts',
      'src/main.ts',
      'tsconfig.json',
    ]);
    expect(files.get('package.json')!).toContain('"@lumen/contract": "latest"');
    expect(files.get('src/main.ts')!).toContain('createContractServer');
    expect(files.get('src/main.ts')!).toContain('tasksServer.register()');
    expect(files.get('src/contracts/tasks.contract.ts')!).toContain('defineContract');
    expect(files.get('src/contracts/tasks.handlers.ts')!).toContain('ContractHandlers<typeof tasksContract>');
    expect(files.get('src/contracts/tasks.client.ts')!).toContain('createClient');
    expect(files.get('src/app.module.ts')!).not.toContain('TasksModule');
    expect([...files.keys()].join()).not.toContain('src/tasks/');
  });

  it('generates a fully-typed client from a contract', () => {
    const result = clientFromContract('tasks.contract', 'tasksContract', 'Tasks');
    expect(result).toContain('createClient');
    expect(result).toContain('createTasksClient');
    expect(result).toContain('typeof fetch');
  });

  it('derives a valid contract const name from the file base', () => {
    expect(contractConstName('tasks.contract')).toBe('tasksContract');
    expect(contractConstName('users.crud')).toBe('usersContract');
    expect(contractConstName('user-api')).toBe('userApiContract');
  });
});
