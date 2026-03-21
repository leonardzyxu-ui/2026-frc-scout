const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Building local scout...');
execSync('npx vite build -c vite.local.config.ts', { stdio: 'inherit' });

const distHtml = path.join(__dirname, 'dist-local', 'index.html');
const targetDir = path.join(__dirname, 'Local Scout');
const targetHtml = path.join(targetDir, 'scoutLocal.html');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

let content = fs.readFileSync(distHtml, 'utf8');
content = content.replace('<script type="module" crossorigin>', '<script type="module">');

const errorHandler = `
<script>
  window.addEventListener('error', function(e) {
    alert('ERROR: ' + e.message + '\\n' + e.filename + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function(e) {
    alert('Unhandled Promise Rejection: ' + e.reason);
  });
</script>
`;
content = content.replace('<head>', '<head>' + errorHandler);

fs.writeFileSync(targetHtml, content);

console.log('Done! Local scout available at Local Scout/scoutLocal.html');
