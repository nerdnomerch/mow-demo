import Phaser from "phaser";
import { io, Socket } from "socket.io-client";
import { LocalPlayer, Player } from "../entities/Player";
import { Enemy } from "../entities/Enemy";

interface PlayerData {
  playerId: string;
  position: { x: number; y: number };
  level: number;
  exp: number;
  direction: string;
  action: string;
}

interface EnemyData {
  id: string;
  position: { x: number; y: number };
  health: number;
  direction: string;
  action: string;
}

interface GameState {
  players: { [key: string]: PlayerData };
  enemies: { [key: string]: EnemyData };
}

export class MainScene extends Phaser.Scene {
  private socket: Socket;
  private playerId: string;
  private player!: Player;
  private players: { [key: string]: Player } = {};
  private enemies: { [key: string]: Enemy } = {};
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private chatWindow!: HTMLDivElement;
  private chatInput!: HTMLInputElement;
  private currentInputs: { [key: string]: boolean } = {};
  private isCameraTweening: boolean = false;

  private map!: Phaser.Tilemaps.Tilemap;
  private tilesets!: Phaser.Tilemaps.Tileset[];

  private tilesetAnimations: {
    [key: number]: { frames: number[]; durations: number[] };
  } = {};
  private animatedTiles: {
    layer: Phaser.Tilemaps.TilemapLayer;
    tile: Phaser.Tilemaps.Tile;
    animation: { frames: number[]; durations: number[] };
    currentFrame: number;
    timeElapsed: number;
  }[] = [];

  constructor() {
    super({ key: "MainScene" });
    this.playerId = localStorage.getItem("playerId") || this.generateUUID();
    localStorage.setItem("playerId", this.playerId);

    this.socket = io(
      import.meta.env.VITE_BACKEND_URL || "http://localhost:3000",
      {
        autoConnect: false,
      }
    );
  }

  preload() {}

  create() {
    this.scene.launch("UIScene");
    this.chatWindow = document.getElementById("chat-window") as HTMLDivElement;
    this.chatInput = document.getElementById("chat-input") as HTMLInputElement;

    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    this.chatInput.addEventListener("keyup", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const message = this.chatInput.value;
        if (message.trim() !== "") {
          this.socket.emit("chatMessage", message);
          this.chatInput.value = "";
        }
      }
    });

    this.map = this.make.tilemap({ key: "map" });
    this.tilesets = [
      this.map.addTilesetImage("plains", "tiles", 16, 16)!,
      this.map.addTilesetImage("grass", "grass", 16, 16)!,
      this.map.addTilesetImage("water-sheet", "water-sheet", 16, 16)!,
      this.map.addTilesetImage("objects", "objects", 16, 16)!,
    ];

    // Parse and store animations
    this.parseTilesetAnimations();

    // Create tilemap layers
    this.map.layers.forEach((layerData) => {
      const layer = this.map.createLayer(layerData.name, this.tilesets, 0, 0)!;
      if (
        layerData.properties?.find((prop: any) => prop.name === "foreground")
      ) {
        layer.setDepth(2);
      }

      // Handle animated tiles
      // Animated tiles will be set up after all layers are created
    });

    // Setup animated tiles after layers are created
    this.setupAnimatedTiles();

    this.setupSocketEvents();
    this.socket.connect();

    this.cameras.main.setZoom(2.75);

    // Setup resize listener
    this.setupResizeListener();
  }

  update(_time: number, delta: number) {
    if (this.player) {
      let direction = this.player.currentDirection;
      if (this.cursors) {
        this.currentInputs.left = this.cursors.left.isDown;
        this.currentInputs.right = this.cursors.right.isDown;
        this.currentInputs.up = this.cursors.up.isDown;
        this.currentInputs.down = this.cursors.down.isDown;
      }
      const isAttacking = this.input.keyboard?.checkDown(
        this.cursors.space,
        250
      );
      const isWalking = Object.values(this.currentInputs).some(
        (value) => value === true
      );

      if (isAttacking) {
        this.socket.emit("playerInput", {
          ...this.currentInputs,
          direction,
          action: "attack",
        });
      } else if (isWalking) {
        // Determine direction based on input
        if (this.currentInputs.up) {
          direction = "up";
        } else if (this.currentInputs.down) {
          direction = "down";
        } else if (this.currentInputs.left) {
          direction = "left";
        } else if (this.currentInputs.right) {
          direction = "right";
        }

        this.socket.emit("playerInput", {
          ...this.currentInputs,
          direction,
          action: "walk",
        });
      } else {
        this.socket.emit("playerInput", {
          ...this.currentInputs,
          direction,
          action: "idle",
        });
      }

      // Check if camera needs to recenter
      this.handleCameraMovement();
    }

    // Update enemies
    for (const id in this.enemies) {
      this.enemies[id].interpolate();
    }

    // Handle animated tiles
    this.animatedTiles.forEach((animatedTile) => {
      animatedTile.timeElapsed += delta;

      const currentDuration =
        animatedTile.animation.durations[animatedTile.currentFrame];
      if (animatedTile.timeElapsed >= currentDuration) {
        animatedTile.timeElapsed -= currentDuration;
        animatedTile.currentFrame =
          (animatedTile.currentFrame + 1) %
          animatedTile.animation.frames.length;
        animatedTile.tile.index =
          animatedTile.animation.frames[animatedTile.currentFrame];
        animatedTile.layer.putTileAt(
          animatedTile.tile.index,
          animatedTile.tile.x,
          animatedTile.tile.y
        );
      }
    });
  }

  private setupResizeListener() {
    this.scale.on("resize", this.onResize, this);
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const { width, height } = gameSize;

    // Update deadzone based on new game size
    const deadzoneWidth = width / 5;
    const deadzoneHeight = height / 5;
    this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);
  }

  private handleCameraMovement() {
    if (!this.player || this.isCameraTweening) return;

    const camera = this.cameras.main;
    const player = this.player.sprite;

    const deadzone = camera.deadzone;
    if (!deadzone) return;

    // Calculate deadzone boundaries
    const deadzoneX = camera.scrollX + (camera.width - deadzone.width) / 2;
    const deadzoneY = camera.scrollY + (camera.height - deadzone.height) / 2;

    // Check if player is outside the deadzone
    if (
      player.x < deadzoneX ||
      player.x > deadzoneX + deadzone.width ||
      player.y < deadzoneY ||
      player.y > deadzoneY + deadzone.height
    ) {
      // Start tween to recenter camera on player
      this.isCameraTweening = true;

      this.tweens.add({
        targets: camera,
        scrollX: player.x - camera.width / 2,
        scrollY: player.y - camera.height / 2,
        ease: "Sine.easeInOut",
        duration: 500, // Duration in milliseconds
        onComplete: () => {
          this.isCameraTweening = false;
        },
      });
    }
  }

  private setupSocketEvents() {
    // Attach the connect event listener
    this.socket.on("connect", () => {
      console.log("Connected to server with ID:", this.socket.id);
      this.socket.emit("init", { playerId: this.playerId });
    });

    this.socket.on(
      "init",
      (data: {
        playerData: PlayerData;
        players: { [key: string]: PlayerData };
        enemies: { [key: string]: EnemyData };
      }) => {
        this.updateGameState({ players: data.players, enemies: data.enemies });
      }
    );

    this.socket.on("playerJoined", (playerData: PlayerData) => {
      if (!this.players[playerData.playerId]) {
        this.createOtherPlayer(playerData);
      }
    });

    this.socket.on("playerLeft", (leftPlayerId: string) => {
      if (this.players[leftPlayerId]) {
        this.players[leftPlayerId].destroy();
        delete this.players[leftPlayerId];
      }
    });

    this.socket.on("gameState", (state: GameState) => {
      this.updateGameState(state);
    });

    this.socket.on("levelUp", () => {
      const congratsText = this.add
        .text(
          Number(this.game.config.width) / 2,
          Number(this.game.config.height) / 2,
          "Congratulations! Level Up!",
          {
            fontSize: "32px",
            color: "#fff",
          }
        )
        .setScale(1 / this.cameras.main.zoom)
        .setScrollFactor(0)
        .setDepth(5)
        .setOrigin(0.5);
      this.time.delayedCall(2000, () => {
        congratsText.destroy();
      });
    });

    this.socket.on("chatMessage", (data: { id: string; message: string }) => {
      const messageElement = document.createElement("div");
      messageElement.textContent = `Player ${data.id}: ${data.message}`;
      this.chatWindow.appendChild(messageElement);
      this.chatWindow.scrollTop = this.chatWindow.scrollHeight;
    });

    this.socket.on("disconnect", (reason) => {
      console.warn("Disconnected from server:", reason);
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`Attempting to reconnect... (${attemptNumber})`);
    });
  }

  private createPlayer(playerData: PlayerData) {
    this.player = new LocalPlayer(this, this.socket, playerData);
    this.players[this.playerId] = this.player;

    // Define deadzone dimensions based on current game size
    const { width, height } = this.scale.gameSize;
    const deadzoneWidth = width / 5;
    const deadzoneHeight = height / 5;

    // Set the deadzone
    this.cameras.main.setDeadzone(deadzoneWidth, deadzoneHeight);

    // Initially center the camera on the player
    this.cameras.main.centerOn(this.player.sprite.x, this.player.sprite.y);
  }

  private createOtherPlayer(playerData: PlayerData) {
    if (this.players[playerData.playerId]) return;
    const otherPlayer = new Player(this, this.socket, playerData);
    this.players[playerData.playerId] = otherPlayer;
  }

  private createEnemy(enemyData: EnemyData) {
    const enemy = new Enemy(this, enemyData);
    this.enemies[enemyData.id] = enemy;
  }

  private updateGameState(state: GameState) {
    // Update Players
    for (const id in state.players) {
      const serverPlayer = state.players[id];
      if (this.players[id]) {
        this.players[id].updatePosition(serverPlayer.position);
        this.players[id].updateDirection(serverPlayer.direction);
        this.players[id].updateAction(serverPlayer.action);
        this.players[id].playAnimation(serverPlayer.action);
        if (id === this.playerId) {
          this.players[id].updateExpBar(serverPlayer.exp, serverPlayer.level);
        }
      } else {
        if (id === this.playerId) {
          this.createPlayer(serverPlayer);
        } else {
          this.createOtherPlayer(serverPlayer);
        }
      }
    }

    for (const id in this.players) {
      if (!state.players[id]) {
        this.players[id].destroy();
        delete this.players[id];
      }
    }

    // Update Enemies
    for (const id in state.enemies) {
      const serverEnemy = state.enemies[id];
      if (this.enemies[id]) {
        this.enemies[id].updatePosition(serverEnemy.position);
        this.enemies[id].updateHealth(serverEnemy.health);
        this.enemies[id].playAnimation(
          serverEnemy.action,
          serverEnemy.direction
        );
      } else {
        this.createEnemy(serverEnemy);
      }
    }

    for (const id in this.enemies) {
      if (!state.enemies[id]) {
        this.enemies[id].die();
        delete this.enemies[id];
      }
    }
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  private parseTilesetAnimations() {
    (this.map.tilesets as any).forEach((tileset: any) => {
      for (const tileId in tileset.tileData) {
        const tile = tileset.tileData[tileId];

        if (tile.animation) {
          const frames = tile.animation.map(
            (anim: any) => anim.tileid + tileset.firstgid
          );
          const durations = tile.animation.map((anim: any) => anim.duration);
          this.tilesetAnimations[Number(tileId) + tileset.firstgid] = {
            frames,
            durations,
          };
        }
      }
    });
  }

  private setupAnimatedTiles() {
    this.map.layers.forEach((layerData) => {
      const layer = this.map.getLayer(layerData.name)?.tilemapLayer;
      if (layer) {
        layer.forEachTile((tile) => {
          if (tile && this.tilesetAnimations[tile.index]) {
            console.log(tile.index);
            this.animatedTiles.push({
              layer,
              tile,
              animation: this.tilesetAnimations[tile.index],
              currentFrame: 0,
              timeElapsed: 0,
            });
          }
        });
      }
    });
  }
}
