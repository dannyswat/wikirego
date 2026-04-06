# wiki rego

[![Go Server CI](https://github.com/dannyswat/wikirego/actions/workflows/go.yml/badge.svg)](https://github.com/dannyswat/wikirego/actions/workflows/go.yml) [![React Client CI](https://github.com/dannyswat/wikirego/actions/workflows/react.yml/badge.svg)](https://github.com/dannyswat/wikirego/actions/workflows/react.yml) [![Docker Build](https://github.com/dannyswat/wikirego/actions/workflows/docker.yml/badge.svg)](https://github.com/dannyswat/wikirego/actions/workflows/docker.yml) [![Release](https://github.com/dannyswat/wikirego/actions/workflows/release.yml/badge.svg)](https://github.com/dannyswat/wikirego/actions/workflows/release.yml)

A lightweight, file-based wiki application written in Go with a React front-end. It supports markdown editing, page revisions, user authentication, and inline Excalidraw diagrams.

## Features

- **Page Management**: Create, read, update, and delete wiki pages.
- **Rich Text Editing**: Uses CKEditor for WYSIWYG content editing.
- **Revision History**: Track changes and revert to previous revisions.
- **User Authentication**: Secure login, password change, and optional account lockout.
- **Excalidraw Diagrams**: Draw and embed diagrams directly in pages.
- **File-Based Storage**: Uses a simple filedb for data storage—no external database required.
- **Docker Support**: Single-container deployment with static Go binary and built React assets.

---

## Live Demo

- URL: [https://demo.wikigo.site/](https://demo.wikigo.site/)
- Username: admin
- Password: WikiGoAdmin123

## Quick Start (Pre-built Binary)

Download the latest ZIP for your platform from the [Releases page](https://github.com/dannyswat/wikirego/releases):

| Platform | File |
|---|---|
| Linux x64 | `wikirego-linux-amd64.zip` |
| Linux ARM64 | `wikirego-linux-arm64.zip` |
| macOS x64 | `wikirego-darwin-amd64.zip` |
| macOS Apple Silicon | `wikirego-darwin-arm64.zip` |
| Windows x64 | `wikirego-windows-amd64.zip` |

### Running on Linux / macOS

```bash
# Extract the archive
unzip wikirego-linux-amd64.zip -d wikirego
cd wikirego

# Make the binary executable (Linux/macOS only)
chmod +x wikirego

# Start the server
./wikirego
```

### Running on Windows

```bat
:: Extract the ZIP, then from the extracted folder:
wikirego.exe
```

The application will be available at http://localhost:8080

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port the server listens on |
| `SERVER_PORT` | — | Alternative port variable |
| `HTTP_PLATFORM_PORT` | — | Port variable for Azure App Service |
| `TLS_CERT` | — | Path to TLS certificate file (enables HTTPS) |
| `TLS_KEY` | — | Path to TLS private key file (enables HTTPS) |

#### Example: Run on a custom port

```bash
PORT=9090 ./wikirego
```

#### Example: Run with HTTPS

```bash
TLS_CERT=/path/to/cert.pem TLS_KEY=/path/to/key.pem PORT=443 ./wikirego
```

When both `TLS_CERT` and `TLS_KEY` are set, the server automatically serves HTTPS. If either is missing, the server falls back to plain HTTP.

---

## Quick Start (Docker)

An official Docker image is available on Docker Hub: `dannyswat/wikirego`

### 1. Run with Docker

```bash
# Pull the latest image
docker pull dannyswat/wikirego:latest

# Start container (maps port 8080)
docker run -d \
  --name wikirego \
  -p 8080:8080 \
  -v $(pwd)/server/data:/app/data \
  -v $(pwd)/server/media:/app/media \
  -v $(pwd)/server/conf:/app/conf \
  dannyswat/wikirego:latest
```

The application will be available at http://localhost:8080

### 2. Using Docker Compose

A `docker-compose.yml` is provided for convenience:

```bash
# From project root
docker-compose up -d --build
```

This will build (if needed) and start the `wikirego` service, mounting `server/data` and `server/media` for persistence.

---

## Custom Build

### Prerequisites

- Go 1.21+
- Node.js 14+ and npm/Yarn
- Git (if using Go modules from VCS)

### 1. Build and run manually

```bash
# From project root
# 1) Build server
cd server
go build -o wikirego.exe ./cmd/web/main.go

# 2) Build client
cd ../client
npm install
npm run build

# 3) Copy client assets into server/public
rm -rf ../server/public/*
cp -r dist/* ../server/public/

# 4) Run the server
cd ../server
./wikirego.exe
```

The server listens on port 8080 by default. Browse to http://localhost:8080

### 2. Windows Build (build.bat)

A simple `build.bat` script is provided:

```bat
cd %~dp0
rmdir /s /q build
mkdir build\data
copy release\* build
mkdir build\public
copy server\public\* build\public
cd server
go build -o ..\build\wikirego.exe
cd ..\client
npm install
npm run build
copy dist\* ..\build\public
```

Run `build.bat` and then launch `build\wikirego.exe`.

---

## Configuration

The application reads files from:

- **Data**: `data/` (wiki pages, users, and settings)
- **Media**: `media/` (diagram JSON, SVG, and uploads)
- **Conf**: `conf/` (FIDO2 and other configuration)
- **Views**: `views/` (HTML templates)
- **Public**: `public/` (static assets from React build)

All paths are relative to the working directory where the binary is executed. When using Docker, these are mounted as volumes (see above).

### HTTPS / TLS

Set `TLS_CERT` and `TLS_KEY` to the paths of your certificate and private key files to enable HTTPS. When only one variable is set (or neither), the server starts in plain HTTP mode.

```bash
TLS_CERT=./cert.pem TLS_KEY=./key.pem PORT=443 ./wikirego
```

---

## License

This project is released under the GNU General Public License v2.0 (GPL-2.0), in accordance with the CKEditor license terms. See [LICENSE](LICENSE) for details.
