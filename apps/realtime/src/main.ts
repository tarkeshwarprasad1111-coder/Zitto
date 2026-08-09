import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import 'dotenv/config';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
});

const PORT = Number(process.env.REALTIME_PORT ?? 4001);
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

if (!ACCESS_SECRET) {
  throw new Error('JWT_ACCESS_SECRET is required');
}

const ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',');

interface AuthedSocket extends Socket {
  userId?: string;
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
});

// Two connections: one publishes, one subscribes. The adapter needs both
// so broadcasts reach clients attached to any replica.
const pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

io.use((socket: AuthedSocket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error('Authentication required'));

  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { sub?: string };
    if (!payload.sub) return next(new Error('Invalid token'));
    socket.userId = payload.sub;
    return next();
  } catch {
    return next(new Error('Invalid token'));
  }
});

// Per-socket message budget so one client cannot flood a room.
const RATE_LIMIT = { windowMs: 10_000, maxEvents: 60 };
const buckets = new Map<string, { count: number; resetAt: number }>();

function withinBudget(socketId: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(socketId);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(socketId, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT.maxEvents;
}

io.on('connection', (socket: AuthedSocket) => {
  logger.debug({ socketId: socket.id, userId: socket.userId }, 'client connected');
  socket.join(`user:${socket.userId}`);

  socket.on('room:join', (data: { roomId?: string }) => {
    if (!withinBudget(socket.id)) {
      socket.emit('error', { message: 'Too many requests' });
      return;
    }
    if (!data?.roomId) return;
    void socket.join(`room:${data.roomId}`);
    socket.emit('room:joined', { roomId: data.roomId });
  });

  socket.on('room:leave', (data: { roomId?: string }) => {
    if (!data?.roomId) return;
    void socket.leave(`room:${data.roomId}`);
  });

  socket.on('disconnect', () => {
    buckets.delete(socket.id);
  });
});

// The game engine is the only producer of these events.
const eventSubscriber = pubClient.duplicate();
void eventSubscriber.subscribe('game:events', (err) => {
  if (err) logger.error({ err }, 'failed to subscribe to game:events');
  else logger.info('subscribed to game:events');
});

eventSubscriber.on('message', (_channel, message) => {
  try {
    const event = JSON.parse(message) as {
      type: string;
      roomId: string;
      roundId: string;
      payload: Record<string, unknown>;
    };
    io.to(`room:${event.roomId}`).emit(event.type, {
      roundId: event.roundId,
      ...event.payload,
    });
  } catch (error) {
    logger.error({ err: error }, 'malformed game event');
  }
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'realtime service listening');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  io.close();
  httpServer.close();
  await Promise.allSettled([
    pubClient.quit(),
    subClient.quit(),
    eventSubscriber.quit(),
  ]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
