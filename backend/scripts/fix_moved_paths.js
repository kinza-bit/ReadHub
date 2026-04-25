const fs = require('fs');
const path = require('path');
const scriptsDir = __dirname;
const files = fs.readdirSync(scriptsDir);

files.forEach(file => {
  if (file.endsWith('.js') && file !== 'fix_moved_paths.js') {
    const filePath = path.join(scriptsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update relative paths
    // require('./backend/db') -> require('../db')
    content = content.replace(/require\(['"]\.\/backend\//g, "require('../");
    // require('../db') stays same or maybe it was require('./db')? 
    // In root it was require('./backend/db')
    
    // config({ path: './backend/.env' }) -> config({ path: '../.env' })
    content = content.replace(/path: ['"]\.\/backend\/\.env['"]/g, "path: '../.env'");
    
    fs.writeFileSync(filePath, content);
    console.log('Fixed paths in: ' + file);
  }
});
