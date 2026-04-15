# SYS.METRICS — Advanced Monitoring & Entertainment Platform

A high-performance, stealth-mode gaming platform designed to look like a professional system monitoring dashboard.

## 🚀 Key Features
- **Stealth Mode UI**: Professional glassmorphism design that blends into corporate environments.
- **Vertical Orientation**: Optimized for portrait mode (272x480), perfect for narrow windows or mobile devices.
- **Advanced Networking**: Uses **Redis Pub/Sub** for cross-server chat synchronization and real-time rankings.
- **Security & Stability**: Integrated **WebSocket Rate Limiting** to prevent spam and DDoS.
- **High Performance**: Physics engine optimized for low-latency, 128fps gameplay.
- **Mobile Optimized**: Uses `localStorage` for persistent sessions and relative "Me at Bottom" view logic.

## 🕹️ Games Included
- **PONG (Vertical)**: Classic paddle-and-ball gameplay with dynamic speed scaling.
- **AIR HOCKEY (Vertical)**: Physics-based mallet gameplay with friction and goal detection.

## ⚙️ Administration (SYS.CONSOLE)
Access the administrative dashboard via the environment-defined access code.
- Real-time user/room monitoring.
- Global chat broadcast system.
- Ranking management and reset functions.
- Detailed administrative logs.

## 🛠️ Tech Stack
- **Frontend**: Vanilla JavaScript (ES Modules), HTML5 Canvas, CSS3 (Glassmorphism).
- **Backend**: Node.js, WebSocket (`ws`).
- **Data Layer**: Redis (Sorted Sets, Pub/Sub, Key-Value).
- **Infrastructure**: Docker & Docker Compose.

## 🏁 Quick Start
1. Ensure Docker is installed.
2. Clone the repository.
3. Start the system:
   ```bash
   docker-compose up -d --build
   ```
4. Access the platform at `http://localhost:3000`.

---
*Created with focus on performance, aesthetics, and stealth.*
