import React, { useRef, useEffect, useState, memo } from 'react';
import * as THREE from 'three';
import { RotateCw } from 'lucide-react';

// Global texture cache: Generated ONCE for the entire application session
// Completely eliminates texture re-generation lag on site switching and lower-end devices
let cachedDiffuseTexture = null;
let cachedBumpTexture = null;

function generateLunarTextures() {
  if (cachedDiffuseTexture && cachedBumpTexture) {
    return { diffuseTexture: cachedDiffuseTexture, bumpTexture: cachedBumpTexture };
  }

  const texWidth = 1024; // Optimized for 60fps on integrated GPUs
  const texHeight = 512;

  const diffuseCanvas = document.createElement('canvas');
  diffuseCanvas.width = texWidth;
  diffuseCanvas.height = texHeight;
  const dCtx = diffuseCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = texWidth;
  bumpCanvas.height = texHeight;
  const bCtx = bumpCanvas.getContext('2d');

  // Base Lunar Anorthosite Highland Regolith
  dCtx.fillStyle = '#6E7482';
  dCtx.fillRect(0, 0, texWidth, texHeight);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, texWidth, texHeight);

  // Regolith micro-noise grain
  for (let i = 0; i < 3000; i++) {
    const rx = Math.random() * texWidth;
    const ry = Math.random() * texHeight;
    const shade = Math.floor(95 + Math.random() * 40);
    dCtx.fillStyle = `rgb(${shade},${shade + 2},${shade + 4})`;
    dCtx.fillRect(rx, ry, 2, 2);
  }

  // Major Lunar Maria (Dark Basaltic Plains)
  const maria = [
    { name: 'Oceanus Procellarum', x: 0.30, y: 0.42, rx: 110, ry: 130, shade: '#343844' },
    { name: 'Mare Imbrium', x: 0.38, y: 0.32, rx: 75, ry: 65, shade: '#2F333E' },
    { name: 'Mare Serenitatis', x: 0.54, y: 0.35, rx: 55, ry: 50, shade: '#323642' },
    { name: 'Mare Tranquillitatis', x: 0.58, y: 0.46, rx: 60, ry: 55, shade: '#30343F' },
    { name: 'Mare Crisium', x: 0.69, y: 0.40, rx: 38, ry: 35, shade: '#2A2E38' },
    { name: 'Mare Fecunditatis', x: 0.65, y: 0.56, rx: 50, ry: 45, shade: '#333742' },
    { name: 'Mare Nubium', x: 0.42, y: 0.60, rx: 48, ry: 45, shade: '#353944' },
    { name: 'SPA Basin', x: 0.48, y: 0.88, rx: 130, ry: 55, shade: '#2A2E37' },
  ];

  maria.forEach(m => {
    const cx = m.x * texWidth;
    const cy = m.y * texHeight;
    const grad = dCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(m.rx, m.ry));
    grad.addColorStop(0, m.shade);
    grad.addColorStop(0.7, m.shade);
    grad.addColorStop(1, '#6E7482');
    dCtx.fillStyle = grad;
    dCtx.beginPath();
    dCtx.ellipse(cx, cy, m.rx, m.ry, 0, 0, Math.PI * 2);
    dCtx.fill();

    const bGrad = bCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(m.rx, m.ry));
    bGrad.addColorStop(0, '#555555');
    bGrad.addColorStop(1, '#808080');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.ellipse(cx, cy, m.rx, m.ry, 0, 0, Math.PI * 2);
    bCtx.fill();
  });

  // Tycho Crater Ray System
  const tychoX = 0.46 * texWidth;
  const tychoY = 0.68 * texHeight;
  dCtx.strokeStyle = 'rgba(235, 240, 250, 0.4)';
  dCtx.lineWidth = 1.5;
  for (let a = 0; a < 24; a++) {
    const angle = (a / 24) * Math.PI * 2;
    const rayLen = 90 + Math.random() * 160;
    dCtx.beginPath();
    dCtx.moveTo(tychoX, tychoY);
    dCtx.lineTo(tychoX + Math.cos(angle) * rayLen, tychoY + Math.sin(angle) * rayLen);
    dCtx.stroke();
  }

  // Major impact craters
  const craters = [
    { x: 0.46, y: 0.68, r: 9, rim: '#FFFFFF' },
    { x: 0.39, y: 0.40, r: 10, rim: '#E6E9F0' },
    { x: 0.32, y: 0.42, r: 6, rim: '#E0E4EE' },
    { x: 0.50, y: 0.98, r: 5, rim: '#CBD5E1' }, // Shackleton
    { x: 0.53, y: 0.96, r: 6, rim: '#CBD5E1' }, // Shoemaker
    { x: 0.44, y: 0.95, r: 7, rim: '#CBD5E1' }, // Haworth
    { x: 0.58, y: 0.94, r: 8, rim: '#CBD5E1' }, // Amundsen
  ];

  craters.forEach(c => {
    const cx = c.x * texWidth;
    const cy = c.y * texHeight;
    dCtx.fillStyle = c.rim;
    dCtx.beginPath();
    dCtx.arc(cx, cy, c.r * 1.3, 0, Math.PI * 2);
    dCtx.fill();

    dCtx.fillStyle = '#262933';
    dCtx.beginPath();
    dCtx.arc(cx, cy, c.r * 0.85, 0, Math.PI * 2);
    dCtx.fill();

    bCtx.fillStyle = '#FFFFFF';
    bCtx.beginPath();
    bCtx.arc(cx, cy, c.r * 1.25, 0, Math.PI * 2);
    bCtx.fill();

    bCtx.fillStyle = '#111111';
    bCtx.beginPath();
    bCtx.arc(cx, cy, c.r * 0.85, 0, Math.PI * 2);
    bCtx.fill();
  });

  cachedDiffuseTexture = new THREE.CanvasTexture(diffuseCanvas);
  cachedDiffuseTexture.wrapS = THREE.RepeatWrapping;
  cachedDiffuseTexture.wrapT = THREE.ClampToEdgeWrapping;

  cachedBumpTexture = new THREE.CanvasTexture(bumpCanvas);
  cachedBumpTexture.wrapS = THREE.RepeatWrapping;
  cachedBumpTexture.wrapT = THREE.ClampToEdgeWrapping;

  return { diffuseTexture: cachedDiffuseTexture, bumpTexture: cachedBumpTexture };
}

function Moon3DComponent({ sites = [], selectedSiteId, onSelectSite }) {
  const mountRef = useRef(null);
  const [hoveredSite, setHoveredSite] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const cameraRef = useRef(null);
  const moonGroupRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0, -3.0, 1.6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 2. Optimized WebGL Renderer (high-performance power preference)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x181E2E, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF6E5, 2.8);
    sunLight.position.set(6, 0.3, 1.8);
    scene.add(sunLight);

    const earthshine = new THREE.DirectionalLight(0x3B82F6, 0.4);
    earthshine.position.set(-4, -2, -1);
    scene.add(earthshine);

    // 4. Moon Group
    const moonGroup = new THREE.Group();
    moonGroupRef.current = moonGroup;
    scene.add(moonGroup);

    // 5. Shared Cached Textures (instant load, 0 lag)
    const { diffuseTexture, bumpTexture } = generateLunarTextures();

    // 6. Geometry: 64 segments (silky 60fps on budget GPUs)
    const moonGeo = new THREE.SphereGeometry(1.0, 64, 64);
    const moonMat = new THREE.MeshStandardMaterial({
      map: diffuseTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.05,
      roughness: 0.94,
      metalness: 0.04,
    });
    moonGroup.add(new THREE.Mesh(moonGeo, moonMat));

    // Outer rim halo
    const atmosphereGeo = new THREE.SphereGeometry(1.015, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x64748B,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    moonGroup.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));

    // 7. Clickable 3D Landing Site Markers
    markersRef.current = [];
    const markerGroup = new THREE.Group();
    moonGroup.add(markerGroup);

    sites.forEach(site => {
      const latRad = (site.lat_deg * Math.PI) / 180.0;
      const lonRad = (site.lon_deg * Math.PI) / 180.0;
      const r = 1.018;

      const x = r * Math.cos(latRad) * Math.sin(lonRad);
      const y = r * Math.sin(latRad);
      const z = -r * Math.cos(latRad) * Math.cos(lonRad);

      const isSelected = site.id === selectedSiteId;
      const isCandidate = site.site_type === 'candidate';

      const markerGeo = new THREE.SphereGeometry(isSelected ? 0.024 : 0.016, 12, 12);
      const markerMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xE5A93C : isCandidate ? 0x38BDF8 : 0x10B981,
      });

      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.set(x, y, z);
      markerMesh.userData = { site };
      markerGroup.add(markerMesh);
      markersRef.current.push(markerMesh);

      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(0.03, 0.04, 18);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xE5A93C,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(x * 1.002, y * 1.002, z * 1.002);
        ringMesh.lookAt(0, 0, 0);
        markerGroup.add(ringMesh);
      }
    });

    // 8. Raycaster for clicking markers
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markersRef.current);

      if (intersects.length > 0) {
        setHoveredSite(intersects[0].object.userData.site);
        container.style.cursor = 'pointer';
      } else {
        setHoveredSite(null);
        container.style.cursor = 'grab';
      }
    };

    const handlePointerDown = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markersRef.current);

      if (intersects.length > 0) {
        const site = intersects[0].object.userData.site;
        if (onSelectSite) onSelectSite(site.id);
      }
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', handlePointerDown);

    // 9. Wheel Zoom - strictly isolated to Moon, 0 window scrolling
    const handleWheelZoom = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const zoomSpeed = 0.0018;
      const currentDist = camera.position.length();
      const newDist = Math.max(1.5, Math.min(4.8, currentDist + e.deltaY * zoomSpeed));
      camera.position.setLength(newDist);
    };

    container.addEventListener('wheel', handleWheelZoom, { passive: false });

    // 10. Drag Orbit
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      container.style.cursor = 'grabbing';
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      moonGroup.rotation.y += deltaX * 0.006;
      moonGroup.rotation.x += deltaY * 0.006;

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // 11. High-Performance Render Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && !isDragging) {
        moonGroup.rotation.y += 0.002;
      }
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('wheel', handleWheelZoom);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
    };
  }, [sites, selectedSiteId, onSelectSite, autoRotate]);

  const focusSouthPole = () => {
    if (!cameraRef.current || !moonGroupRef.current) return;
    moonGroupRef.current.rotation.set(0, 0, 0);
    cameraRef.current.position.set(0, -3.0, 1.6);
    cameraRef.current.lookAt(0, 0, 0);
  };

  const focusEquator = () => {
    if (!cameraRef.current || !moonGroupRef.current) return;
    moonGroupRef.current.rotation.set(0, 0, 0);
    cameraRef.current.position.set(0, 0, 3.2);
    cameraRef.current.lookAt(0, 0, 0);
  };

  return (
    <div className="aerospace-panel p-5 flex flex-col h-full justify-between select-none relative">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#1E2738]">
        <div>
          <span className="text-base font-bold tracking-tight uppercase text-slate-100 font-mono">
            3D Lunar Sphere & Polar Sites
          </span>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Body-fixed sphere with high-albedo highlands, maria & crater rays
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 hidden sm:block">
          Scroll to zoom • Drag to orbit
        </div>
      </div>

      <div
        ref={mountRef}
        className="w-full flex-1 min-h-[350px] relative rounded-lg bg-[#07090E] overflow-hidden border border-[#1A2232] shadow-inner"
      />

      {hoveredSite && (
        <div className="absolute top-18 left-8 pointer-events-none bg-[#0D111A]/95 backdrop-blur-md border border-[#E5A93C]/40 rounded-lg px-3.5 py-2.5 text-xs font-mono shadow-2xl z-20">
          <div className="text-white font-bold text-sm">{hoveredSite.name}</div>
          <div className="text-slate-400 text-xs mt-0.5">
            {hoveredSite.lat_deg.toFixed(4)}° Lat, {hoveredSite.lon_deg.toFixed(4)}° Lon
          </div>
          <div className="text-[#E5A93C] text-[11px] font-bold mt-1">
            Click marker to select site
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between pt-3 mt-2 border-t border-[#1E2738] text-xs font-mono gap-2">
        <div className="flex items-center space-x-2">
          <button
            onClick={focusSouthPole}
            className="px-3 py-1.5 rounded-md bg-[#151B27] text-slate-200 hover:text-white hover:bg-[#1E2738] border border-[#232C3E] btn-aerospace font-medium"
          >
            South Pole (80°S–90°S)
          </button>
          <button
            onClick={focusEquator}
            className="px-3 py-1.5 rounded-md bg-[#151B27] text-slate-200 hover:text-white hover:bg-[#1E2738] border border-[#232C3E] btn-aerospace font-medium"
          >
            Equatorial View
          </button>
        </div>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md border btn-aerospace font-medium ${
            autoRotate
              ? 'bg-[#E5A93C]/15 text-[#E5A93C] border-[#E5A93C]/35'
              : 'bg-[#151B27] text-slate-400 border-[#232C3E] hover:text-white'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          <span>Auto-Rotate</span>
        </button>
      </div>
    </div>
  );
}

export default memo(Moon3DComponent);
