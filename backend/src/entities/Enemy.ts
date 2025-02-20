import { v4 as uuidv4 } from "uuid";
import { Player } from "./Player";
import { players } from "../server";

export interface EnemyData {
  id: string;
  position: { x: number; y: number };
  health: number;
  direction: string;
  action: string;
}

type ActionType = "hop" | "longJump" | "idle" | "confused";

export class Enemy {
  id: string;
  position: { x: number; y: number };
  health: number;
  alive: boolean;
  velocity: { x: number; y: number };
  direction: string;
  action: ActionType;
  targetPlayerId: string | null = null;
  lastMovement: ActionType | null = null;

  // New properties for managing action cycles
  private actionCycle: ActionType[] = [
    "hop",
    "idle",
    "longJump",
    "idle",
    "idle",
  ];
  private currentActionIndex: number = 0;
  private actionTimer: number = 0; // in milliseconds

  // Configuration for movement distances and pause durations
  private readonly HOP_DISTANCE = 10;
  private readonly LONG_JUMP_DISTANCE = 60;
  private readonly PAUSE_DURATION = 1000;
  private readonly MOVE_DURATION = 1000;
  private readonly LONG_JUMP_DURATION = 600;

  constructor() {
    this.id = uuidv4();
    this.position = { x: Math.random() * 800, y: Math.random() * 600 };
    this.health = 30;
    this.alive = true;
    this.velocity = { x: 0, y: 0 };
    this.direction = "down";
    this.action = "idle";
  }

  move(deltaTime: number) {
    if (!this.alive) return;

    // Update position based on current velocity
    const deltaSeconds = deltaTime / 1000;
    this.position.x += this.velocity.x * deltaSeconds;
    this.position.y += this.velocity.y * deltaSeconds;

    // Clamp position within boundaries
    this.position.x = Math.max(0, Math.min(800, this.position.x));
    this.position.y = Math.max(0, Math.min(600, this.position.y));

    // Update action timer
    this.actionTimer -= deltaTime;

    if (this.actionTimer <= 0) {
      this.currentActionIndex =
        (this.currentActionIndex + 1) % this.actionCycle.length;
      const nextAction = this.actionCycle[this.currentActionIndex];
      this.executeAction(nextAction);
    }
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    if (this.health <= 0) {
      this.alive = false;
      return true;
    }
    this.velocity = { x: 0, y: 0 };
    this.action = "confused";
    this.actionTimer = this.PAUSE_DURATION;
    return false;
  }

  /**
   * Finds the closest target player within detection radius.
   */
  findTarget(players: { [key: string]: Player }): void {
    if (this.targetPlayerId && players[this.targetPlayerId]?.isAlive) return;

    let closestPlayerId: string | null = null;
    let minDistance = Infinity;
    const detectionRadius = 50;

    for (const playerId in players) {
      const player = players[playerId];
      const distance = this.getDistance(this.position, player.position);
      if (distance < minDistance && distance <= detectionRadius) {
        minDistance = distance;
        closestPlayerId = playerId;
      }
    }

    if (closestPlayerId) {
      this.targetPlayerId = closestPlayerId;
      this.currentActionIndex = -1; // Start cycle from the first action
      this.executeNextAction();
    }
  }

  /**
   * Executes the next action in the cycle.
   */
  performAction(players: { [key: string]: Player }): void {
    if (!this.targetPlayerId) return;

    const target = players[this.targetPlayerId];
    if (!target || !target.isAlive) {
      this.targetPlayerId = null;
      this.action = "idle";
      this.velocity = { x: 0, y: 0 };
      return;
    }
  }

  /**
   * Executes a specific action based on the action type.
   */
  private executeAction(action: ActionType) {
    switch (action) {
      case "hop":
        this.setMovement("hop");
        break;
      case "longJump":
        this.setMovement("longJump");
        break;
      case "idle":
        this.velocity = { x: 0, y: 0 };
        this.action = "idle";
        this.actionTimer = this.PAUSE_DURATION;
        break;
      default:
        this.velocity = { x: 0, y: 0 };
        this.action = "idle";
        break;
    }
  }

  /**
   * Executes the next action in the cycle.
   */
  private executeNextAction() {
    this.currentActionIndex =
      (this.currentActionIndex + 1) % this.actionCycle.length;
    const nextAction = this.actionCycle[this.currentActionIndex];
    this.executeAction(nextAction);
  }

  /**
   * Sets the velocity based on the movement type towards the target position.
   */
  private setMovement(movementType: "hop" | "longJump") {
    if (!this.targetPlayerId) return;

    const target = players[this.targetPlayerId];
    if (!target) return;

    const targetPos = target.position;
    const dx = targetPos.x - this.position.x;
    const dy = targetPos.y - this.position.y;
    const angle = Math.atan2(dy, dx);

    // Determine direction based on angle
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? "right" : "left";
    } else {
      this.direction = dy > 0 ? "down" : "up";
    }

    // Set distance based on movement type
    let distance, duration;
    if (movementType === "hop") {
      distance = this.HOP_DISTANCE;
      duration = this.MOVE_DURATION;
    } else {
      distance = this.LONG_JUMP_DISTANCE;
      duration = this.LONG_JUMP_DURATION;
    }
    const speed = distance / (duration / 1000); // distance per second

    this.velocity.x = Math.cos(angle) * speed;
    this.velocity.y = Math.sin(angle) * speed;

    // Set timer for movement duration
    this.actionTimer = duration;
    this.action = movementType;
  }

  private getDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
