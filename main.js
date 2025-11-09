import http from 'http';
import { Command } from 'commander';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import superagent from 'superagent';

// --- Commander: аргументи командного рядка ---
const program = new Command();
program
  .requiredOption('-h, --host <host>', 'Server host')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Cache directory');

program.parse(process.argv);
const options = program.opts();
const cacheDir = options.cache;

// --- Створити кеш директорію, якщо не існує ---
if (!existsSync(cacheDir)) {
  await fs.mkdir(cacheDir, { recursive: true });
  console.log(`Cache directory created at ${cacheDir}`);
}

// --- HTTP сервер ---
const server = http.createServer(async (req, res) => {
  const code = req.url.slice(1); // наприклад "200"
  const filePath = path.join(cacheDir, `${code}.jpg`);

  try {
    if (req.method === 'GET') {
      // --- GET: спочатку з кешу ---
      try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        return res.end(data);
      } catch {
        // --- Якщо в кеші немає, пробуємо завантажити з http.cat ---
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
      // --- PUT: записати картинку в кеш ---
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      await fs.writeFile(filePath, body);
      res.writeHead(201);
      return res.end('Created');
    } 
    else if (req.method === 'DELETE') {
      // --- DELETE: видалити картинку з кешу ---
      try {
        await fs.unlink(filePath);
        res.writeHead(200);
        return res.end('Deleted');
      } catch {
        res.writeHead(404);
        return res.end('Not Found');
      }
    } 
    else {
      res.writeHead(405);
      return res.end('Method Not Allowed');
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// --- Запуск сервера ---
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
