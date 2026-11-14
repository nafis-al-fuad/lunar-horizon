import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RotateCw, Compass, Crosshair, Eye } from 'lucide-react';

export default function Moon3D({ sites = [], selectedSiteId, onSelectSite }) {
  const mountRef = useRef(null);
  const [hoveredSite, setHoveredSite] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const moonGroupRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    // Position focused down toward the Lunar South Pole (80°S-90°S)
    camera.position.set(0, -3.0, 1.6);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Realistic Space Lighting
    // Faint deep-space starlight fill
    const ambientLight = new THREE.AmbientLight(0x181E2E, 0.9);
    scene.add(ambientLight);

    // Directional grazing solar light (mimicking 1.54° polar grazing geometry)
    const sunLight = new THREE.DirectionalLight(0xFFF6E5, 2.8);
    sunLight.position.set(6, 0.3, 1.8);
    scene.add(sunLight);

    // Secondary subtle earthshine on the lunar near side
    const earthshine = new THREE.DirectionalLight(0x3B82F6, 0.4);
    earthshine.position.set(-4, -2, -1);
    scene.add(earthshine);

    // 4. Moon Group
    const moonGroup = new THREE.Group();
    moonGroupRef.current = moonGroup;
    scene.add(moonGroup);

    // 5. High-Fidelity Realistic Procedural Lunar Surface Textures (Diffuse + Bump)
    const texWidth = 2048;
    const texHeight = 1024;

    // Diffuse / Albedo Canvas
    const diffuseCanvas = document.createElement('canvas');
    diffuseCanvas.width = texWidth;
    diffuseCanvas.height = texHeight;
    const dCtx = diffuseCanvas.getContext('2d');

    // Bump / Relief Canvas
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = texWidth;
    bumpCanvas.height = texHeight;
    const bCtx = bumpCanvas.getContext('2d');

    // Base Lunar Anorthosite Highland Regolith (Muted grey-tan)
    dCtx.fillStyle = '#6E7482';
    dCtx.fillRect(0, 0, texWidth, texHeight);

    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, texWidth, texHeight);

    // Add fine regolith noise grain
    for (let i = 0; i < 8000; i++) {
      const rx = Math.random() * texWidth;
      const ry = Math.random() * texHeight;
      const shade = Math.floor(95 + Math.random() * 40);
      dCtx.fillStyle = `rgb(${shade},${shade + 2},${shade + 4})`;
      dCtx.fillRect(rx, ry, 2, 2);
    }

    // Major Lunar Maria (Dark Basaltic Plains)
    const maria = [
      { name: 'Oceanus Procellarum', x: 0.30, y: 0.42, rx: 220, ry: 260, shade: '#343844' },
      { name: 'Mare Imbrium', x: 0.38, y: 0.32, rx: 150, ry: 130, shade: '#2F333E' },
      { name: 'Mare Serenitatis', x: 0.54, y: 0.35, rx: 110, ry: 100, shade: '#323642' },
      { name: 'Mare Tranquillitatis', x: 0.58, y: 0.46, rx: 120, ry: 110, shade: '#30343F' },
      { name: 'Mare Crisium', x: 0.69, y: 0.40, rx: 75, ry: 70, shade: '#2A2E38' },
      { name: 'Mare Fecunditatis', x: 0.65, y: 0.56, rx: 100, ry: 90, shade: '#333742' },
      { name: 'Mare Nectaris', x: 0.59, y: 0.58, rx: 65, ry: 60, shade: '#353945' },
      { name: 'Mare Nubium', x: 0.42, y: 0.60, rx: 95, ry: 90, shade: '#353944' },
      { name: 'Mare Humorum', x: 0.33, y: 0.62, rx: 55, ry: 50, shade: '#313540' },
      // South Pole-Aitken (SPA) Basin (Vast far-side depression extending to South Pole)
      { name: 'SPA Basin', x: 0.48, y: 0.88, rx: 260, ry: 110, shade: '#2A2E37' },
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

      // Bump depression
      const bGrad = bCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(m.rx, m.ry));
      bGrad.addColorStop(0, '#555555');
      bGrad.addColorStop(1, '#808080');
      bCtx.fillStyle = bGrad;
      bCtx.beginPath();
      bCtx.ellipse(cx, cy, m.rx, m.ry, 0, 0, Math.PI * 2);
      bCtx.fill();
    });

    // Tycho Crater with Radial Ray System (Dominates southern near side)
    const tychoX = 0.46 * texWidth;
    const tychoY = 0.68 * texHeight;
    // Radiant white ejecta rays
    dCtx.strokeStyle = 'rgba(235, 240, 250, 0.45)';
    dCtx.lineWidth = 1.8;
    for (let a = 0; a < 36; a++) {
      const angle = (a / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
      const rayLen = 180 + Math.random() * 320;
      dCtx.beginPath();
      dCtx.moveTo(tychoX, tychoY);
      dCtx.lineTo(tychoX + Math.cos(angle) * rayLen, tychoY + Math.sin(angle) * rayLen);
      dCtx.stroke();
    }

    // Prominent Impact Craters (Tycho, Copernicus, Kepler, South Polar Craters)
    const majorCraters = [
      { x: 0.46, y: 0.68, r: 18, rim: '#FFFFFF', name: 'Tycho' },
      { x: 0.39, y: 0.40, r: 20, rim: '#E6E9F0', name: 'Copernicus' },
      { x: 0.32, y: 0.42, r: 12, rim: '#E0E4EE', name: 'Kepler' },
      // South Polar Craters (Near -90° South Pole, y ~ 0.95 to 1.0)
      { x: 0.50, y: 0.98, r: 8, rim: '#CBD5E1', name: 'Shackleton' },
      { x: 0.53, y: 0.96, r: 10, rim: '#CBD5E1', name: 'Shoemaker' },
      { x: 0.57, y: 0.97, r: 9, rim: '#CBD5E1', name: 'Faustini' },
      { x: 0.46, y: 0.97, r: 11, rim: '#CBD5E1', name: 'de Gerlache' },
      { x: 0.44, y: 0.95, r: 13, rim: '#CBD5E1', name: 'Haworth' },
      { x: 0.58, y: 0.94, r: 14, rim: '#CBD5E1', name: 'Amundsen' },
      { x: 0.52, y: 0.94, r: 16, rim: '#CBD5E1', name: 'Nobile' },
    ];

    majorCraters.forEach(c => {
      const cx = c.x * texWidth;
      const cy = c.y * texHeight;

      // Bright ejecta rim
      dCtx.fillStyle = c.rim;
      dCtx.beginPath();
      dCtx.arc(cx, cy, c.r * 1.3, 0, Math.PI * 2);
      dCtx.fill();

      // Dark floor
      dCtx.fillStyle = '#262933';
      dCtx.beginPath();
      dCtx.arc(cx, cy, c.r * 0.85, 0, Math.PI * 2);
      dCtx.fill();

      // Central peak
      dCtx.fillStyle = '#BAC2D1';
      dCtx.beginPath();
      dCtx.arc(cx, cy, c.r * 0.2, 0, Math.PI * 2);
      dCtx.fill();

      // Bump map crater: high rim, deep interior
      bCtx.fillStyle = '#FFFFFF';
      bCtx.beginPath();
      bCtx.arc(cx, cy, c.r * 1.25, 0, Math.PI * 2);
      bCtx.fill();

      bCtx.fillStyle = '#111111';
      bCtx.beginPath();
      bCtx.arc(cx, cy, c.r * 0.85, 0, Math.PI * 2);
      bCtx.fill();
    });

    // Hundreds of realistic micro-craters across the lunar body
    for (let i = 0; i < 450; i++) {
      const cx = Math.random() * texWidth;
      const cy = Math.random() * texHeight;
      const cr = 2 + Math.random() * 8;

      dCtx.fillStyle = 'rgba(220, 225, 235, 0.4)';
      dCtx.beginPath();
      dCtx.arc(cx, cy, cr * 1.2, 0, Math.PI * 2);
      dCtx.fill();

      dCtx.fillStyle = 'rgba(30, 34, 42, 0.7)';
      dCtx.beginPath();
      dCtx.arc(cx, cy, cr * 0.8, 0, Math.PI * 2);
      dCtx.fill();

      bCtx.fillStyle = '#C0C0C0';
      bCtx.beginPath();
      bCtx.arc(cx, cy, cr * 1.2, 0, Math.PI * 2);
      bCtx.fill();

      bCtx.fillStyle = '#303030';
      bCtx.beginPath();
      bCtx.arc(cx, cy, cr * 0.8, 0, Math.PI * 2);
      bCtx.fill();
    }

    const diffuseTexture = new THREE.CanvasTexture(diffuseCanvas);
    diffuseTexture.wrapS = THREE.RepeatWrapping;
    diffuseTexture.wrapT = THREE.ClampToEdgeWrapping;

    const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
    bumpTexture.wrapS = THREE.RepeatWrapping;
    bumpTexture.wrapT = THREE.ClampToEdgeWrapping;

    // 6. Lunar Mesh with Material Properties
    const moonGeo = new THREE.SphereGeometry(1.0, 96, 96);
    const moonMat = new THREE.MeshStandardMaterial({
      map: diffuseTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.05,
      roughness: 0.94,
      metalness: 0.04,
    });

    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    // Subtle atmospheric / space rim halo
    const atmosphereGeo = new THREE.SphereGeometry(1.015, 64, 64);
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
      // Body-fixed spherical mapping:
      // lat: -90 (South Pole) to +90
      // lon: 0 to 360
      const latRad = (site.lat_deg * Math.PI) / 180.0;
      const lonRad = (site.lon_deg * Math.PI) / 180.0;

      const r = 1.018; // slightly above surface
      const x = r * Math.cos(latRad) * Math.sin(lonRad);
      const y = r * Math.sin(latRad);
      const z = -r * Math.cos(latRad) * Math.cos(lonRad);

      const isSelected = site.id === selectedSiteId;
      const isCandidate = site.site_type === 'candidate';

      // Pin Marker Mesh
      const markerGeo = new THREE.SphereGeometry(isSelected ? 0.024 : 0.016, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xE5A93C : isCandidate ? 0x38BDF8 : 0x10B981,
      });

      const markerMesh = new THREE.Mesh(markerGeo, markerMat);
      markerMesh.position.set(x, y, z);
      markerMesh.userData = { site };
      markerGroup.add(markerMesh);
      markersRef.current.push(markerMesh);

      // Selected ring
      if (isSelected) {
        const ringGeo = new THREE.RingGeometry(0.03, 0.04, 24);
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

    // 8. Raycaster for clicking markers & hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markersRef.current);

      if (intersects.length > 0) {
        const site = intersects[0].object.userData.site;
        setHoveredSite(site);
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

    // 9. Wheel Zoom - ISOLATED TO MOON ONLY (PREVENT PAGE SCROLL)
    const handleWheelZoom = (e) => {
      // Strictly prevent browser page scrolling
      e.preventDefault();
      e.stopPropagation();

      const zoomSpeed = 0.0018;
      const currentDist = camera.position.length();
      const newDist = Math.max(1.5, Math.min(4.8, currentDist + e.deltaY * zoomSpeed));
      camera.position.setLength(newDist);
    };

    // Attach with passive: false so preventDefault works reliably
    container.addEventListener('wheel', handleWheelZoom, { passive: false });

    // 10. Drag Orbit Controls
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

      // Rotate moon group smoothly
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

    // 11. Render Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (autoRotate && !isDragging) {
        moonGroup.rotation.y += 0.002;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 12. Cleanup on unmount
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

  // Camera Focus Buttons
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
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#1E2738]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-base font-bold tracking-tight uppercase text-slate-100 font-mono">
              3D Lunar Sphere & Polar Sites
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Body-fixed sphere with high-albedo highlands, maria & crater rays
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 hidden sm:block">
          Scroll to zoom • Drag to orbit
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        className="w-full flex-1 min-h-[350px] relative rounded-lg bg-[#07090E] overflow-hidden border border-[#1A2232] shadow-inner"
      />

      {/* Hover Tooltip Overlay */}
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

      {/* Bottom Camera Quick Focus Controls */}
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