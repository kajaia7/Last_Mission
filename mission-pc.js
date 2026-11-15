(() => {
  const readings = {
    oxygen: {
      name: "Oxygen", icon: "O₂", start: 100,
      copy: "This shows how much oxygen the base has ready to use. Making more takes water and power."
    },
    water: {
      name: "Water", icon: "◈", start: 100,
      copy: "The crew needs water to drink, cook, and grow food. This reading shows the water currently available to the crew."
    },
    food: {
      name: "Food", icon: "✿", start: 100,
      copy: "Packed meals feed the crew while the greenhouse grows fresh food."
    },
    stamina: {
      name: "Crew energy", icon: "✚", start: 100,
      copy: "The crew uses energy doing jobs around the base. A break gives some back."
    },
    radiation: {
      name: "Radiation", icon: "◎", start: 0,
      copy: "The meter tracks radiation the crew has already received. Shielding slows future exposure."
    },
    battery: {
      name: "Battery reserve", icon: "ϟ", start: 100,
      copy: "The battery runs equipment when solar panels have less light. Save some charge for the next sol."
    },
    research: {
      name: "Research", icon: "▦", start: 0,
      copy: "Save and compare base readings so the crew can spot changes later."
    }
  };

  let selected = "water";
  const byId = id => document.getElementById(id);
  const tiles = new Map();
  const segments = [];

  function node(tag, contents, className) {
    const element = document.createElement(tag);
    if (contents) element.textContent = contents;
    if (className) element.className = className;
    return element;
  }

  function status(key) {
    const value = readings[key].start;
    if (key === "research") return ["Progress", "blue"];
    const low = key === "radiation" ? value >= 70 : value < (key === "water" ? 70 : 45);
    const urgent = key === "radiation" ? value >= 90 : value <= 20;
    return urgent ? ["Needs attention", "red"] : low ? ["Caution", "yellow"] : ["Stable", "green"];
  }

  function displayValue(key) {
    return readings[key].start + "%" + (key === "radiation" ? " of limit" : "");
  }

  function render() {
    for (const [key, tile] of tiles) {
      const [label, tone] = status(key);
      tile.root.dataset.tone = tone;
      tile.root.style.setProperty("--level", readings[key].start + "%");
      tile.root.setAttribute("aria-pressed", String(selected === key));
      tile.value.textContent = displayValue(key);
      tile.status.textContent = label;
    }
    byId("detail-title").textContent = readings[selected].name;
    byId("detail-copy").textContent = readings[selected].copy;
    byId("detail").dataset.tone = status(selected)[1];
    byId("instrument-label").textContent = status(selected)[0];
    byId("instrument-value").textContent = displayValue(selected);
    for (const [index, segment] of segments.entries()) {
      segment.classList.toggle("lit", index < Math.round(readings[selected].start / 5));
    }
  }

  for (const [key, reading] of Object.entries(readings)) {
    const root = node("button", "", "tile");
    root.type = "button";
    root.setAttribute("aria-controls", "detail");
    const name = node("span", reading.name, "tile-name");
    const icon = node("span", reading.icon, "tile-icon");
    icon.setAttribute("aria-hidden", "true");
    const value = node("span", "", "tile-readout");
    const note = node("span", "", "tile-status");
    const bar = node("span", "", "tile-bar");
    bar.setAttribute("aria-hidden", "true");
    root.append(icon, name, value, note, bar);
    root.addEventListener("click", () => {
      SFX.play("blip", { pitch: status(key)[1] === "red" ? 0.6 : 1 });
      selected = key;
      render();
    });
    tiles.set(key, { root, value, status: note });
    byId("tiles").append(root);
  }
  for (let i = 0; i < 20; i++) {
    const segment = node("i");
    segments.push(segment);
    byId("meter").append(segment);
  }
  render();
})();
