"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countriesTopology from "world-atlas/countries-110m.json";

const Globe = dynamic(
  () =>
    import("react-globe.gl").then((module) => {
      const GlobeComponent = module.default;
      return function GlobeWithForwardedRef({ forwardedRef, ...props }) {
        return <GlobeComponent ref={forwardedRef} {...props} />;
      };
    }),
  {
    ssr: false,
    loading: () => <div className="globe-loading" aria-hidden="true" />
  }
);

const ROUTES = [
  {
    name: "Shenzhen - Madrid",
    startLat: 22.5431,
    startLng: 114.0579,
    endLat: 40.4168,
    endLng: -3.7038,
    color: "rgba(74, 255, 217, 0.92)",
    altitude: 0.17,
    stroke: 0.58,
    gap: 0.05
  },
  {
    name: "Singapore - London",
    startLat: 1.3521,
    startLng: 103.8198,
    endLat: 51.5072,
    endLng: -0.1276,
    color: "rgba(245, 199, 107, 0.82)",
    altitude: 0.18,
    stroke: 0.52,
    gap: 0.22
  },
  {
    name: "Bangkok - Mexico City",
    startLat: 13.7563,
    startLng: 100.5018,
    endLat: 19.4326,
    endLng: -99.1332,
    color: "rgba(92, 212, 255, 0.66)",
    altitude: 0.2,
    stroke: 0.44,
    gap: 0.44
  },
  {
    name: "Jakarta - Dubai",
    startLat: -6.2088,
    startLng: 106.8456,
    endLat: 25.2048,
    endLng: 55.2708,
    color: "rgba(74, 255, 217, 0.62)",
    altitude: 0.12,
    stroke: 0.42,
    gap: 0.68
  },
  {
    name: "Shenzhen - Cairo",
    startLat: 22.5431,
    startLng: 114.0579,
    endLat: 30.0444,
    endLng: 31.2357,
    color: "rgba(74, 255, 217, 0.5)",
    altitude: 0.11,
    stroke: 0.34,
    gap: 0.14
  },
  {
    name: "Singapore - Nairobi",
    startLat: 1.3521,
    startLng: 103.8198,
    endLat: -1.2921,
    endLng: 36.8219,
    color: "rgba(116, 246, 221, 0.5)",
    altitude: 0.1,
    stroke: 0.34,
    gap: 0.34
  },
  {
    name: "Bangkok - Istanbul",
    startLat: 13.7563,
    startLng: 100.5018,
    endLat: 41.0082,
    endLng: 28.9784,
    color: "rgba(245, 199, 107, 0.52)",
    altitude: 0.12,
    stroke: 0.34,
    gap: 0.55
  },
  {
    name: "Jakarta - Cape Town",
    startLat: -6.2088,
    startLng: 106.8456,
    endLat: -33.9249,
    endLng: 18.4241,
    color: "rgba(92, 212, 255, 0.48)",
    altitude: 0.14,
    stroke: 0.32,
    gap: 0.76
  },
  {
    name: "Dubai - Madrid",
    startLat: 25.2048,
    startLng: 55.2708,
    endLat: 40.4168,
    endLng: -3.7038,
    color: "rgba(74, 255, 217, 0.44)",
    altitude: 0.08,
    stroke: 0.3,
    gap: 0.88
  },
  {
    name: "Dubai - Lagos",
    startLat: 25.2048,
    startLng: 55.2708,
    endLat: 6.5244,
    endLng: 3.3792,
    color: "rgba(116, 246, 221, 0.42)",
    altitude: 0.09,
    stroke: 0.3,
    gap: 0.28
  },
  {
    name: "London - Sao Paulo",
    startLat: 51.5072,
    startLng: -0.1276,
    endLat: -23.5558,
    endLng: -46.6396,
    color: "rgba(245, 199, 107, 0.44)",
    altitude: 0.16,
    stroke: 0.3,
    gap: 0.62
  },
  {
    name: "Madrid - Mexico City",
    startLat: 40.4168,
    startLng: -3.7038,
    endLat: 19.4326,
    endLng: -99.1332,
    color: "rgba(92, 212, 255, 0.42)",
    altitude: 0.18,
    stroke: 0.3,
    gap: 0.82
  },
  {
    name: "Cairo - Nairobi",
    startLat: 30.0444,
    startLng: 31.2357,
    endLat: -1.2921,
    endLng: 36.8219,
    color: "rgba(74, 255, 217, 0.54)",
    altitude: 0.07,
    stroke: 0.32,
    gap: 0.18
  },
  {
    name: "Cairo - Cape Town",
    startLat: 30.0444,
    startLng: 31.2357,
    endLat: -33.9249,
    endLng: 18.4241,
    color: "rgba(92, 212, 255, 0.44)",
    altitude: 0.11,
    stroke: 0.3,
    gap: 0.38
  },
  {
    name: "Istanbul - Lagos",
    startLat: 41.0082,
    startLng: 28.9784,
    endLat: 6.5244,
    endLng: 3.3792,
    color: "rgba(245, 199, 107, 0.48)",
    altitude: 0.08,
    stroke: 0.3,
    gap: 0.58
  },
  {
    name: "Dubai - Nairobi",
    startLat: 25.2048,
    startLng: 55.2708,
    endLat: -1.2921,
    endLng: 36.8219,
    color: "rgba(74, 255, 217, 0.5)",
    altitude: 0.08,
    stroke: 0.3,
    gap: 0.78
  },
  {
    name: "London - Cairo",
    startLat: 51.5072,
    startLng: -0.1276,
    endLat: 30.0444,
    endLng: 31.2357,
    color: "rgba(74, 255, 217, 0.48)",
    altitude: 0.07,
    stroke: 0.28,
    gap: 0.12
  },
  {
    name: "Madrid - Lagos",
    startLat: 40.4168,
    startLng: -3.7038,
    endLat: 6.5244,
    endLng: 3.3792,
    color: "rgba(92, 212, 255, 0.42)",
    altitude: 0.07,
    stroke: 0.28,
    gap: 0.31
  },
  {
    name: "Lagos - Cape Town",
    startLat: 6.5244,
    startLng: 3.3792,
    endLat: -33.9249,
    endLng: 18.4241,
    color: "rgba(245, 199, 107, 0.42)",
    altitude: 0.08,
    stroke: 0.28,
    gap: 0.51
  },
  {
    name: "Nairobi - Dubai",
    startLat: -1.2921,
    startLng: 36.8219,
    endLat: 25.2048,
    endLng: 55.2708,
    color: "rgba(116, 246, 221, 0.46)",
    altitude: 0.07,
    stroke: 0.28,
    gap: 0.71
  }
];

const MARKERS = [
  { name: "深圳", lat: 22.5431, lng: 114.0579, size: 0.13 },
  { name: "新加坡", lat: 1.3521, lng: 103.8198, size: 0.11 },
  { name: "曼谷", lat: 13.7563, lng: 100.5018, size: 0.1 },
  { name: "雅加达", lat: -6.2088, lng: 106.8456, size: 0.1 },
  { name: "马德里", lat: 40.4168, lng: -3.7038, size: 0.09 },
  { name: "伦敦", lat: 51.5072, lng: -0.1276, size: 0.09 },
  { name: "迪拜", lat: 25.2048, lng: 55.2708, size: 0.09 },
  { name: "墨西哥城", lat: 19.4326, lng: -99.1332, size: 0.09 },
  { name: "开罗", lat: 30.0444, lng: 31.2357, size: 0.075 },
  { name: "内罗毕", lat: -1.2921, lng: 36.8219, size: 0.075 },
  { name: "伊斯坦布尔", lat: 41.0082, lng: 28.9784, size: 0.075 },
  { name: "开普敦", lat: -33.9249, lng: 18.4241, size: 0.075 },
  { name: "拉各斯", lat: 6.5244, lng: 3.3792, size: 0.075 },
  { name: "圣保罗", lat: -23.5558, lng: -46.6396, size: 0.075 }
];

const CAMERA_PATH = [
  { stop: 0, lat: 18, lng: 76, altitude: 1.72, scale: 315, marker: null },
  { stop: 0.34, lat: 20, lng: 48, altitude: 1.42, scale: 332, marker: null },
  {
    stop: 0.52,
    lat: 40.4168,
    lng: -3.7038,
    altitude: 1.08,
    scale: 470,
    marker: { label: "Spain / 西班牙", lat: 40.4168, lng: -3.7038 }
  },
  {
    stop: 0.72,
    lat: 39.5,
    lng: -98.35,
    altitude: 1.12,
    scale: 430,
    marker: { label: "USA / 美国", lat: 39.5, lng: -98.35 }
  },
  {
    stop: 0.9,
    lat: 35.8617,
    lng: 104.1954,
    altitude: 1.08,
    scale: 450,
    marker: { label: "China / 中国", lat: 35.8617, lng: 104.1954 }
  }
];

const STORY_CAMERAS = [
  CAMERA_PATH[1],
  CAMERA_PATH[1],
  CAMERA_PATH[2],
  CAMERA_PATH[3],
  CAMERA_PATH[4]
];

const CANVAS_WIDTH = 1040;
const CANVAS_HEIGHT = 860;
const CANVAS_CENTER_X = CANVAS_WIDTH / 2;
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2;
const CANVAS_SCALE_BOOST = 1.12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mix(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function mixLongitude(start, end, amount) {
  const delta = ((end - start + 540) % 360) - 180;
  return start + delta * amount;
}

function cameraForProgress(progress) {
  const safeProgress = clamp(progress, 0, 1);
  const matchIndex = CAMERA_PATH.findIndex((point, pointIndex) => {
    const next = CAMERA_PATH[pointIndex + 1];
    return next ? safeProgress >= point.stop && safeProgress <= next.stop : false;
  });
  const index = matchIndex === -1 ? CAMERA_PATH.length - 2 : Math.max(0, Math.min(matchIndex, CAMERA_PATH.length - 2));
  const from = CAMERA_PATH[index] || CAMERA_PATH[0];
  const to = CAMERA_PATH[index + 1] || CAMERA_PATH[CAMERA_PATH.length - 1];
  const local = smoothstep(clamp((safeProgress - from.stop) / (to.stop - from.stop), 0, 1));

  return {
    lat: mix(from.lat, to.lat, local),
    lng: mixLongitude(from.lng, to.lng, local),
    altitude: mix(from.altitude, to.altitude, local),
    scale: mix(from.scale, to.scale, local),
    marker: local > 0.62 ? to.marker : from.marker
  };
}

function cameraForVisibleStory() {
  const panels = Array.from(document.querySelectorAll(".story-panel"));
  if (!panels.length) return cameraForProgress(0);

  let activeIndex = -1;
  let activeOverlap = 0;

  panels.forEach((panel) => {
    const rect = panel.getBoundingClientRect();
    const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    if (overlap > activeOverlap) {
      activeOverlap = overlap;
      activeIndex = Number(panel.dataset.storyIndex || 0);
    }
  });

  if (activeOverlap < window.innerHeight * 0.18 || activeIndex < 0) {
    return cameraForProgress(0);
  }

  return STORY_CAMERAS[Math.min(activeIndex + 1, STORY_CAMERAS.length - 1)] || STORY_CAMERAS[0];
}

function stepCamera(current, target) {
  const amount = 0.095;
  return {
    lat: mix(current.lat, target.lat, amount),
    lng: mixLongitude(current.lng, target.lng, amount),
    altitude: mix(current.altitude, target.altitude, amount),
    scale: mix(current.scale, target.scale, amount),
    marker: target.marker
  };
}

function markerLabel(marker) {
  return `
    <div class="globe-label">
      <strong>${marker.name}</strong>
      <span>客户触达节点</span>
    </div>
  `;
}

function drawLabel(context, text, x, y) {
  context.save();
  context.font = "900 24px Segoe UI, Microsoft YaHei, sans-serif";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(0, 0, 0, 0.72)";
  context.lineWidth = 7;
  context.strokeText(text, x + 18, y - 16);
  context.fillStyle = "#f6fff9";
  context.fillText(text, x + 18, y - 16);
  context.restore();
}

function drawStaticGlobe(context, countries, camera, time) {
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;
  const projection = geoOrthographic()
    .translate([CANVAS_CENTER_X, CANVAS_CENTER_Y])
    .scale(camera.scale * CANVAS_SCALE_BOOST)
    .rotate([-camera.lng, -camera.lat])
    .clipAngle(90);
  const path = geoPath(projection, context);
  const glow = context.createRadialGradient(450, 292, 0, CANVAS_CENTER_X - 34, CANVAS_CENTER_Y - 24, 440);

  context.clearRect(0, 0, width, height);
  glow.addColorStop(0, "rgba(92, 244, 210, 0.46)");
  glow.addColorStop(0.45, "rgba(25, 118, 101, 0.42)");
  glow.addColorStop(0.78, "rgba(2, 18, 16, 0.92)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0.22)");

  context.save();
  context.beginPath();
  path({ type: "Sphere" });
  context.fillStyle = glow;
  context.fill();
  context.strokeStyle = "rgba(135, 255, 232, 0.42)";
  context.lineWidth = 1.1;
  context.stroke();
  context.restore();

  context.save();
  context.beginPath();
  path(geoGraticule10());
  context.strokeStyle = "rgba(126, 255, 234, 0.18)";
  context.lineWidth = 1;
  context.stroke();
  context.restore();

  countries.forEach((country) => {
    context.save();
    context.beginPath();
    path(country);
    context.fillStyle = "rgba(63, 185, 158, 0.5)";
    context.fill();
    context.strokeStyle = "rgba(205, 255, 246, 0.72)";
    context.lineWidth = 1.25;
    context.stroke();
    context.restore();
  });

  ROUTES.slice(0, 12).forEach((route, index) => {
    const start = projection([route.startLng, route.startLat]);
    const end = projection([route.endLng, route.endLat]);
    if (!start || !end) return;
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2 - 90;

    context.save();
    context.beginPath();
    context.moveTo(start[0], start[1]);
    context.quadraticCurveTo(midX, midY, end[0], end[1]);
    context.strokeStyle = route.color;
    context.lineWidth = 2.2;
    context.setLineDash([120, 18, 8, 18]);
    context.lineDashOffset = -(time / 90 + index * 14);
    context.shadowColor = "rgba(82, 255, 220, 0.46)";
    context.shadowBlur = 10;
    context.stroke();
    context.restore();
  });

  if (camera.marker) {
    const marker = projection([camera.marker.lng, camera.marker.lat]);
    if (marker) {
      const pulse = 0.86 + Math.sin(time / 260) * 0.18;
      context.save();
      context.fillStyle = "#f8fff9";
      context.shadowColor = "rgba(84, 244, 191, 0.9)";
      context.shadowBlur = 14;
      context.beginPath();
      context.arc(marker[0], marker[1], 10, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "rgba(84, 244, 191, 0.72)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(marker[0], marker[1], 22 * pulse, 0, Math.PI * 2);
      context.stroke();
      drawLabel(context, camera.marker.label, marker[0], marker[1]);
      context.restore();
    }
  }
}

function StaticGlobeFallback({ countries }) {
  const canvasRef = useRef(null);
  const cameraRef = useRef(cameraForProgress(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d", { alpha: true });
    let frame = 0;
    let mounted = true;

    const resize = () => {
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      canvas.width = Math.round(CANVAS_WIDTH * ratio);
      canvas.height = Math.round(CANVAS_HEIGHT * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (time) => {
      if (!mounted) return;

      const target = cameraForVisibleStory();
      cameraRef.current = stepCamera(cameraRef.current, target);
      drawStaticGlobe(context, countries, cameraRef.current, time);
      frame = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    frame = window.requestAnimationFrame(draw);

    return () => {
      mounted = false;
      window.removeEventListener("resize", resize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [countries]);

  return <canvas className="globe-static" ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden="true" />;
}

export default function GlobeScene({ progress = 0, cinematic = false }) {
  const globeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const dimensions = cinematic ? { width: 920, height: 760 } : { width: 760, height: 640 };

  const countries = useMemo(() => {
    const collection = feature(countriesTopology, countriesTopology.objects.countries);
    return collection.features.filter((country) => country.id !== "010");
  }, []);

  const routes = useMemo(() => {
    const pulse = cinematic ? 0.16 + progress * 0.34 : 0;
    return ROUTES.map((route, index) => ({
      ...route,
      altitude: route.altitude + (cinematic ? Math.sin(progress * Math.PI + index) * 0.018 : 0),
      stroke: route.stroke + pulse
    }));
  }, [cinematic, progress]);

  const rings = useMemo(() => {
    if (!cinematic) return MARKERS.slice(0, 6);
    const count = 5 + Math.round(progress * 7);
    return MARKERS.slice(0, count);
  }, [cinematic, progress]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.pointOfView(cameraForProgress(progress), cinematic ? 120 : 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = cinematic ? 0.28 + progress * 0.34 : 0.48;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [cinematic, progress, ready]);

  return (
    <div
      className={`globe-shell globe-open-source ${cinematic ? "globe-cinematic" : ""}`}
      aria-label="Add WhatsApp 全球客户触达地球"
    >
      {cinematic ? <StaticGlobeFallback countries={countries} /> : null}
      {!cinematic ? (
        <Globe
          forwardedRef={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0, 0, 0, 0)"
          globeColor="#062d2a"
          showAtmosphere
          atmosphereColor="#42f2cf"
          atmosphereAltitude={0.18}
          polygonsData={countries}
          polygonAltitude={0.012}
          polygonCapColor={() => "rgba(43, 151, 134, 0.58)"}
          polygonSideColor={() => "rgba(12, 78, 69, 0.42)"}
          polygonStrokeColor={() => "rgba(180, 255, 240, 0.28)"}
          polygonsTransitionDuration={0}
          arcsData={routes}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={(route) => route.color}
          arcAltitude="altitude"
          arcStroke={(route) => Math.max(route.stroke, 0.48)}
          arcDashLength={0.86}
          arcDashGap={0.22}
          arcDashInitialGap="gap"
          arcDashAnimateTime={6500}
          arcLabel="name"
          pointsData={MARKERS}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.025}
          pointRadius="size"
          pointColor={() => "rgba(206, 255, 242, 0.95)"}
          pointLabel={markerLabel}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (cinematic ? "rgba(245, 199, 107, 0.34)" : "rgba(74, 255, 217, 0.36)")}
          ringMaxRadius={cinematic ? 3.8 + progress * 1.4 : 2.8}
          ringPropagationSpeed={cinematic ? 0.85 + progress * 0.3 : 0.7}
          ringRepeatPeriod={cinematic ? 1700 : 2200}
          onGlobeReady={() => setReady(true)}
        />
      ) : null}
    </div>
  );
}
