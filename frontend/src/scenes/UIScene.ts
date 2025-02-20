// UIScene.ts
import Phaser from "phaser";

export class UIScene extends Phaser.Scene {
  private uiContainer!: Phaser.GameObjects.Container;
  private expBarBackground!: Phaser.GameObjects.Rectangle;
  private expBarFill!: Phaser.GameObjects.Rectangle;
  private expLabel!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "UIScene" });
  }

  create() {
    this.uiContainer = this.add.container(10, 10).setScrollFactor(0);

    // Initialize Level Text
    this.levelText = this.add
      .text(0, 0, `Level: 0`, {
        fontSize: "12px",
        color: "#ffffff",
        padding: { x: 5, y: 5 },
      })
      .setOrigin(0, 0);

    this.uiContainer.add(this.levelText);

    const padding = 10;
    const levelTextWidth = this.levelText.width;

    // EXP Bar Background
    this.expBarBackground = this.add
      .rectangle(levelTextWidth + padding, 4, 200, 12, 0x808080)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xffffff);
    this.uiContainer.add(this.expBarBackground);

    // EXP Bar Fill
    this.expBarFill = this.add
      .rectangle(levelTextWidth + padding + 2, 6, (196 * 0) / 100, 8, 0x00ff00)
      .setOrigin(0, 0);
    this.uiContainer.add(this.expBarFill);

    // EXP Label
    this.expLabel = this.add
      .text(levelTextWidth + padding + 100, 22, `${0}/${0 * 100} (0%)`, {
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
        padding: { x: 5, y: 0 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.uiContainer.add(this.expLabel);
  }

  updateExpBar(exp: number, level: number): void {
    // Update Level Text
    this.levelText.setText(`Level: ${level}`);

    // Calculate EXP percentage
    const expPercentage = Math.min(
      Math.floor((exp / (level * 100)) * 100),
      100
    );

    // Update EXP Fill Width
    this.expBarFill.width = 196 * (expPercentage / 100);

    // Update EXP Label
    this.expLabel.setText(`${exp}/${level * 100} (${expPercentage}%)`);
  }
}
