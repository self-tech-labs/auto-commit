const canvas = document.getElementById("commitment-canvas");
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

  const lerp = (a, b, amount) => a + (b - a) * amount;

  const drawGrid = () => {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#fffdfa";
    ctx.lineWidth = 1;

    const spacing = width < 700 ? 46 : 64;
    const drift = (time * 14) % spacing;

    for (let x = -spacing; x < width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + drift, 0);
      ctx.lineTo(x + drift - width * 0.18, height);
      ctx.stroke();
    }

    for (let y = -spacing; y < height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + drift);
      ctx.lineTo(width, y + drift - height * 0.08);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawNode = (node, index) => {
    const pulse = Math.sin(time * 2 + index) * 0.5 + 0.5;

    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.globalAlpha = 0.18 + pulse * 0.1;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(0, 0, node.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(9, 9, 6, 0.76)";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(8, node.radius * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawPacket = (from, to, progress, color) => {
    const x = lerp(from.x, to.x, progress);
    const y = lerp(from.y, to.y, progress);

    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const draw = () => {
    time += reduceMotion ? 0 : 0.012;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#090906");
    gradient.addColorStop(0.45, "#15110d");
    gradient.addColorStop(1, "#07110f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    drawGrid();

    const parallaxX = (pointer.x - 0.5) * 34;
    const parallaxY = (pointer.y - 0.5) * 24;
    const mobile = width < 700;
    const nodes = mobile
      ? [
          { x: width * 0.84 + parallaxX, y: height * 0.38 + parallaxY, radius: 16, color: "#78d7b4" },
          { x: width * 0.92 + parallaxX * 0.8, y: height * 0.5 + parallaxY, radius: 12, color: "#fffdfa" },
          { x: width * 0.7 + parallaxX * 0.6, y: height * 0.66 + parallaxY, radius: 22, color: "#ff5a1f" },
          { x: width * 0.49 + parallaxX * 0.4, y: height * 0.56 + parallaxY, radius: 13, color: "#8ab4ff" },
        ]
      : [
          { x: width * 0.62 + parallaxX, y: height * 0.25 + parallaxY, radius: 24, color: "#78d7b4" },
          { x: width * 0.81 + parallaxX * 0.8, y: height * 0.44 + parallaxY, radius: 15, color: "#fffdfa" },
          { x: width * 0.68 + parallaxX * 0.6, y: height * 0.68 + parallaxY, radius: 30, color: "#ff5a1f" },
          { x: width * 0.45 + parallaxX * 0.35, y: height * 0.58 + parallaxY, radius: 18, color: "#8ab4ff" },
          { x: width * 0.31 + parallaxX * 0.2, y: height * 0.38 + parallaxY, radius: 12, color: "#fffdfa" },
        ];

    ctx.save();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(255, 253, 250, 0.36)";
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    nodes.slice(1).forEach((node) => ctx.lineTo(node.x, node.y));
    ctx.stroke();
    ctx.restore();

    for (let index = 0; index < nodes.length - 1; index += 1) {
      const progress = (time * 0.42 + index * 0.28) % 1;
      drawPacket(nodes[index], nodes[index + 1], progress, index === 1 ? "#ff5a1f" : "#78d7b4");
    }

    nodes.forEach(drawNode);

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
