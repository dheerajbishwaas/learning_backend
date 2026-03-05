// Cleanup script
const fs = require('fs');
['list_models.js', 'check_api.js', 'test_api.js', 'verify_models.js'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
});
console.log('Test scripts cleaned up.');
