const fs = require('fs');
const content = fs.readFileSync('Local Scout/scoutLocal.html', 'utf8');
const scriptMatches = content.match(/<script[\s\S]*?<\/script>/g);
if (scriptMatches) {
  scriptMatches.forEach((s, i) => {
    console.log(`Script ${i}: length ${s.length}, starts with: ${s.substring(0, 100)}`);
  });
}
