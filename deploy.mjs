import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';
import https from 'https';

const TOKEN = readFileSync(process.env.HOME + '/.openclaw/credentials/vercel-token', 'utf8').trim();
const ROOT = import.meta.dirname;
const DIST = join(ROOT, 'dist');
const API = join(ROOT, 'api');

function sha1(buf) {
  return createHash('sha1').update(buf).digest('hex');
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = { method, hostname: u.hostname, path: u.pathname + u.search, headers };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

async function uploadFile(filePath, deployPath) {
  const buf = readFileSync(filePath);
  const digest = sha1(buf);
  const size = buf.length;

  const res = await request('POST', 'https://api.vercel.com/v2/files', {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/octet-stream',
    'x-vercel-digest': digest,
    'Content-Length': size,
  }, buf);
  console.log(`  ${deployPath} → ${res.status}`);
  return { file: deployPath, sha: digest, size };
}

async function collectAndUpload() {
  const fileEntries = [];

  // Upload root files needed by serverless functions
  const rootFiles = ['package.json'];
  for (const name of rootFiles) {
    const full = join(ROOT, name);
    if (existsSync(full)) {
      fileEntries.push(await uploadFile(full, name));
    }
  }

  // Upload static files from dist/
  const distFiles = walk(DIST);
  for (const f of distFiles) {
    const rel = relative(DIST, f);
    fileEntries.push(await uploadFile(f, rel));
  }

  // Upload serverless functions from api/
  if (existsSync(API)) {
    const apiFiles = walk(API);
    for (const f of apiFiles) {
      const rel = 'api/' + relative(API, f);
      fileEntries.push(await uploadFile(f, rel));
    }
  }

  return fileEntries;
}

async function deploy() {
  console.log('Uploading files...');
  const files = await collectAndUpload();
  console.log(`\nUploaded ${files.length} files. Creating deployment...`);

  const payload = JSON.stringify({
    name: 'snapmerch',
    project: 'prj_etmlInxbtWVBCHFx2VFxSIEVA4OV',
    files,
    projectSettings: {
      framework: null,
      buildCommand: '',
      outputDirectory: '.',
    },
    routes: [
      { handle: 'filesystem' },
      { src: '/api/(.*)', dest: '/api/$1' },
      { src: '/(.*)', dest: '/index.html' },
    ],
    target: 'production',
  });

  const res = await request('POST', 'https://api.vercel.com/v13/deployments', {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  }, payload);

  const data = JSON.parse(res.body);
  if (data.url) {
    console.log(`\n✅ Deployed: https://${data.url}`);
    console.log(`   ID: ${data.id}`);
  } else {
    console.log('\n❌ Deploy failed:');
    console.log(JSON.stringify(data, null, 2));
  }
}

deploy().catch(console.error);
