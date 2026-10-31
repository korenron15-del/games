// Games server for Cloudflare Workers (free plan). Shared by all online games in this repo.
// Static files come from ./public. /ws?g=GAME&r=ROOM opens a WebSocket into a Durable Object
// (one per room) that relays each player's "presence" to everyone else in that room.

const MAX_PLAYERS = 16;        // per room; the game opens public2, public3... when full
const MAX_MSG = 20000;         // bytes

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      // g = which game (each game gets its own rooms), r = room name inside that game
      const game = (url.searchParams.get('g') || 'x').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 16) || 'x';
      const room = (url.searchParams.get('r') || 'public').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'public';
      const stub = env.ROOMS.get(env.ROOMS.idFromName(game + ':' + room));
      return stub.fetch(req);
    }
    return env.ASSETS.fetch(req);
  }
};

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.p = new Map(); // player id -> merged presence (rebuilt from client resyncs after hibernation)
  }

  sockets() {
    const m = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (a && a.id) m.set(a.id, ws);
    }
    return m;
  }

  async fetch(req) {
    const url = new URL(req.url);
    let id = (url.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
    if (id.length < 6) id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    const cur = this.sockets();
    const old = cur.get(id);                 // same player reconnecting: drop the stale socket
    if (old) { try { old.serializeAttachment({ id: null }); old.close(4000, 'replaced'); } catch (e) {} cur.delete(id); }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    if (cur.size >= MAX_PLAYERS) {
      server.serializeAttachment({ id: null });
      server.send('{"t":"full"}');
      server.close(4001, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }

    server.serializeAttachment({ id });
    const peers = {};
    for (const [pid] of cur) peers[pid] = this.p.get(pid) || {};
    this.p.set(id, {});
    server.send(JSON.stringify({ t: 'hello', id, peers }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, msg) {
    if (typeof msg !== 'string' || msg.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(msg); } catch (e) { return; }
    if (!m || m.t !== 'p' || !m.d || typeof m.d !== 'object' || Array.isArray(m.d)) return;
    const a = ws.deserializeAttachment();
    if (!a || !a.id) return;
    const cur = this.p.get(a.id) || {};
    Object.assign(cur, m.d);
    this.p.set(a.id, cur);
    const out = JSON.stringify({ t: 'p', id: a.id, d: m.d });
    for (const o of this.ctx.getWebSockets()) {
      if (o === ws) continue;
      const b = o.deserializeAttachment();
      if (!b || !b.id) continue;
      try { o.send(out); } catch (e) {}
    }
  }

  webSocketClose(ws, code) { this.gone(ws); try { ws.close(1000, 'bye'); } catch (e) {} }
  webSocketError(ws) { this.gone(ws); }

  gone(ws) {
    const a = ws.deserializeAttachment();
    if (!a || !a.id) return;
    for (const o of this.ctx.getWebSockets()) {
      if (o === ws) continue;
      const b = o.deserializeAttachment();
      if (b && b.id === a.id) return; // replaced by a newer connection of the same player
    }
    this.p.delete(a.id);
    const out = JSON.stringify({ t: 'bye', id: a.id });
    for (const o of this.ctx.getWebSockets()) {
      if (o === ws) continue;
      const b = o.deserializeAttachment();
      if (!b || !b.id) continue;
      try { o.send(out); } catch (e) {}
    }
  }
}
