import React, { useEffect, useMemo, useRef } from "react";

const clouds = [
  { x: 82, y: 18, w: 900, h: 270, rot: 48, color: "rgba(204,82,0,0.22)" },
  { x: 62, y: 0, w: 900, h: 270, rot: -25, color: "rgba(204,82,0,0.16)" },
  { x: 22, y: 82, w: 900, h: 270, rot: 61, color: "rgba(0,0,255,0.22)" },
  { x: 40, y: 62, w: 900, h: 270, rot: -50, color: "rgba(0,0,255,0.16)" },
  { x: 28, y: 40, w: 900, h: 270, rot: 40, color: "rgba(140,0,255,0.20)" },
  { x: 32, y: 85, w: 900, h: 270, rot: 109, color: "rgba(140,0,255,0.14)" },
];

const tints = ["255,255,255", "200,220,255", "255,240,210"];

const CLOUD_OPACITY = 0.18;

const LAYERS = [
  { glow: false, strength: 14 },
  { glow: true, strength: 36 },
];

function makeStars(count) {
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, (_, id) => {
    const big = rand() > 0.9;
    return {
      id,
      x: rand() * 100,
      y: rand() * 100,
      s: big ? 2.5 : 1 + rand() * 1.2,
      o: 0.35 + rand() * 0.5,
      d: 3 + rand() * 6,
      delay: -rand() * 9,
      c: tints[Math.floor(rand() * tints.length)],
      glow: big,
    };
  });
}

export default function StarBackground() {
  const stars = useMemo(() => makeStars(260), []);
  const layerRefs = useRef([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf = 0;

    const onMove = (e) => {
      targetX = e.clientX / window.innerWidth - 0.5;
      targetY = e.clientY / window.innerHeight - 0.5;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${currentX * layer.strength}px, ${currentY * layer.strength}px, 0)`;
        }
      });
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: calc(var(--o) * 0.15); transform: scale(0.85); }
          50% { opacity: var(--o); transform: scale(1); }
        }
        @keyframes drift {
          from { transform: translateY(0); }
          to { transform: translateY(-24px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .star, .star-drift { animation: none !important; }
        }
      `}</style>

      {clouds.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${c.x}%`,
            top: `${c.y}%`,
            width: c.w,
            height: c.h,
            background: c.color,
            filter: "blur(75px)",
            opacity: CLOUD_OPACITY,
            transform: `translate(-50%, -50%) rotate(${c.rot}deg)`,
          }}
        />
      ))}

      {LAYERS.map((layer, li) => (
        <div
          key={li}
          ref={(el) => {
            layerRefs.current[li] = el;
          }}
          style={{ position: "absolute", inset: "-60px", willChange: "transform" }}
        >
          <div
            className="star-drift"
            style={{
              position: "absolute",
              inset: 0,
              animation: "drift 40s ease-in-out infinite alternate",
            }}
          >
            {stars
              .filter((st) => st.glow === layer.glow)
              .map((st) => (
                <div
                  key={st.id}
                  className="star"
                  style={{
                    position: "absolute",
                    left: `${st.x}%`,
                    top: `${st.y}%`,
                    width: st.s,
                    height: st.s,
                    borderRadius: "50%",
                    background: `rgb(${st.c})`,
                    boxShadow: st.glow ? `0 0 6px 1px rgba(${st.c},0.5)` : "none",
                    opacity: st.o,
                    "--o": st.o,
                    animation: `twinkle ${st.d}s ease-in-out ${st.delay}s infinite`,
                  }}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
