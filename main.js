import http from 'http';
import { Command } from 'commander';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import superagent from 'superagent';

// ---- Command-line arguments ----
const program = new Command();
program
  .requiredOption('-h, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Cache directory');

program.parse(process.argv);
const options = program.opts();
const cacheDir = options.cache;

// ---- Ensure cache directory exists ----
if (!existsSync(cacheDir)) {
  await fs.mkdir(cacheDir, { recursive: true });
  console.log(`Cache directory created at ${cacheDir}`);
}

// ---- HTTP Server ----
const server = http.createServer(async (req, res) => {
  const code = req.url.slice(1); // remove leading '/'
  const filePath = path.join(cacheDir, `${code}.jpg`);

  try {
    if (req.method === 'GET') {
      try {
        // Try reading from cache
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(data);
      } catch {
        // If not in cache, fetch from http.cat
        try {
          const response = await superagent
            .get(`https://http.cat/${code}`)
            .buffer(true)
            .parse(superagent.parse.image);

          const img = response.body;
          await fs.writeFile(filePath, img);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          return res.end(img);
        } catch {
          res.writeHead(404);
          return res.end('Not Found');
        }
      }
    }

    else if (req.method === 'PUT') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        const body = Buffer.concat(chunks);
        await fs.writeFile(filePath, body);
        res.writeHead(201);
        res.end('Created');
      });
      req.on('error', () => {
        res.writeHead(500);
        res.end('Internal Server Error');
      });
    }

    else if (req.method === 'DELETE') {
      try {
        await fs.unlink(filePath);
        res.writeHead(200);
        res.end('Deleted');
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
    }

    else {
      res.writeHead(405);
      res.end('Method Not Allowed');
    }

  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// ---- Start server ----
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
