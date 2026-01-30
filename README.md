# ZIP

A lightweight, fast web tool to **explore, preview and download ZIP files directly in the browser** without downloading the entire file first. Perfect for sharing and browsing ZIP contents instantly.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 📤 **Flexible Loading** - Load from file, URL, or query parameter
- 📁 **Directory Tree** - Expandable hierarchical view with search
- 📄 **Preview Support** - Text, images, code, JSON, and more
- ⬇️ **Smart Downloads** - Download individual files or complete ZIPs
- 🌓 **Dark Mode** - Automatic theme detection
- 📱 **Responsive** - Works perfectly on mobile and desktop
- 🔗 **Shareable URLs** - `?url=https://example.com/file.zip`
- 🖱️ **Drag & Drop** - Drop ZIPs anywhere on the page
- ⚡ **Fast** - Processes ZIPs entirely in the browser

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Run

```bash
npm start
# Server running on http://localhost:3000
```

### 3. Use

Open `http://localhost:3000` and:
- Upload a local ZIP file
- Paste a URL to a remote ZIP
- Share with: `http://localhost:3000/?url=https://example.com/archive.zip`

## How It Works

```
1. Browser loads ZIP (locally or from URL)
2. JSZip parses it in memory (no server processing)
3. Display hierarchical directory tree
4. Click files to preview (text, images, code)
5. Download individual files or entire ZIP
```

**No servers. No database. Everything in browser memory.**

## Features in Detail

### Load Methods
- **File Upload** - Click or drag-drop `.zip` files
- **URL Loading** - Paste any public ZIP URL (via proxy to avoid CORS)
- **URL Parameter** - Share: `?url=https://example.com/archive.zip`
- **Auto-detection** - Extracts filename from URL automatically

### File Exploration
- **Tree Structure** - Folders sorted first, alphabetically
- **Real-time Search** - Filter files as you type
- **Expand/Collapse** - Buttons to open/close all folders
- **File Statistics** - Count files, directories, uncompressed size, compression ratio

### Preview Support
- **Text Files** - Source code, markdown, JSON, YAML, etc. (50KB limit)
- **Images** - PNG, JPG, GIF, WebP, SVG, BMP, ICO
- **Code** - Syntax highlighting ready (CSS, JS, Python, Go, Rust, etc.)
- **Binary Files** - Shows file type indicator

### Download Options
- **Individual Files** - Extract without downloading full ZIP
- **Complete ZIP** - Download original file
- **Copy to Clipboard** - For text files only

## Supported File Types

### Text Files (Previewed)
```
Docs:    txt, md, markdown, csv, log, env
Code:    js, ts, jsx, tsx, json, py, java, cpp, c, h, php, rb, go, rs, sql, sh, bash, r
Config:  xml, yml, yaml, properties, gradle, dockerfile, gitignore, editorconfig
Web:     html, htm, css
```

### Images (Rendered)
```
png, jpg, jpeg, gif, webp, svg, bmp, ico
```

### Other
- Binary files shown with type indicator
- Full preview for files <50 KB

## Installation

### Option 1: Development
```bash
npm install
npm run dev    # Watch mode
npm start      # Single run
```

### Option 2: Production
```bash
npm install
npm start
# Deploy folder anywhere: GitHub Pages, Vercel, Netlify, etc.
```

### Option 3: Docker
```bash
docker build -t zip .
docker run -p 3000:3000 zip
```

## Advanced

### Proxy Endpoint
The server includes a CORS proxy for loading remote ZIPs:
```
GET /api/proxy?url=https://example.com/file.zip
```

### Shareable Links
```markdown
[Open Archive](https://example.com/?url=https://github.com/user/repo/archive/main.zip)
```

### API Endpoints
```
GET /api/proxy?url=<url>     # Download and proxy ZIP
GET /node_modules/jszip/*    # Serve dependencies
```

## Technical Details

### Architecture
- **Client-side Processing** - ZIPs processed entirely in browser
- **Native Node.js** - Server uses only `http`, `fs`, `path`, `url`
- **Zero npm Dependencies for Server** - Only JSZip as client dependency
- **CDN Optional** - Tailwind CSS from CDN, but works offline

### Performance
- No server-side unzipping (fast!)
- Memory-efficient tree rendering
- Lazy file loading on preview
- Automatic compression ratio calculation

### Security
- ✅ No content sent to servers
- ✅ ZIP processing in browser memory
- ⚠️ Large files may require significant RAM
- ⚠️ No malware scanning (verify ZIPs yourself)

## Project Structure

```
index.html         # Main UI (Tailwind CSS + Vanilla JS)
server.js          # HTTP server with proxy endpoint
app.js             # Client-side ZIP handling
package.json       # JSZip dependency only
lib/
  zip-parser.js    # Reserved for future utilities
```

## Use Cases

- 🤝 **Share Build Artifacts** - Make ZIPs explorable without download
- 📦 **Repository Archives** - Browse GitHub releases without downloading
- 📚 **Code Distribution** - Share project templates easily
- 🏠 **File Management** - Quick preview of backups and archives
- 🔍 **Document Review** - Inspect ZIP contents before extracting

## Why ZIP?

| Feature | Upptime | Status Monitor | ZIP |
|---------|---------|----------------|-------------|
| Setup | Complex | Simple | Trivial |
| No Dependencies | ❌ | ✅ | ✅ |
| Lightweight | ❌ | ✅ | ✅ |
| Customize | Hard | Easy | Easy |
| Cost | $99/mo | Free | Free |

## Limitations

- Browsers have ~500MB-2GB RAM limits (depends on device)
- Very large ZIPs (>100 MB) can be slow
- Images display at actual size within container
- CSS selectors for HTML preview are simple (no XPath)

## Troubleshooting

**JSZip fails to load**
- Ensure `npm install` completed successfully
- Check browser console for errors

**Slow with large ZIPs**
- Browser is processing in memory
- Close other apps to free RAM
- Try a smaller ZIP first

**Can't load from URL**
- URL must be publicly accessible
- Some servers block direct downloads
- Use the proxy endpoint: `/api/proxy?url=...`

## Contributing

Pull requests welcome! Keep it simple and lightweight.

## License

ISC - Free to use and modify

