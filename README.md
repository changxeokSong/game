# SYS.METRICS - Stealth Multiplayer Game Suite

A high-performance, stealth-oriented multiplayer game platform designed to look like a system monitoring dashboard.

## Features

- **Stealth UI**: Designed to look like a professional metrics dashboard (`SYS.METRICS`).
- **Vertical Alignment**: Optimized for narrow windows and portrait-mode "stealth" viewing.
- **Glassmorphism Design**: Modern, premium aesthetic with blur effects and neon accents.
- **High Performance**:
  - **Redis Sorted Sets**: Real-time, instant ranking management.
  - **Redis Pub/Sub**: Scalable, cross-server real-time chat.
  - **Redis Rate Limiting**: Built-in protection against message flooding.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism), JavaScript (ES Modules).
- **Backend**: Node.js, WebSocket (ws).
- **Database**: Redis (In-memory data structures).
- **Deployment**: Docker & Docker Compose.

## Getting Started

1. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```
2. **Access**:
   - Open `http://localhost:3000` in your browser.
   - Enter a nickname and start playing!

## Advanced Mechanisms

### 1. Redis Rate Limiting
Incoming WebSocket messages are limited to 50 requests per second per IP to prevent spam and server overload.

### 2. Scalable Chat (Pub/Sub)
Messages are published to a global Redis channel (`chat_global`). This allows multiple backend instances to share the same chat stream seamlessly.

### 3. Vertical Play
Games (Pong, Air Hockey) are re-engineered for vertical (Top vs. Bottom) play, fitting perfectly into thin sidebar windows.
