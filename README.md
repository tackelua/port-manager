# Port Manager 🚀

A lightweight, automated port management system for your personal projects.

## Features
- **Auto-assignment**: Automatically assigns a port in the 4000-4999 range.
- **Gist Sync**: Stores port data in a secret GitHub Gist for cross-project consistency.
- **Dashboard**: A beautiful dark-mode dashboard to view and ping your projects.
- **Submodule Friendly**: Designed to be used as a git submodule in your projects.

## Setup
1. **Authenticated gh CLI**: Ensure you have `gh` installed and authenticated on your machine.
2. **Import & Register Port**:
   ```javascript
   const { registerPort } = require('./lib/port-manager');
   
   async function start() {
     // Tự động lấy tên từ package.json
     const port = await registerPort(); 
     
     // Hoặc truyền tên cụ thể
     // const port = await registerPort('my-custom-name');
     
     app.listen(port, () => console.log(`Running on ${port}`));
   }
   ```

## Dashboard
The dashboard is located in the `dashboard/` folder. You can open `index.html` directly or deploy it to GitHub Pages. To view data, you will need a GitHub Personal Access Token (PAT) with `gist` permissions.

## Data Structure
The data is stored in Gist `cf2bff0d9e33c2f9112c1e62fe18b5ee` in a file named `ports.json`.
