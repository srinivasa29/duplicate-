const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require("socket.io");
const cors = require('cors');
const logger = require('./src/config/logger');
const { connectDB, getDbStatus } = require('./src/config/db');
require('dotenv').config();

if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
    logger.error("FATAL ERROR: Missing required environment variables (JWT_SECRET or MONGO_URI).");
    process.exit(1);
}

const { initRealtimeService } = require('./src/services/realtimeService');
const { startAlertEngine, stopAlertEngine, setAlertEventEmitter } = require('./src/services/alertEngine');
const { notFound, errorHandler } = require('./src/middleware/errorMiddleware');
const dataUpdateCron = require('./src/services/dataUpdateCron');
const smartRefreshService = require('./src/services/smartRefreshService');
const { startFundamentalsRefreshCron } = require('./src/crons/fundamentalsRefreshCron');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});
const parsePort = (value, fallback) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const BASE_PORT = parsePort(process.env.PORT, 5000);
const SHOULD_AUTO_FALLBACK_PORT =
    process.env.NODE_ENV !== 'production' &&
    process.env.PORT_STRICT !== 'true' &&
    process.env.PORT_AUTO_FALLBACK !== 'false';
const DB_RETRY_INTERVAL_MS = 60000;

let alertEngineStarted = false;
let reconnectTimer = null;
let currentPort = BASE_PORT;

app.use(cors());
app.use(express.json());

const maybeStartAlertEngine = () => {
    if (alertEngineStarted || !getDbStatus()) {
        return;
    }

    startAlertEngine();
    alertEngineStarted = true;
    logger.info('Alert Engine started');
};

const clearReconnectTimer = () => {
    if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
    }
};

const scheduleDbReconnect = () => {
    if (reconnectTimer || getDbStatus()) {
        return;
    }

    logger.warn(`MongoDB unavailable. Retrying connection every ${DB_RETRY_INTERVAL_MS / 1000}s.`);

    reconnectTimer = setInterval(async () => {
        const connected = await connectDB();
        if (connected) {
            clearReconnectTimer();
            maybeStartAlertEngine();
        }
    }, DB_RETRY_INTERVAL_MS);
};

const normalizeSubscriptionChannels = (payload, fallback = ['ticker']) => {
    let raw = [];

    if (typeof payload === 'string') {
        raw = [payload];
    } else if (Array.isArray(payload)) {
        raw = payload;
    } else if (payload && typeof payload === 'object') {
        raw = [
            payload.channel,
            ...(Array.isArray(payload.channels) ? payload.channels : []),
            payload.room,
            ...(Array.isArray(payload.rooms) ? payload.rooms : []),
        ];

        if (payload.symbol) {
            raw.push(`symbol:${String(payload.symbol).trim().toUpperCase()}`);
        }
    }

    const mapped = raw
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean)
        .map((channel) => {
            if (channel === 'price_update' || channel === 'prices') return 'ticker';
            if (channel === 'alerts' || channel === 'alert_triggered') return 'alerts';
            if (channel === 'system' || channel === 'system_status') return 'system';
            return channel;
        });

    if (mapped.length === 0) {
        return [...fallback];
    }

    return [...new Set(mapped)];
};

const buildSystemStatusPayload = (overrides = {}) => ({
    status: 'ok',
    db: getDbStatus() ? 'connected' : 'disconnected',
    alertEngine: alertEngineStarted ? 'running' : 'stopped',
    timestamp: new Date().toISOString(),
    ...overrides,
});

io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);
    socket.join('ticker');

    socket.emit('system_status', buildSystemStatusPayload({
        event: 'connected',
        socketId: socket.id,
        channels: ['ticker'],
    }));

    socket.on('subscribe', (payload) => {
        const channels = normalizeSubscriptionChannels(payload, ['ticker']);
        channels.forEach((channel) => socket.join(channel));
        socket.emit('system_status', buildSystemStatusPayload({
            event: 'subscribed',
            channels,
        }));
    });

    socket.on('unsubscribe', (payload) => {
        const channels = normalizeSubscriptionChannels(payload, []);
        channels.forEach((channel) => socket.leave(channel));
        socket.emit('system_status', buildSystemStatusPayload({
            event: 'unsubscribed',
            channels,
        }));
    });

    socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.id}`);
        io.to('ticker').emit('system_status', buildSystemStatusPayload({
            event: 'client_disconnected',
            socketId: socket.id,
        }));
    });
});

initRealtimeService(io);
setAlertEventEmitter((eventName, payload) => {
    io.to('alerts').emit(eventName, payload);
    io.to('ticker').emit(eventName, payload);
});

mongoose.connection.on('connected', () => {
    clearReconnectTimer();
    maybeStartAlertEngine();
});

mongoose.connection.on('disconnected', () => {
    if (alertEngineStarted) {
        stopAlertEngine();
        alertEngineStarted = false;
    }
    scheduleDbReconnect();
});
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        db: getDbStatus() ? 'connected' : 'disconnected',
        alertEngine: alertEngineStarted ? 'running' : 'stopped',
    });
});
app.use('/api/auth',          require('./src/routes/authRoutes'));
app.use('/api/stocks',        require('./src/routes/ohlcRoutes'));
app.use('/api/user',          require('./src/routes/userRoutes'));
app.use('/api/user/settings', require('./src/routes/userSettingsRoutes'));
app.use('/api/market',        require('./src/routes/marketRoutes'));
app.use('/api/news',          require('./src/routes/newsRoutes'));

app.use('/api/market/universe', require('./src/routes/marketUniverseRoutes'));
app.use('/api/watchlist',     require('./src/routes/watchlistRoutes'));
app.use('/api/portfolio',     require('./src/routes/portfolioRoutes'));
app.use('/api/alerts',        require('./src/routes/alertRoutes'));
app.use('/api/analytics',     require('./src/routes/analyticsRoutes'));
app.use('/api/technical',     require('./src/routes/technicalRoutes'));
app.use('/api/fno',           require('./src/routes/fnoRoutes'));
app.use('/api/fundamental',   require('./src/routes/fundamentalRoutes'));
app.use('/api/calendar',      require('./src/routes/calendarRoutes'));
app.use('/api/earnings',      require('./src/routes/earningsRoutes'));
app.use('/api/notifications', require('./src/routes/notificationRoutes'));
app.use('/api/ticker',        require('./src/routes/tickerRoutes'));
app.use('/api/sectors',       require('./src/routes/sectorRoutes'));
app.use('/api/learning',      require('./src/routes/learningRoutes'));
app.use('/api/ohlc',          require('./src/routes/ohlcRoutes'));
app.use('/api/admin',         require('./src/routes/adminRoutes'));
app.use('/api/admin/updates', require('./src/routes/updateAdminRoutes'));
app.use('/api/admin/refresh', require('./src/routes/refreshAdminRoutes'));
app.use('/api/admin/cache',   require('./src/routes/cacheAdminRoutes'));
app.use('/api/quotes',        require('./src/routes/quotesRoutes'));
app.use('/api/screener',      require('./src/routes/screenerRoutes'));
app.use('/api/stocks',        require('./src/routes/stocksRoutes'));
app.use('/api/options',       require('./src/routes/optionsRoutes'));
app.use('/api/backtest',      require('./src/routes/backtestRoutes'));
app.use('/api/signals',       require('./src/routes/signalsRoutes'));
app.use('/api/trader',        require('./src/routes/traderProfileRoutes'));
app.use('/api/support',       require('./src/routes/supportRoutes'));
app.use('/api/health',        require('./src/routes/healthRoutes'));
app.use('/api/notes',         require('./src/routes/noteRoutes'));
app.use('/api',               require('./src/routes/contractRoutes'));
app.use(notFound);
app.use(errorHandler);

server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE' && SHOULD_AUTO_FALLBACK_PORT) {
        const nextPort = currentPort + 1;
        logger.warn(`Port ${currentPort} is in use. Retrying on port ${nextPort}.`);
        currentPort = nextPort;
        setTimeout(() => {
            server.listen(currentPort);
        }, 150);
        return;
    }

    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
});

server.on('listening', () => {
    logger.info(`Server running on http://localhost:${currentPort}`);
});

const startServer = async () => {
    const dbConnected = await connectDB();

    if (dbConnected) {
        maybeStartAlertEngine();
        
        // Start the incremental data update cron job
        try {
            dataUpdateCron.start();
            logger.info('Data update cron job initialized');
        } catch (error) {
            logger.error('Failed to start data update cron:', error);
        }

        // Start smart refresh service
        try {
            smartRefreshService.start();
            logger.info('Smart refresh service initialized');
        } catch (error) {
            logger.error('Failed to start smart refresh:', error);
        }

        // Start fundamentals refresh cron (seeds DB on first boot, nightly thereafter)
        try {
            await startFundamentalsRefreshCron();
            logger.info('Fundamentals refresh cron initialized');
        } catch (error) {
            logger.error('Failed to start fundamentals cron:', error);
        }
    } else {
        logger.warn('Skipping Alert Engine startup until MongoDB becomes available.');
        scheduleDbReconnect();
    }

    server.listen(currentPort);
};

startServer();
