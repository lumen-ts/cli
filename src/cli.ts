#!/usr/bin/env node
import { Command } from 'commander';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  generateFiles,
  newProjectFiles,
  clientFromContract,
  contractConstName,
  isValidName,
  isValidType,
  toPascalCase,
  VALID_TYPES,
} from './generators.js';

const program = new Command();
program.name('lumen').description('Lumen framework CLI â€” scaffold modules, controllers, services and more.').version('0.1.0');

const generate = program
  .command('generate')
  .alias('g')
  .description('Generate Lumen artifacts (module, controller, service, resource, guard, interceptor)')
  .argument('<type>', `artifact type (${VALID_TYPES.join('|')})`)
  .argument('<name>')
  .option('-d, --dir <path>', 'output directory relative to cwd', 'src')
  .option('--dry-run', 'print the files that would be written without creating them');

generate
  .addHelpText('after', `
Examples:
  $ lumen generate controller users        # src/users/users.controller.ts
  $ lumen generate guard  auth             # src/auth/auth.guard.ts
  $ lumen generate resource posts          # module + controller + service
  $ lumen generate module admin --dir src/app --dry-run
`)
  .action(async (type: string, name: string, options: { dir: string; dryRun?: boolean }) => {
    if (!isValidType(type)) {
      console.error(`Error: Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
      process.exitCode = 1;
      return;
    }

    if (!isValidName(name)) {
      console.error('Error: Name must be a non-empty identifier starting with a letter (a-z, A-Z, 0-9, _, -).');
      process.exitCode = 1;
      return;
    }

    const dir = resolve(process.cwd(), options.dir, name);
    const files = generateFiles(type, name);

    if (options.dryRun) {
      console.log('Dry run â€” no files were written:');
      for (const [file] of files) {
        console.log(`  ${resolve(dir, file)}`);
      }
      return;
    }

    await mkdir(dir, { recursive: true });
    for (const [file, content] of files) {
      await writeFile(resolve(dir, file), content, 'utf8');
    }

    console.log(`Generated ${type}: ${name}`);
    console.log(`  ${files.size} file(s) in ${dir}`);
  });

program
  .command('info')
  .description('Show framework and project dependency information')
  .action(async () => {
    console.log(`Lumen CLI v${program.version()}`);
    console.log(`Modules: module, controller, service, resource, guard, interceptor`);
    console.log('');
    console.log('Installed @lumen/* packages in this project:');
    try {
      const pkgPath = resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, Record<string, string>>;
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const lumen = Object.entries(deps).filter(([name]) => name.startsWith('@lumen/'));
      if (lumen.length === 0) {
        console.log('  (none found)');
      } else {
        for (const [name, version] of lumen) console.log(`  ${name}@${version}`);
      }
    } catch {
      console.error('  Could not read package.json in the current directory.');
      process.exitCode = 1;
    }
  });

program
  .command('list-templates')
  .alias('lt')
  .description('List the artifact templates available to `generate`')
  .action(() => {
    console.log('Available artifact types:');
    for (const t of VALID_TYPES) {
      console.log(`  ${t}`);
    }
    console.log('');
    console.log('Run `lumen generate <type> <name>` to scaffold.');
  });

program
  .command('new')
  .description('Scaffold a complete, runnable Lumen project')
  .argument('<name>', 'project directory and package name')
  .option('--force', 'overwrite existing files')
  .option('--contract', 'include a contract-first tasks example (contract + handlers + typed client)')
  .addHelpText('after', `
Examples:
  $ lumen new my-api             # my-api/ with /health and a tasks feature module
  $ lumen new api --contract     # contract-first: /contract/tasks driven by a typed contract
  $ lumen new api --force        # overwrite an existing directory
`)
  .action(async (name: string, options: { force?: boolean; contract?: boolean }) => {
    if (!isValidName(name)) {
      console.error('Error: Name must be a non-empty identifier starting with a letter (a-z, A-Z, 0-9, _, -).');
      process.exitCode = 1;
      return;
    }

    const dir = resolve(process.cwd(), name);
    const files = newProjectFiles(name, { contract: options.contract ?? false });
    const conflict = (await Promise.all([...files.keys()].map((f) => access(join(dir, f)).then(() => true, () => false)))).some(Boolean);
    if (conflict && !options.force) {
      console.error(`Error: "${name}" already contains files. Re-run with --force to overwrite.`);
      process.exitCode = 1;
      return;
    }

    await mkdir(dir, { recursive: true });
    for (const [file, content] of files) {
      await mkdir(join(dir, file, '..'), { recursive: true });
      await writeFile(join(dir, file), content, 'utf8');
    }
    console.log(`Scaffolded Lumen project in ./${name}`);
    console.log(`  ${files.size} file(s) â€” run "cd ${name} && npm install && npm run dev"`);
    const routes = options.contract
      ? 'GET /health Â· GET /contract/tasks Â· POST /contract/tasks Â· GET /docs'
      : 'GET /health Â· GET /tasks Â· GET /tasks/:id Â· POST /tasks Â· GET /docs';
    console.log(`  Routes: ${routes}`);
  });

program
  .command('dev')
  .description('Run the API with hot reload (watches source and restarts on change)')
  .argument('[entry]', 'entry module (default: ./dist/main.js, falls back to ./src/main.ts)', '')
  .option('-p, --port <port>', 'port forwarded to the child via PORT env', '')
  .option('--watch <dirs>', 'comma-separated directories to watch (default: the entry directory)', '')
  .addHelpText('after', `
Examples:
  $ lumen dev                       # watch dist/main.js (or src/main.ts)
  $ lumen dev src/main.ts -p 8080
  $ lumen dev --watch src,shared
`)
  .action(async (entry: string, options: { port: string; watch: string }) => {
    const cwd = process.cwd();
    const pickEntry = (): string => {
      if (entry) return resolve(cwd, entry);
      for (const candidate of ['dist/main.js', 'src/main.ts']) {
        const p = resolve(cwd, candidate);
        if (existsSync(p)) return p;
      }
      return resolve(cwd, 'dist/main.js');
    };

    const entryPath = pickEntry();
    if (!existsSync(entryPath)) {
      console.error(`Error: entry module not found: ${entryPath}`);
      console.error('Build first (npm run build) or pass a source entry, e.g. `lumen dev src/main.ts`.');
      process.exitCode = 1;
      return;
    }

    const { RespawnServer } = await import('@lumen/reload');
    const env: Record<string, string | undefined> = { ...process.env };
    if (options.port) {
      const port = Number(options.port);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        console.error(`Error: invalid port "${options.port}"`);
        process.exitCode = 1;
        return;
      }
      env.PORT = String(port);
    }

    // For TypeScript sources run through tsx; otherwise plain node for compiled output.
    const isTs = entryPath.endsWith('.ts') || entryPath.endsWith('.tsx');
    const args = isTs ? [resolve(cwd, 'node_modules/.bin/tsx'), entryPath] : [entryPath];

    const server = new RespawnServer({
      command: process.execPath,
      args,
      cwd,
      env,
      ...(options.watch.trim()
        ? { watchDirs: options.watch.split(',').map((d) => resolve(cwd, d.trim())).filter(Boolean) }
        : {}),
      onReady: (pid) => console.log(`  hot reload server running (pid ${pid}) â€” watching for changes (Ctrl+C to stop)\n`),
    });
    server.on('server:restart', ({ files }) => console.log(`  restarting due to: ${files.join(', ')}`));
    server.on('server:exit', ({ code }) => console.log(`  process exited (code ${code})`));
    server.on('server:error', ({ error }) => console.error('  error:', error instanceof Error ? error.message : error));

    await server.start();

    const shutdown = async () => {
      await server.stop();
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });

program
  .command('gen-client')
  .description('Generate a fully-typed @lumen/contract client from a contract definition')
  .argument('<contract>', 'contract source file (defines an exported contract const)')
  .option('-o, --out <file>', 'output file (default: sibling of the contract)', '')
  .addHelpText('after', `
Examples:
  $ lumen gen-client src/contracts/tasks.contract.ts
  $ lumen gen-client src/contracts/tasks.contract.ts -o src/api/client.ts
`)
  .action(async (contract: string, options: { out?: string }) => {
    const contractPath = resolve(process.cwd(), contract);
    try {
      await access(contractPath);
    } catch {
      console.error(`Error: contract file not found: ${contractPath}`);
      process.exitCode = 1;
      return;
    }

    const base = contractPath.replace(/\.(ts|js)$/i, '');
    const fileBaseName = `${base.split(/[\\/]/).pop()}`;
    const constName = contractConstName(fileBaseName);
    const pascal = toPascalCase(fileBaseName.replace(/\.(contract|crud|api)$/i, ''));
    const output = options.out && options.out.trim() !== '' ? resolve(process.cwd(), options.out) : `${base}.client.ts`;

    await mkdir(resolve(output, '..'), { recursive: true });
    await writeFile(output, clientFromContract(fileBaseName, constName, pascal), 'utf8');
    console.log(`Generated typesafe client at ${output} (imports ./${fileBaseName}.js, exports ${constName})`);
  });

program.parseAsync().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});
