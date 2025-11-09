import { Command } from 'commander';

const program = new Command();
program
  .requiredOption('--host <host>', 'Host address')
  .requiredOption('--port <port>', 'Port number')
  .requiredOption('--cache <path>', 'Cache directory');

program.parse(process.argv);

const options = program.opts();
console.log('Server options:', options);
