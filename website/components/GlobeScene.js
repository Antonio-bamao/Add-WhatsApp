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
    color: "rgba(74, 255, 217, 0.92)"
  },
  {
    name: "Singapore - London",
    startLat: 1.3521,
    startLng: 103.8198,
    endLat: 51.5072,
    endLng: -0.1276,
    color: "rgba(245, 199, 107, 0.88)"
  },
  {
    name: "Bangkok - Mexico City",
    startLat: 13.7563,
    startLng: 100.5018,
    endLat: 19.4326,
    endLng: -99.1332,
    color: "rgba(92, 212, 255, 0.72)"
  },
  {
    name: "Jakarta - Dubai",
    startLat: -6.2088,
    startLng: 106.8456,
    endLat: 25.2048,
    endLng: 55.2708,
    color: "rgba(74, 255, 217, 0.68)"
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
  { name: "墨西哥城", lat: 19.4326, lng: -99.1332, size: 0.09 }
];

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 720, height: 620 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(Math.round(rect.width), 320),
        height: Math.max(Math.round(rect.height), 320)
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function markerLabel(marker) {
  return `
    <div class="globe-label">
      <strong>${marker.name}</strong>
      <span>客户触达节点</span>
    </div>
  `;
}

export default function GlobeScene() {
  const shellRef = useRef(null);
  const globeRef = useRef(null);
  const size = useElementSize(shellRef);
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
    <div className="globe-shell globe-open-source" ref={shellRef} aria-label="Add WhatsApp 全球客户触达地球">
      <div className="globe-vignette" aria-hidden="true" />
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
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
        arcAltitude={0.16}
        arcStroke={0.72}
        arcDashLength={0.36}
        arcDashGap={1.6}
        arcDashAnimateTime={4800}
        arcLabel="name"
        pointsData={MARKERS}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.025}
        pointRadius="size"
        pointColor={() => "rgba(206, 255, 242, 0.95)"}
        pointLabel={markerLabel}
        ringsData={MARKERS.slice(0, 4)}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => "rgba(74, 255, 217, 0.36)"}
        ringMaxRadius={2.8}
        ringPropagationSpeed={0.7}
        ringRepeatPeriod={2200}
        onGlobeReady={() => setReady(true)}
      />
      <div className="globe-hud globe-hud-top">Live route intelligence</div>
      <div className="globe-hud globe-hud-bottom">Country polygons · Arc links</div>
    </div>
  );
}
