import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeForestWeb3BgProps {
  soundEnabled?: boolean;
}

export function ThreeForestWeb3Bg({ soundEnabled = true }: ThreeForestWeb3BgProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  // Track global clicks to spawn ripple effects in 3D space
  const ripplesRef = useRef<{ mesh: THREE.Mesh; scaleSpeed: number; maxScale: number; opacitySpeed: number }[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Setup Scene, Camera, and Renderer with Alpha (for blending background gradient)
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    // Add atmospheric deep fog to blend the 3D depth with our slate forest canvas
    scene.fog = new THREE.FogExp2(0x020d07, 0.015);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 45;
    camera.position.y = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);

    // 2. Add soft botanical & ambient lighting
    const ambientLight = new THREE.AmbientLight(0x064e3b, 0.6); // emerald hue
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x34d399, 1.2); // mint green
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xd97706, 1.5, 50); // warm amber core
    pointLight.position.set(0, 0, 10);
    scene.add(pointLight);

    // 3. Construct the 3D "Web3 Sacred Tree" (Glowing Mesh & Blockchain Node Structure)
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);

    // Tree Trunk (Cylinder)
    const trunkGeo = new THREE.CylinderGeometry(0.8, 1.8, 14, 8);
    const trunkMat = new THREE.MeshPhongMaterial({
      color: 0x064e3b, // deep forest
      shininess: 30,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = -8;
    treeGroup.add(trunk);

    // Recursive branches & Web3 blockchain nodes
    const branchCount = 12;
    const nodes: THREE.Mesh[] = [];
    const linesGroup = new THREE.Group();
    treeGroup.add(linesGroup);

    const nodeGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const nodeMaterial = new THREE.MeshPhongMaterial({
      color: 0x10b981, // emerald glow
      emissive: 0x047857,
      shininess: 100,
    });

    const pointsArray: THREE.Vector3[] = [new THREE.Vector3(0, -1, 0)]; // trunk top

    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2;
      const radius = 6 + Math.random() * 5;
      const y = Math.random() * 8 + 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const nodePos = new THREE.Vector3(x, y, z);
      pointsArray.push(nodePos);

      // Render actual 3D Node sphere
      const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      nodeMesh.position.copy(nodePos);
      
      // Randomize scales to make them look like ripening Web3 fruit or blocks
      const s = 0.5 + Math.random() * 0.8;
      nodeMesh.scale.set(s, s, s);
      treeGroup.add(nodeMesh);
      nodes.push(nodeMesh);

      // Create a 3D connection line from the trunk head to the node (blockchain link representation)
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -1, 0),
        nodePos
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x059669,
        transparent: true,
        opacity: 0.45,
        linewidth: 1,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      linesGroup.add(line);
    }

    // 4. Create Outer Orbiting "Web3 Consensus Rings"
    const ringGroup = new THREE.Group();
    treeGroup.add(ringGroup);

    const ringGeometry = new THREE.RingGeometry(12, 12.3, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b, // amber
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
    });
    const orbitRing1 = new THREE.Mesh(ringGeometry, ringMaterial);
    orbitRing1.rotation.x = Math.PI / 2.2;
    ringGroup.add(orbitRing1);

    const orbitRing2 = new THREE.Mesh(ringGeometry, ringMaterial);
    orbitRing2.rotation.x = -Math.PI / 2.5;
    orbitRing2.rotation.y = Math.PI / 4;
    orbitRing2.scale.set(1.2, 1.2, 1.2);
    ringGroup.add(orbitRing2);

    // 5. Add 150+ Interactive Starry Fireflies (Particle System)
    const particleCount = 180;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const initialPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Spawn within a spherical domain representing our mystical forest canopy
      const radius = 30 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta) + 5;
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = z;

      // Drift velocity speeds
      velocities[i * 3] = (Math.random() - 0.5) * 0.08;
      velocities[i * 3 + 1] = -0.05 - Math.random() * 0.08; // primary fall
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Custom glowing particle canvas material
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 16;
    pCanvas.height = 16;
    const pCtx = pCanvas.getContext('2d');
    if (pCtx) {
      const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.3, 'rgba(16, 185, 129, 0.8)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 16, 16);
    }

    const pTexture = new THREE.CanvasTexture(pCanvas);
    const particleMaterial = new THREE.PointsMaterial({
      size: 1.4,
      map: pTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });

    const fireflyParticles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(fireflyParticles);

    // 6. Global Interactive Clicks -> Spawns beautiful 3D Ripple Expansions
    const handleGlobalClick = (event: MouseEvent) => {
      // Translate screen coordinates to -1 to +1 NDC
      const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
      const ndcY = -(event.clientY / window.innerHeight) * 2 + 1;

      // Create a 3D circle ripple plane
      const ripGeo = new THREE.RingGeometry(0.1, 0.8, 32);
      const ripMat = new THREE.MeshBasicMaterial({
        color: 0x34d399,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const rippleMesh = new THREE.Mesh(ripGeo, ripMat);
      
      // Project ripple onto a comfortable depth plane (e.g. z = 10)
      const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z; // project to Z = 0
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      
      rippleMesh.position.copy(pos);
      rippleMesh.position.z = 5; // offset slightly
      
      scene.add(rippleMesh);

      ripplesRef.current.push({
        mesh: rippleMesh,
        scaleSpeed: 1.12,
        maxScale: 12 + Math.random() * 8,
        opacitySpeed: 0.015,
      });

      // Quick mini frequency synthesizer chime when clicking
      if (soundEnabled) {
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440 + Math.random() * 300, ctx.currentTime);
          gainNode.gain.setValueAtTime(0, ctx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.65);
        } catch (err) {}
      }
    };

    window.addEventListener('click', handleGlobalClick);

    // 7. Track mouse move globally to simulate forest winds
    const handleMouseMove = (event: MouseEvent) => {
      mouseRef.current.targetX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.targetY = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 8. Handle responsive resize
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. Animation frame loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smoothly interpolate mouse coordinates (inertia)
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      // Rotate tree group based on slow wind & mouse displacement
      treeGroup.rotation.y = elapsedTime * 0.04 + mouseRef.current.x * 0.15;
      treeGroup.rotation.x = mouseRef.current.y * 0.08;

      // Pulsate glowing nodes
      nodes.forEach((node, idx) => {
        const offset = idx * 0.5;
        const scaleVal = 1 + Math.sin(elapsedTime * 2 + offset) * 0.12;
        node.scale.set(scaleVal, scaleVal, scaleVal);
      });

      // Slowly rotate consensus orbit rings
      orbitRing1.rotation.z = -elapsedTime * 0.08;
      orbitRing2.rotation.z = elapsedTime * 0.12;

      // Animate fireflies & drift leaves (apply mouse wind pressure!)
      const positionsAttr = fireflyParticles.geometry.attributes.position as THREE.BufferAttribute;
      const pArr = positionsAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const xIndex = i * 3;
        const yIndex = i * 3 + 1;
        const zIndex = i * 3 + 2;

        // Apply primary fall and wind oscillation
        pArr[yIndex] += velocities[yIndex] + Math.sin(elapsedTime + i) * 0.01;
        pArr[xIndex] += velocities[xIndex] + Math.cos(elapsedTime * 0.5 + i) * 0.03 + mouseRef.current.x * 0.1;
        pArr[zIndex] += velocities[zIndex] + mouseRef.current.y * 0.08;

        // Reset if particles fall below the virtual woodland floor
        if (pArr[yIndex] < -35) {
          pArr[yIndex] = 30 + Math.random() * 10;
          pArr[xIndex] = initialPositions[xIndex];
          pArr[zIndex] = initialPositions[zIndex];
        }
      }
      positionsAttr.needsUpdate = true;

      // Animate 3D Click ripples
      const ripples = ripplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        const currentScale = rip.mesh.scale.x * rip.scaleSpeed;
        rip.mesh.scale.set(currentScale, currentScale, 1);
        
        const mat = rip.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity -= rip.opacitySpeed;

        if (currentScale >= rip.maxScale || mat.opacity <= 0) {
          scene.remove(rip.mesh);
          rip.mesh.geometry.dispose();
          mat.dispose();
          ripples.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 10. Memory cleanups & listener teardowns
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      // Recursive cleanup of WebGL components to free CPU/GPU pipeline
      scene.remove(treeGroup);
      scene.remove(fireflyParticles);
      
      trunkGeo.dispose();
      trunkMat.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      pTexture.dispose();

      ripplesRef.current.forEach((rip) => {
        scene.remove(rip.mesh);
        rip.mesh.geometry.dispose();
        (rip.mesh.material as THREE.Material).dispose();
      });

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [soundEnabled]);

  return (
    <div
      ref={containerRef}
      id="threejs-forest-canopy-ambient"
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
