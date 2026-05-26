"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import countriesTopology from "world-atlas/countries-110m.json";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => <div className="globe-loading" aria-hidden="true" />
});

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

function markerLabel(marker) {
  return `
    <div class="globe-label">
      <strong>${marker.name}</strong>
      <span>客户触达节点</span>
    </div>
  `;
}

export default function GlobeScene() {
  const globeRef = useRef(null);
  const [ready, setReady] = useState(false);

  const countries = useMemo(() => {
    const collection = feature(countriesTopology, countriesTopology.objects.countries);
    return collection.features.filter((country) => country.id !== "010");
  }, []);

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color("#062d2a"),
        emissive: new THREE.Color("#031716"),
        emissiveIntensity: 0.55,
        shininess: 20,
        transparent: true,
        opacity: 0.94
      }),
    []
  );

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.pointOfView({ lat: 18, lng: 76, altitude: 1.72 }, 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.48;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [ready]);

  return (
    <div className="globe-shell globe-open-source" aria-label="Add WhatsApp 全球客户触达地球">
      <Globe
        ref={globeRef}
        width={760}
        height={640}
        backgroundColor="rgba(0, 0, 0, 0)"
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor="#42f2cf"
        atmosphereAltitude={0.18}
        polygonsData={countries}
        polygonAltitude={0.012}
        polygonCapColor={() => "rgba(43, 151, 134, 0.58)"}
        polygonSideColor={() => "rgba(12, 78, 69, 0.42)"}
        polygonStrokeColor={() => "rgba(180, 255, 240, 0.28)"}
        polygonsTransitionDuration={0}
        arcsData={ROUTES}
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
        ringsData={MARKERS.slice(0, 6)}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => "rgba(74, 255, 217, 0.36)"}
        ringMaxRadius={2.8}
        ringPropagationSpeed={0.7}
        ringRepeatPeriod={2200}
        onGlobeReady={() => setReady(true)}
      />
    </div>
  );
}
