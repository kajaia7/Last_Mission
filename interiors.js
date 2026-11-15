const rooms = {
  base: { spawn: 54 },
  rocket: {
    spawn: 68, exit: 68,
    spriteHeight: 0.134,
    framing: { width: 0.33, height: 0.95, top: 0.025 },
    decks: {
      storage: {
        floor: 96, bounds: [38, 279],
        ceiling: [[38, 73], [68, 66], [255, 66], [279, 73]]
      },
      cabin: {
        floor: 59, bounds: [86, 236], pilotSeat: 106,
        ceiling: [[86, 38], [105, 29], [125, 24], [198, 24], [216, 29], [236, 38]]
      }
    },
    ladder: 198,
    cargo: 237
  },
  rover: {
    spawn: 56, exit: 56, driverSeat: 235, floor: 88, bounds: [31, 274],
    spriteHeight: 0.245,
    ceiling: [[31, 32], [50, 27], [170, 30], [220, 35], [244, 39], [260, 46], [274, 53]],
    framing: { width: 0.78, height: 0.895, top: 0.045 }
  }
};
