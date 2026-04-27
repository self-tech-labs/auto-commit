const canvas = document.getElementById("protocol-canvas");
const revealItems = document.querySelectorAll("[data-reveal]");

if (revealItems.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

if (canvas) {
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0.5, y: 0.5 };
  let width = 0;
  let height = 0;
  let time = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawGrid = () => {
    const spacing = width < 700 ? 42 : 62;
    const drift = (time * 10) % spacing;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#fffaf0";
    ctx.lineWidth = 1;

    for (let x = -spacing; x < width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + drift, 0);
      ctx.lineTo(x + drift - width * 0.12, height);
      ctx.stroke();
    }

    for (let y = -spacing; y < height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + drift);
      ctx.lineTo(width, y + drift - height * 0.05);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawSignal = (centerX, centerY, radius, color, phase) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.beginPath();

    for (let i = 0; i <= 190; i += 1) {
      const angle = (i / 190) * Math.PI * 2;
      const wave = Math.sin(angle * 4 + time * 3 + phase) * 12;
      const r = radius + wave;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r * 0.62;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  const drawNode = (x, y, radius, color, label) => {
    const pulse = Math.sin(time * 2.4 + radius) * 0.5 + 0.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.12 + pulse * 0.08;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 3.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(4, radius * 0.24), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.58;
    ctx.fillStyle = "#fffaf0";
    ctx.font = "700 10px Inter, system-ui, sans-serif";
    ctx.fillText(label, radius + 12, 4);
    ctx.restore();
  };

  const draw = () => {
    time += reduceMotion ? 0 : 0.011;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#080a09");
    gradient.addColorStop(0.48, "#131713");
    gradient.addColorStop(1, "#071313");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    drawGrid();

    const mobile = width < 700;
    const parallaxX = (pointer.x - 0.5) * (mobile ? 14 : 34);
    const parallaxY = (pointer.y - 0.5) * (mobile ? 10 : 22);
    const centerX = width * (mobile ? 0.82 : 0.68) + parallaxX;
    const centerY = height * (mobile ? 0.64 : 0.48) + parallaxY;
    const coreRadius = mobile ? 78 : 128;

    drawSignal(centerX, centerY, coreRadius, "rgba(184, 255, 106, 0.9)", 0);
    drawSignal(centerX + coreRadius * 0.42, centerY + coreRadius * 0.18, coreRadius * 0.52, "rgba(130, 231, 255, 0.72)", 1.4);

    const nodes = [
      { x: centerX - coreRadius * 1.18, y: centerY + coreRadius * 0.1, r: 12, c: "#b8ff6a", l: mobile ? "" : "intent" },
      { x: centerX - coreRadius * 0.12, y: centerY - coreRadius * 0.82, r: 15, c: "#82e7ff", l: mobile ? "" : "proof" },
      { x: centerX + coreRadius * 1.1, y: centerY - coreRadius * 0.02, r: 13, c: "#fffaf0", l: mobile ? "" : "oracle" },
      { x: centerX + coreRadius * 0.32, y: centerY + coreRadius * 0.92, r: 18, c: "#ff6b4a", l: mobile ? "" : "settle" },
    ];

    ctx.save();
    ctx.strokeStyle = "rgba(255, 250, 240, 0.34)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    nodes.slice(1).forEach((node) => ctx.lineTo(node.x, node.y));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    nodes.forEach((node) => drawNode(node.x, node.y, node.r, node.c, node.l));

    if (!reduceMotion) {
      window.requestAnimationFrame(draw);
    }
  };

  resize();
  draw();

  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) {
      draw();
    }
  });

  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX / Math.max(1, window.innerWidth);
    pointer.y = event.clientY / Math.max(1, window.innerHeight);
  });
}
