import express from "express";
import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { MongoClient, Db } from "mongodb";
import path from "path";
import { Player, PlayerData, PlayerDocument } from "./entities/Player";
import { Enemy, EnemyData } from "./entities/Enemy";
import { MapLoader } from "./MapLoader"; // Import MapLoader

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
let db: Db;

MongoClient.connect(mongoUrl)
  .then((client) => {
    db = client.db("mmorpg");
    console.log("Connected to MongoDB");
    spawnEnemies(); // Ensure enemies are spawned after DB connection
  })
  .catch((err) => console.error(err));

// Serve static files from the Vite build directory
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Game constants
export const TICK_RATE = 20; // Server updates 20 times per second
const TICK_INTERVAL = 1000 / TICK_RATE;
const MAX_ENEMIES = 5;

// Game state
export const players: { [key: string]: Player } = {};
const enemies: { [key: string]: Enemy } = {};

// Mappings between socket IDs and player IDs
const socketIdToPlayerId: { [key: string]: string } = {};
const playerIdToSocketId: { [key: string]: string } = {};

// Spawn initial enemies
function spawnEnemies() {
  const aliveEnemies = Object.values(enemies).filter((enemy) => enemy.alive);
  const enemiesToSpawn = MAX_ENEMIES - aliveEnemies.length;

  for (let i = 0; i < enemiesToSpawn; i++) {
    const enemy = new Enemy();
    enemies[enemy.id] = enemy;
  }
}

// Socket.io connection
io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);

  // Initialize player
  socket.on("init", async (data: { playerId: string }) => {
    const { playerId } = data;

    socketIdToPlayerId[socket.id] = playerId;
    playerIdToSocketId[playerId] = socket.id;

    let playerDocument: PlayerDocument | null = await db
      .collection<PlayerDocument>("players")
      .findOne({ playerId });

    let playerData: PlayerData;

    if (!playerDocument) {
      const newPlayerData: PlayerData = {
        playerId,
        position: { x: 300, y: 200 },
        level: 1,
        exp: 0,
        health: 100,
        socketId: socket.id,
        direction: "right",
        action: "idle",
      };
      await db.collection<PlayerData>("players").insertOne(newPlayerData);
      playerData = newPlayerData;
    } else {
      // Update socketId in the existing document
      await db
        .collection<PlayerDocument>("players")
        .updateOne({ playerId }, { $set: { socketId: socket.id } });
      // Extract PlayerData from PlayerDocument
      const { _id, ...dataWithoutId } = playerDocument;
      playerData = dataWithoutId;
    }

    const player = new Player(playerData);
    players[playerId] = player;

    // Prepare alive enemies data to send to the client
    const aliveEnemies: { [key: string]: EnemyData } = {};
    for (const enemy of Object.values(enemies)) {
      if (enemy.alive) {
        aliveEnemies[enemy.id] = {
          id: enemy.id,
          position: enemy.position,
          health: enemy.health,
          direction: enemy.direction,
          action: enemy.action,
        };
      }
    }

    socket.emit("init", { playerData, players, enemies: aliveEnemies });

    // Notify other clients about the new player
    socket.broadcast.emit("playerJoined", playerData);
  });

  // Collect player input without processing immediately
  socket.on(
    "playerInput",
    (
      input: Partial<{
        left: boolean;
        right: boolean;
        up: boolean;
        down: boolean;
        direction: string;
        action: string;
      }>
    ) => {
      const playerId = socketIdToPlayerId[socket.id];
      if (playerId && players[playerId]) {
        const player = players[playerId];
        player.setInput(input);
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const playerId = socketIdToPlayerId[socket.id];
    if (playerId) {
      delete players[playerId];
      delete socketIdToPlayerId[socket.id];
      delete playerIdToSocketId[playerId];
      socket.broadcast.emit("playerLeft", playerId);
    }
  });

  socket.on("chatMessage", (msg: string) => {
    const playerId = socketIdToPlayerId[socket.id];
    io.emit("chatMessage", { id: playerId, message: msg });
  });
});

const mapLoader = new MapLoader("artifacts/maps/level.json"); // Adjust the path to your map file

let lastUpdateTime = Date.now();

function gameLoop() {
  const now = Date.now();
  const deltaTime = now - lastUpdateTime;
  lastUpdateTime = now;

  updateGameState(deltaTime);

  const state = getGameState();
  io.emit("gameState", state);

  spawnEnemies();
}

setInterval(gameLoop, TICK_INTERVAL);

function updateGameState(deltaTime: number) {
  for (const playerId in players) {
    const player = players[playerId];
    if (player.isAttacking()) {
      handleAttack(playerId);
    }
    player.processInput(mapLoader); // Pass mapLoader for collision detection
  }

  // Update Enemies Behavior
  for (const enemy of Object.values(enemies)) {
    if (enemy.alive) {
      enemy.findTarget(players);
      enemy.performAction(players);
      enemy.move(deltaTime);
    }
  }
}

function handleAttack(playerId: string) {
  const player = players[playerId];
  if (!player) return;

  let closestEnemy: Enemy | null = null;
  let minDistance = Infinity;

  for (const enemy of Object.values(enemies)) {
    if (!enemy.alive) continue;
    const distance = getDistance(player.position, enemy.position);
    if (distance < minDistance && distance < 50) {
      minDistance = distance;
      closestEnemy = enemy;
    }
  }

  if (closestEnemy) {
    const isDead = closestEnemy.takeDamage(10);
    if (isDead) {
      const leveledUp = player.gainExp(50);
      if (leveledUp) {
        const socketId = playerIdToSocketId[playerId];
        if (socketId) {
          io.to(socketId).emit("levelUp", player.level);
        }
      }
      // Update player data in the database
      db.collection<PlayerData>("players").updateOne(
        { playerId },
        { $set: { exp: player.exp, level: player.level } }
      );
      delete enemies[closestEnemy.id];
    }
  }
}

function getGameState() {
  const simplifiedPlayers: { [key: string]: PlayerData } = {};
  for (const playerId in players) {
    const player = players[playerId];
    simplifiedPlayers[playerId] = {
      playerId: player.playerId,
      position: player.position,
      level: player.level,
      exp: player.exp,
      direction: player.direction,
      action: player.action,
      health: player.health,
      socketId: player.socketId,
    };
  }

  const simplifiedEnemies: { [key: string]: EnemyData } = {};
  for (const enemy of Object.values(enemies)) {
    if (enemy.alive) {
      simplifiedEnemies[enemy.id] = {
        id: enemy.id,
        position: enemy.position,
        health: enemy.health,
        direction: enemy.direction,
        action: enemy.action,
      };
    }
  }

  return { players: simplifiedPlayers, enemies: simplifiedEnemies };
}

function getDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
