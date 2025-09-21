import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  socket: any;
  
  constructor(socket: any) {
    super({ key: "GameScene" });
    this.socket = socket;
  }

  preload() {
    this.load.image("card_back", "/assets/card-back.png");
  }

  create() {
    this.add.text(10, 10, "Waiting for server game state...", { color: "#ffffff" });

    this.socket.on("game_started", (state: any) => {
      this.add.text(10, 40, `Game started. Lobby: ${state.lobbyId}`, { color: "#ffffff" });
      this.add.image(200, 200, "card_back").setScale(0.5);
    });

    this.socket.on("game_update", (state: any) => {
      console.log("game_update", state);
    });
  }
}