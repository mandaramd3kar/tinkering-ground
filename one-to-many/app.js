const svg = document.getElementById("architectureSvg");
const slider = document.getElementById("userSlider");
const userCountLabel = document.getElementById("userCount");
const stageTitle = document.getElementById("stageTitle");
const stageNarrative = document.getElementById("stageNarrative");
const riskBadge = document.getElementById("riskBadge");
const statsGrid = document.getElementById("statsGrid");

const SVG_NS = "http://www.w3.org/2000/svg";
const AUTOPLAY_DELAY_MS = 2000;

const stages = [
  {
    demoUsers: 1,
    maxUsers: 25,
    name: "Single box",
    narrative: "One app node talks directly to one database. It is simple, fast to build, and one outage away from complete downtime.",
    risk: "Fragile: one failure takes everything down",
    counts: { edge: 0, lb: 0, app: 1, cache: 0, workers: 0, db: 1, analytics: 0, regions: 1 },
    layout: {
      top: [{ id: "users", label: "Users", kind: "client", x: 240, y: 90, width: 180, height: 76 }],
      middle: [{ id: "app-1", label: "App Server", kind: "app", x: 510, y: 272, width: 180, height: 86 }],
      bottom: [{ id: "db", label: "Primary DB", kind: "data", x: 510, y: 490, width: 180, height: 86 }]
    },
    links: [
      ["users", "app-1"],
      ["app-1", "db"]
    ]
  },
  {
    demoUsers: 100,
    maxUsers: 2000,
    name: "Redundancy starts",
    narrative: "A load balancer and cache appear because traffic spikes and repeat reads make a single node too expensive and too risky.",
    risk: "Better: one server can fail, but the region is still a single blast radius",
    counts: { edge: 0, lb: 1, app: 3, cache: 1, workers: 0, db: 1, analytics: 0, regions: 1 },
    layout: {
      top: [{ id: "users", label: "Users", kind: "client", x: 240, y: 90, width: 180, height: 76 }],
      middle: [
        { id: "lb", label: "Load Balancer", kind: "lb", x: 500, y: 200, width: 200, height: 82 },
        { id: "app-1", label: "App 1", kind: "app", x: 330, y: 360, width: 150, height: 76 },
        { id: "app-2", label: "App 2", kind: "app", x: 525, y: 360, width: 150, height: 76 },
        { id: "app-3", label: "App 3", kind: "app", x: 720, y: 360, width: 150, height: 76 }
      ],
      bottom: [
        { id: "cache", label: "Cache", kind: "cache", x: 350, y: 540, width: 170, height: 76 },
        { id: "db", label: "Primary DB", kind: "data", x: 665, y: 540, width: 170, height: 76 }
      ]
    },
    links: [
      ["users", "lb"],
      ["lb", "app-1"],
      ["lb", "app-2"],
      ["lb", "app-3"],
      ["app-1", "cache"],
      ["app-2", "cache"],
      ["app-3", "cache"],
      ["app-1", "db"],
      ["app-2", "db"],
      ["app-3", "db"]
    ]
  },
  {
    demoUsers: 10000,
    maxUsers: 50000,
    name: "Platform shape emerges",
    narrative: "The app tier is now a system, not a box. Read replicas, workers, and a CDN keep synchronous request paths from doing all the work.",
    risk: "Moderate: capacity is healthier, but the primary region still dominates",
    counts: { edge: 1, lb: 1, app: 6, cache: 1, workers: 2, db: 2, analytics: 0, regions: 1 },
    layout: {
      top: [
        { id: "users", label: "Users", kind: "client", x: 150, y: 86, width: 180, height: 76 },
        { id: "cdn", label: "CDN / Edge Cache", kind: "edge", x: 510, y: 86, width: 210, height: 76 }
      ],
      middle: [
        { id: "lb", label: "Load Balancer", kind: "lb", x: 500, y: 204, width: 200, height: 82 },
        { id: "app-1", label: "App 1", kind: "app", x: 190, y: 352, width: 128, height: 72 },
        { id: "app-2", label: "App 2", kind: "app", x: 350, y: 352, width: 128, height: 72 },
        { id: "app-3", label: "App 3", kind: "app", x: 510, y: 352, width: 128, height: 72 },
        { id: "app-4", label: "App 4", kind: "app", x: 670, y: 352, width: 128, height: 72 },
        { id: "app-5", label: "App 5", kind: "app", x: 830, y: 352, width: 128, height: 72 },
        { id: "app-6", label: "App 6", kind: "app", x: 990, y: 352, width: 128, height: 72 }
      ],
      bottom: [
        { id: "cache", label: "Cache Cluster", kind: "cache", x: 180, y: 538, width: 170, height: 76 },
        { id: "queue", label: "Job Queue", kind: "queue", x: 390, y: 538, width: 170, height: 76 },
        { id: "workers", label: "Workers x2", kind: "worker", x: 600, y: 538, width: 170, height: 76 },
        { id: "db", label: "Primary DB", kind: "data", x: 810, y: 500, width: 170, height: 76 },
        { id: "replica", label: "Read Replica", kind: "data", x: 810, y: 596, width: 170, height: 76 }
      ]
    },
    links: [
      ["users", "cdn"],
      ["cdn", "lb"],
      ["lb", "app-1"],
      ["lb", "app-2"],
      ["lb", "app-3"],
      ["lb", "app-4"],
      ["lb", "app-5"],
      ["lb", "app-6"],
      ["app-1", "cache"],
      ["app-2", "cache"],
      ["app-3", "cache"],
      ["app-4", "cache"],
      ["app-5", "queue"],
      ["app-6", "queue"],
      ["queue", "workers"],
      ["app-3", "db"],
      ["app-4", "db"],
      ["db", "replica"]
    ]
  },
  {
    demoUsers: 100000,
    maxUsers: 250000,
    name: "Scale requires separation",
    narrative: "Services split by responsibility. Traffic and state are isolated across availability zones, and background pipelines protect the hot path.",
    risk: "Contained: zonal failures are survivable, but the control plane is still regional",
    counts: { edge: 1, lb: 2, app: 9, cache: 2, workers: 4, db: 3, analytics: 1, regions: 1 },
    layout: {
      top: [
        { id: "users", label: "Users", kind: "client", x: 120, y: 84, width: 180, height: 76 },
        { id: "gateway", label: "API Gateway", kind: "lb", x: 410, y: 84, width: 180, height: 76 },
        { id: "cdn", label: "CDN / WAF", kind: "edge", x: 700, y: 84, width: 180, height: 76 }
      ],
      middle: [
        { id: "lb", label: "Regional Load Balancer", kind: "lb", x: 500, y: 204, width: 220, height: 82 },
        { id: "az-a", label: "App Pool A", kind: "zone", x: 200, y: 340, width: 220, height: 180 },
        { id: "az-b", label: "App Pool B", kind: "zone", x: 490, y: 340, width: 220, height: 180 },
        { id: "az-c", label: "App Pool C", kind: "zone", x: 780, y: 340, width: 220, height: 180 }
      ],
      bottom: [
        { id: "cache", label: "Cache Ring", kind: "cache", x: 170, y: 574, width: 170, height: 76 },
        { id: "queue", label: "Event Bus", kind: "queue", x: 380, y: 574, width: 170, height: 76 },
        { id: "workers", label: "Workers x4", kind: "worker", x: 590, y: 574, width: 170, height: 76 },
        { id: "db", label: "Primary DB", kind: "data", x: 800, y: 536, width: 170, height: 76 },
        { id: "replica", label: "Replica Pair", kind: "data", x: 800, y: 630, width: 170, height: 76 },
        { id: "analytics", label: "Analytics Sink", kind: "analytics", x: 1010, y: 574, width: 170, height: 76 }
      ]
    },
    zoneChildren: [
      { zoneId: "az-a", items: ["svc-auth", "svc-api", "svc-media"], x: 222, y: 386 },
      { zoneId: "az-b", items: ["svc-auth", "svc-api", "svc-media"], x: 512, y: 386 },
      { zoneId: "az-c", items: ["svc-auth", "svc-api", "svc-media"], x: 802, y: 386 }
    ],
    links: [
      ["users", "gateway"],
      ["gateway", "cdn"],
      ["cdn", "lb"],
      ["lb", "az-a"],
      ["lb", "az-b"],
      ["lb", "az-c"],
      ["az-a", "cache"],
      ["az-b", "cache"],
      ["az-c", "queue"],
      ["queue", "workers"],
      ["queue", "analytics"],
      ["az-b", "db"],
      ["db", "replica"]
    ]
  },
  {
    demoUsers: 1000000,
    maxUsers: 1000000,
    name: "Global system",
    narrative: "At this point the product behaves like an ecosystem. Multi-region routing, sharded data, and asynchronous fan-out become part of the normal operating model.",
    risk: "Resilient: no single machine or region owns the whole experience",
    counts: { edge: 2, lb: 3, app: 18, cache: 3, workers: 8, db: 6, analytics: 1, regions: 2 },
    layout: {
      top: [
        { id: "users", label: "Global Users", kind: "client", x: 110, y: 76, width: 190, height: 76 },
        { id: "global-edge", label: "Global Edge / CDN", kind: "edge", x: 400, y: 76, width: 210, height: 76 },
        { id: "global-lb", label: "Global Traffic Manager", kind: "lb", x: 710, y: 76, width: 230, height: 76 }
      ],
      middle: [
        { id: "region-a", label: "Region A", kind: "region", x: 110, y: 204, width: 450, height: 420 },
        { id: "region-b", label: "Region B", kind: "region", x: 640, y: 204, width: 450, height: 420 }
      ],
      bottom: [
        { id: "analytics", label: "Central Analytics", kind: "analytics", x: 465, y: 656, width: 270, height: 72 }
      ]
    },
    regionChildren: [
      {
        regionId: "region-a",
        title: "Primary traffic",
        nodes: [
          { id: "ra-lb", label: "Regional LB", kind: "lb", x: 220, y: 260, width: 190, height: 72 },
          { id: "ra-app", label: "App Fleet x9", kind: "app", x: 170, y: 372, width: 150, height: 72 },
          { id: "ra-cache", label: "Cache Ring", kind: "cache", x: 350, y: 372, width: 150, height: 72 },
          { id: "ra-queue", label: "Event Bus", kind: "queue", x: 170, y: 482, width: 150, height: 72 },
          { id: "ra-db", label: "Shard Set", kind: "data", x: 350, y: 482, width: 150, height: 72 }
        ],
        links: [
          ["ra-lb", "ra-app"],
          ["ra-app", "ra-cache"],
          ["ra-app", "ra-queue"],
          ["ra-app", "ra-db"]
        ]
      },
      {
        regionId: "region-b",
        title: "Failover + geo traffic",
        nodes: [
          { id: "rb-lb", label: "Regional LB", kind: "lb", x: 750, y: 260, width: 190, height: 72 },
          { id: "rb-app", label: "App Fleet x9", kind: "app", x: 700, y: 372, width: 150, height: 72 },
          { id: "rb-cache", label: "Cache Ring", kind: "cache", x: 880, y: 372, width: 150, height: 72 },
          { id: "rb-queue", label: "Event Bus", kind: "queue", x: 700, y: 482, width: 150, height: 72 },
          { id: "rb-db", label: "Shard Set", kind: "data", x: 880, y: 482, width: 150, height: 72 }
        ],
        links: [
          ["rb-lb", "rb-app"],
          ["rb-app", "rb-cache"],
          ["rb-app", "rb-queue"],
          ["rb-app", "rb-db"]
        ]
      }
    ],
    links: [
      ["users", "global-edge"],
      ["global-edge", "global-lb"],
      ["global-lb", "region-a"],
      ["global-lb", "region-b"],
      ["region-a", "analytics"],
      ["region-b", "analytics"]
    ]
  }
];

const metricDefinitions = [
  { key: "app", label: "App Nodes" },
  { key: "lb", label: "Balancers" },
  { key: "db", label: "Data Nodes" },
  { key: "regions", label: "Regions" },
  { key: "cache", label: "Caches" },
  { key: "workers", label: "Workers" }
];

const autoplaySequence = stages.map((stage) => stage.demoUsers);
let autoplayIndex = 0;
let autoplayTimer;

slider.addEventListener("input", () => {
  const users = sliderToUsers(Number(slider.value));
  syncAutoplayIndex(users);
  updateDiagram(users);
  restartAutoplay();
});

function sliderToUsers(rawValue) {
  const exponent = Number(rawValue) / 1000;
  return Math.round(Math.pow(10, exponent * 6));
}

function usersToSliderValue(users) {
  const clampedUsers = Math.max(1, Math.min(1000000, users));
  return Math.round((Math.log10(clampedUsers) / 6) * 1000);
}

function pickStage(users) {
  return stages.find((stage) => users <= stage.maxUsers) || stages[stages.length - 1];
}

function syncAutoplayIndex(users) {
  autoplayIndex = stages.findIndex((stage) => users <= stage.maxUsers);

  if (autoplayIndex === -1) {
    autoplayIndex = stages.length - 1;
  }
}

function setSliderToUsers(users) {
  slider.value = String(usersToSliderValue(users));
  updateDiagram(users);
}

function restartAutoplay() {
  window.clearTimeout(autoplayTimer);
  autoplayTimer = window.setTimeout(() => {
    autoplayIndex = (autoplayIndex + 1) % autoplaySequence.length;
    setSliderToUsers(autoplaySequence[autoplayIndex]);
    restartAutoplay();
  }, AUTOPLAY_DELAY_MS);
}

function updateDiagram(users) {
  const stage = pickStage(users);
  userCountLabel.textContent = formatUsers(users);
  stageTitle.textContent = stage.name;
  stageNarrative.textContent = stage.narrative;
  riskBadge.textContent = stage.risk;
  riskBadge.style.color = users > 250000 ? "#266851" : users > 2000 ? "#7d5a15" : "#aa3b2a";
  renderStats(stage.counts);
  renderStage(stage);
}

function renderStats(counts) {
  statsGrid.innerHTML = "";

  metricDefinitions.forEach((metric) => {
    const card = document.createElement("article");
    card.className = "stat-card";

    const label = document.createElement("p");
    label.className = "stat-label";
    label.textContent = metric.label;

    const value = document.createElement("p");
    value.className = "stat-value";
    value.textContent = counts[metric.key];

    card.append(label, value);
    statsGrid.appendChild(card);
  });
}

function renderStage(stage) {
  svg.innerHTML = "";
  svg.appendChild(buildDefs());

  const nodeMap = new Map();

  drawBackdrop();

  Object.values(stage.layout).flat().forEach((node) => {
    const rendered = drawNode(node);
    nodeMap.set(node.id, rendered);
    svg.appendChild(rendered.group);
  });

  if (stage.zoneChildren) {
    stage.zoneChildren.forEach((zone) => drawZoneChildren(zone));
  }

  if (stage.regionChildren) {
    stage.regionChildren.forEach((region) => drawRegionChildren(region, nodeMap));
  }

  stage.links.forEach(([fromId, toId]) => {
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);

    if (fromNode && toNode) {
      svg.appendChild(drawArrow(fromNode.anchor, toNode.anchor));
    }
  });
}

function buildDefs() {
  const defs = document.createElementNS(SVG_NS, "defs");

  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", "arrowhead");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "8");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("orient", "auto-start-reverse");

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  path.setAttribute("fill", "rgba(31, 37, 48, 0.55)");

  marker.appendChild(path);
  defs.appendChild(marker);
  return defs;
}

function drawBackdrop() {
  const band = document.createElementNS(SVG_NS, "rect");
  band.setAttribute("x", "0");
  band.setAttribute("y", "0");
  band.setAttribute("width", "1200");
  band.setAttribute("height", "760");
  band.setAttribute("fill", "transparent");
  svg.appendChild(band);

  [160, 328, 520].forEach((y) => {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "56");
    line.setAttribute("x2", "1144");
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "rgba(31, 37, 48, 0.08)");
    line.setAttribute("stroke-dasharray", "8 10");
    svg.appendChild(line);
  });

  [
    { text: "Client / Edge", y: 48 },
    { text: "Traffic / Compute", y: 214 },
    { text: "State / Async", y: 540 }
  ].forEach((label) => {
    svg.appendChild(drawLabelChip(68, label.y - 26, label.text, {
      width: 180,
      height: 34,
      fontSize: "16",
      textColor: "rgba(31, 37, 48, 0.72)"
    }));
  });
}

function drawNode(node) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "diagram-node");

  const styles = getNodeStyles(node.kind);

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", node.x);
  rect.setAttribute("y", node.y);
  rect.setAttribute("width", node.width);
  rect.setAttribute("height", node.height);
  rect.setAttribute("rx", node.kind === "region" || node.kind === "zone" ? "28" : "20");
  rect.setAttribute("fill", styles.fill);
  rect.setAttribute("stroke", styles.stroke);
  rect.setAttribute("stroke-width", styles.strokeWidth);
  rect.setAttribute("opacity", styles.opacity);

  const label = document.createElementNS(SVG_NS, "text");
  const labelY = node.kind === "zone"
    ? node.y + 34
    : node.kind === "region"
      ? node.y + 36
      : node.y + node.height / 2 + 6;

  label.setAttribute("x", node.kind === "region" ? node.x + 28 : node.x + node.width / 2);
  label.setAttribute("y", labelY);
  label.setAttribute("text-anchor", node.kind === "region" ? "start" : "middle");
  label.setAttribute("fill", styles.text);
  label.setAttribute("font-size", node.kind === "region" ? "26" : node.kind === "zone" ? "20" : "22");
  label.setAttribute("font-weight", "700");
  label.setAttribute("class", "diagram-label");
  label.textContent = node.label;

  group.append(rect, label);

  return {
    group,
    anchor: {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
      width: node.width,
      height: node.height
    }
  };
}

function drawArrow(from, to) {
  const line = document.createElementNS(SVG_NS, "path");
  line.setAttribute("class", "diagram-arrow");

  const sameRow = Math.abs(from.y - to.y) < 50;
  let pathData;

  if (sameRow) {
    const startX = from.x + from.width / 2 - 6;
    const startY = from.y;
    const endX = to.x - to.width / 2 + 6;
    const endY = to.y;
    const curveX = (startX + endX) / 2;
    pathData = `M ${startX} ${startY} C ${curveX} ${startY}, ${curveX} ${endY}, ${endX} ${endY}`;
  } else {
    const startX = from.x;
    const startY = from.y + from.height / 2 - 4;
    const endX = to.x;
    const endY = to.y - to.height / 2 + 4;
    const curveY = (startY + endY) / 2;
    pathData = `M ${startX} ${startY} C ${startX} ${curveY}, ${endX} ${curveY}, ${endX} ${endY}`;
  }

  line.setAttribute("d", pathData);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "rgba(31, 37, 48, 0.32)");
  line.setAttribute("stroke-width", "3");
  line.setAttribute("marker-end", "url(#arrowhead)");

  return line;
}

function drawZoneChildren(zone) {
  zone.items.forEach((item, index) => {
    const pill = document.createElementNS(SVG_NS, "rect");
    pill.setAttribute("x", zone.x);
    pill.setAttribute("y", zone.y + index * 44);
    pill.setAttribute("width", "178");
    pill.setAttribute("height", "34");
    pill.setAttribute("rx", "17");
    pill.setAttribute("fill", "rgba(255, 249, 239, 0.9)");
    pill.setAttribute("stroke", "rgba(31, 37, 48, 0.14)");
    pill.setAttribute("class", "diagram-node");

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", zone.x + 89);
    text.setAttribute("y", String(zone.y + 22 + index * 44));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "17");
    text.setAttribute("fill", "#1f2530");
    text.setAttribute("class", "diagram-label");
    text.textContent = item;

    svg.append(pill, text);
  });
}

function drawRegionChildren(region, nodeMap) {
  const regionHeaderX = region.regionId === "region-a" ? 350 : 880;

  svg.appendChild(
    drawLabelChip(regionHeaderX, 220, region.title, {
      width: 170,
      height: 30,
      fontSize: "14",
      textColor: "rgba(31, 37, 48, 0.74)"
    })
  );

  region.nodes.forEach((node) => {
    const rendered = drawNode(node);
    nodeMap.set(node.id, rendered);
    svg.appendChild(rendered.group);
  });

  region.links.forEach(([fromId, toId]) => {
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);

    if (fromNode && toNode) {
      svg.appendChild(drawArrow(fromNode.anchor, toNode.anchor));
    }
  });
}

function drawLabelChip(x, y, textContent, options = {}) {
  const width = options.width || Math.max(144, textContent.length * 9 + 28);
  const height = options.height || 34;
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "diagram-label");

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", x);
  rect.setAttribute("y", y);
  rect.setAttribute("width", width);
  rect.setAttribute("height", height);
  rect.setAttribute("rx", String(height / 2));
  rect.setAttribute("fill", options.fill || "rgba(255, 250, 240, 0.94)");
  rect.setAttribute("stroke", options.stroke || "rgba(31, 37, 48, 0.12)");

  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("x", x + width / 2);
  label.setAttribute("y", y + height / 2 + 5);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("font-size", options.fontSize || "16");
  label.setAttribute("font-weight", "700");
  label.setAttribute("fill", options.textColor || "rgba(31, 37, 48, 0.72)");
  label.textContent = textContent;

  group.append(rect, label);
  return group;
}

function getNodeStyles(kind) {
  const palette = {
    client: { fill: "#1f2530", stroke: "#1f2530", text: "#fffaf0", strokeWidth: "0", opacity: "1" },
    edge: { fill: "#f2d5a6", stroke: "#d29a35", text: "#4a3414", strokeWidth: "2", opacity: "1" },
    lb: { fill: "#dce8f6", stroke: "#6d8fb7", text: "#24456c", strokeWidth: "2", opacity: "1" },
    app: { fill: "#fff9ef", stroke: "#cf9865", text: "#603f1c", strokeWidth: "2", opacity: "1" },
    cache: { fill: "#dff0e4", stroke: "#67a27f", text: "#1f5b35", strokeWidth: "2", opacity: "1" },
    queue: { fill: "#efe2fa", stroke: "#9474b9", text: "#543370", strokeWidth: "2", opacity: "1" },
    worker: { fill: "#f7e3cc", stroke: "#d09b5c", text: "#694117", strokeWidth: "2", opacity: "1" },
    data: { fill: "#ead7d7", stroke: "#b67575", text: "#5e2f2f", strokeWidth: "2", opacity: "1" },
    analytics: { fill: "#d9edf3", stroke: "#5e96ad", text: "#1c5668", strokeWidth: "2", opacity: "1" },
    zone: { fill: "rgba(255, 255, 255, 0.46)", stroke: "rgba(31, 37, 48, 0.14)", text: "#1f2530", strokeWidth: "2", opacity: "1" },
    region: { fill: "rgba(255, 248, 236, 0.82)", stroke: "rgba(31, 37, 48, 0.18)", text: "#1f2530", strokeWidth: "2.5", opacity: "1" }
  };

  return palette[kind] || palette.app;
}

function formatUsers(users) {
  return new Intl.NumberFormat("en-US").format(users);
}

setSliderToUsers(autoplaySequence[0]);
restartAutoplay();
