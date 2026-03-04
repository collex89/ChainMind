const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/pc/Desktop/firstTask/web3ai';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace brand name
  content = content.split('Web3AI').join('ChainMind');
  content = content.split('web3ai').join('chainmind');
  
  // Replace the ⬡ brand icon with logo image
  content = content.replace(
    /<div class="brand-icon">⬡<\/div>/g,
    '<div class="brand-icon"><img src="assets/chainmind_logo.png" alt="ChainMind"></div>'
  );
  // Also handle the case where ⬡ was already replaced
  content = content.replace(
    /⬡/g,
    ''
  );

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Rebranded all HTML files to ChainMind.');
