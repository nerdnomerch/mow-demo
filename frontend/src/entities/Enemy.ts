import Phaser from "phaser";

interface EnemyData {
  id: string;
  position: { x: number; y: number };
  health: number;
  direction: string;
  action: string;
}

export class Enemy {
  private scene: Phaser.Scene;
  public sprite: Phaser.GameObjects.Sprite;
  public healthBarForeground: Phaser.GameObjects.Rectangle;
  private healthBarBackground: Phaser.GameObjects.Rectangle;
  private healthBarBorder: Phaser.GameObjects.Graphics;
  public maxHealth: number;
  public isAlive: boolean = true;
  private targetPosition: { x: number; y: number };
  public currentHealth: number;
  public direction: string;
  public action: string;
  private hideHealthBarTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, enemyData: EnemyData) {
    this.scene = scene;
    this.maxHealth = enemyData.health;
    this.targetPosition = { ...enemyData.position };
    this.currentHealth = enemyData.health;
    this.direction = enemyData.direction;
    this.action = enemyData.action;

    this.sprite = this.scene.add.sprite(
      enemyData.position.x,
      enemyData.position.y,
      "slime"
    );
    this.playAnimation(this.action, this.direction);

    // Create Health Bar Background (Full Health with Low Opacity)
    this.healthBarBackground = this.scene.add.rectangle(
      this.sprite.x,
      this.sprite.y - 35, // Adjusted Y position for visuals
      40,
      3, // Slimmer height
      0x000000, // Black color for max health indicator
      0.2 // Low opacity
    );
    this.healthBarBackground.setOrigin(0.5, 0.5);
    this.healthBarBackground.setVisible(false); // Initially hidden

    // Create Health Bar Foreground (Current Health)
    this.healthBarForeground = this.scene.add.rectangle(
      this.sprite.x,
      this.sprite.y - 35, // Same Y position as background
      40,
      3, // Slimmer height
      0x1b572d, // Initial color (Green)
      1 // Full opacity
    );
    this.healthBarForeground.setOrigin(0.5, 0.5);
    this.healthBarForeground.setVisible(false); // Initially hidden

    // Create Health Bar Border
    this.healthBarBorder = this.scene.add.graphics();
    this.healthBarBorder.lineStyle(1, 0x000000, 1); // Black border with 1px thickness
    this.healthBarBorder.strokeRect(
      this.healthBarBackground.x - this.healthBarBackground.width / 2 - 1,
      this.healthBarBackground.y - this.healthBarBackground.height / 2 - 1,
      this.healthBarBackground.width + 2,
      this.healthBarBackground.height + 2
    );
    this.healthBarBorder.setVisible(false); // Initially hidden
  }

  public static createAnimations(scene: Phaser.Scene) {
    const animConfig = [
      { key: "enemy_idle_down", start: 0, end: 3 },
      { key: "enemy_idle_right", start: 7, end: 10 },
      { key: "enemy_idle_left", start: 7, end: 10 },
      { key: "enemy_idle_up", start: 14, end: 17 },
      { key: "enemy_hop_down", start: 21, end: 26 },
      { key: "enemy_hop_right", start: 28, end: 33 },
      { key: "enemy_hop_left", start: 28, end: 33 },
      { key: "enemy_hop_up", start: 35, end: 40 },
      { key: "enemy_longJump_down", start: 42, end: 48 },
      { key: "enemy_longJump_right", start: 49, end: 55 },
      { key: "enemy_longJump_left", start: 49, end: 55 },
      { key: "enemy_longJump_up", start: 56, end: 62 },
      { key: "enemy_confused_down", start: 63, end: 65 },
      { key: "enemy_confused_right", start: 70, end: 72 },
      { key: "enemy_confused_left", start: 70, end: 72 },
      { key: "enemy_confused_up", start: 77, end: 80 },
      { key: "enemy_dying", start: 84, end: 88 },
    ];

    animConfig.forEach((anim) => {
      scene.anims.create({
        key: anim.key,
        frames: scene.anims.generateFrameNumbers("slime", {
          start: anim.start,
          end: anim.end,
        }),
        frameRate: 10,
        repeat: anim.key !== "enemy_dying" ? -1 : 0,
      });
    });
  }

  updatePosition(position: { x: number; y: number }) {
    this.targetPosition = position;
  }

  updateHealth(health: number) {
    if (health !== this.currentHealth) {
      this.showHealthBar();
    }
    this.currentHealth = health;
    const healthPercentage = this.currentHealth / this.maxHealth;
    this.healthBarForeground.width = healthPercentage * 40;

    // Update Health Bar Color Based on Health Percentage
    if (healthPercentage > 0.5) {
      this.healthBarForeground.setFillStyle(0x00ff00, 1); // Green
    } else if (healthPercentage > 0.2) {
      this.healthBarForeground.setFillStyle(0xffff00, 1); // Yellow
    } else {
      this.healthBarForeground.setFillStyle(0xff0000, 1); // Red
    }
  }

  private showHealthBar() {
    this.healthBarBackground.setVisible(true);
    this.healthBarForeground.setVisible(true);
    this.healthBarBorder.setVisible(true);

    // If there's an existing timer, remove it
    if (this.hideHealthBarTimer) {
      this.hideHealthBarTimer.remove(false);
    }

    // Start a new timer to hide the health bar after 3 seconds
    this.hideHealthBarTimer = this.scene.time.delayedCall(
      3000,
      () => {
        this.healthBarBackground.setVisible(false);
        this.healthBarForeground.setVisible(false);
        this.healthBarBorder.setVisible(false);
        this.hideHealthBarTimer = null;
      },
      [],
      this
    );
  }

  interpolate() {
    const t = 0.1;
    this.sprite.x = Phaser.Math.Linear(this.sprite.x, this.targetPosition.x, t);
    this.sprite.y = Phaser.Math.Linear(this.sprite.y, this.targetPosition.y, t);
    this.healthBarBackground.x = this.sprite.x;
    this.healthBarBackground.y = this.sprite.y - 35;
    this.healthBarForeground.x = this.sprite.x;
    this.healthBarForeground.y = this.sprite.y - 35;

    // Update Border Position
    this.healthBarBorder.clear();
    this.healthBarBorder.lineStyle(1, 0x000000, 1);
    this.healthBarBorder.strokeRect(
      this.healthBarBackground.x - this.healthBarBackground.width / 2 - 1,
      this.healthBarBackground.y - this.healthBarBackground.height / 2 - 1,
      this.healthBarBackground.width + 2,
      this.healthBarBackground.height + 2
    );
  }

  playAnimation(action: string, direction: string) {
    this.action = action;
    if (direction !== this.direction) {
      if (direction === "left") {
        this.sprite.setFlipX(true);
      } else {
        this.sprite.setFlipX(false);
      }
    }
    if (action === "confused") {
      this.sprite.setTint(0xff3333);
    } else if (action === "longJump") {
      // make the enemy a little more blue
      this.sprite.setTint(0x3333ff);
    } else {
      this.sprite.clearTint();
    }
    this.direction = direction;
    const animKey = `enemy_${action}_${direction}`;
    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.play(animKey);
    }
  }

  die() {
    this.healthBarForeground.destroy();
    this.healthBarBackground.destroy();
    this.healthBarBorder.destroy();
    this.sprite.clearTint();
    this.sprite.play("enemy_dying");
    this.sprite.once("animationcomplete", () => {
      this.sprite.destroy();
    });
  }
}
