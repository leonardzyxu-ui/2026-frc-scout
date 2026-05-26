const fs = require('fs');
const path = require('path');

const targetHtml = path.join(__dirname, 'Local Scout', 'scoutLocal.html');
let content = fs.readFileSync(targetHtml, 'utf8');

const errorHandler = `
<script>
  window.addEventListener('error', function(e) {
    document.body.innerHTML += '<div style="color:red; padding:20px; font-family:monospace; z-index:9999; position:absolute; top:0; left:0; background:black; width:100%;">' + e.message + '<br>' + e.filename + ':' + e.lineno + '</div>';
  });
  window.addEventListener('unhandledrejection', function(e) {
    document.body.innerHTML += '<div style="color:red; padding:20px; font-family:monospace; z-index:9999; position:absolute; top:0; left:0; background:black; width:100%;">Unhandled Promise Rejection: ' + e.reason + '</div>';
  });
</script>
`;

content = content.replace('<head>', '<head>' + errorHandler);
fs.writeFileSync(targetHtml, content);
console.log('Added error handler');
