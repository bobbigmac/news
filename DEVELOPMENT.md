# Development Guide

## Local Development Setup

### Quick Start
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev
```


## ✅ Development Environment Ready

### **Quick Commands:**
- `npm run dev` - Build and start server (one-time)
- `npm run watch` - Start server with hot reload watching
- `npm run build` - Just build the site

### **What's Set Up:**

1. **Live-Server**: Node.js development server with hot reload
2. **Port 8000**: Site runs at `http://localhost:8000`
3. **File Watching**: Automatically reloads when you edit `src/` files
4. **GitHub Pages Ready**: Uses `docs/` directory for deployment

### **Workflow:**
- Edit `src/` files → automatic browser reload
- Edit `recipes/` files → run `npm run build` to rebuild
- Test locally → push to deploy to `bobdavies.co.uk/recipes`

### **GitHub Pages Configuration:**
For your existing domain setup, you'll need to:
1. In repo Settings → Pages
2. Set source to "Deploy from a branch"
3. Select `main` branch and `/docs` folder
4. The site will be available at `bobdavies.co.uk/recipes`

The development server should now be running at `http://localhost:8000` with hot reload enabled for your frontend files!

2. **Live Reload**:
   - Changes to `src/` files trigger automatic browser reload
   - Changes to `recipes/` files require manual rebuild (`npm run build`)
   - The server watches both directories for changes

3. **Testing**:
   - Site runs at `http://localhost:8000`
   - Test recipe filtering and navigation
   - Verify responsive design on different screen sizes

### File Structure for Development

```
recipes/
├── src/                    # Frontend source files
│   ├── index.html         # Main template
│   ├── style.css          # Styles
│   └── app.js             # JavaScript logic
├── recipes/               # Recipe markdown files
│   ├── banana-bread.md
│   ├── caesar-salad.md
│   └── ...
├── scripts/
│   └── build.js          # Build script
└── docs/                 # Built site (generated)
    ├── index.html
    ├── recipes.json
    └── recipes/
```

### Hot Reload Behavior

- **HTML/CSS/JS changes**: Automatic browser reload
- **Recipe content changes**: Manual rebuild required
- **Build script changes**: Manual rebuild required

### Production Deployment

- Push to `main` branch triggers GitHub Actions
- Site deploys to `bobdavies.co.uk/recipes`
- Uses `docs/` directory for GitHub Pages

### Troubleshooting

- **Port conflicts**: Change port in package.json scripts
- **Build errors**: Check recipe markdown syntax
- **Live reload not working**: Restart with `npm run watch` 
