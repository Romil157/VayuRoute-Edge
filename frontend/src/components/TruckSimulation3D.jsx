import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Clone, Grid, Html, Line, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const CENTER = { lat: 19.04, lng: 72.85 };
const SCALE = 1000;

function toScenePoint(point) {
  return [
    (point.lng - CENTER.lng) * SCALE,
    0,
    (point.lat - CENTER.lat) * SCALE,
  ];
}

function RouteRibbon({ coordinates = [], color, opacity = 1, dashed = false }) {
  if (coordinates.length < 2) {
    return null;
  }

  return (
    <Line
      points={coordinates.map((point) => toScenePoint(point))}
      color={color}
      transparent
      opacity={opacity}
      lineWidth={dashed ? 1.5 : 2.8}
      dashed={dashed}
      dashScale={20}
      dashSize={3}
      gapSize={2}
    />
  );
}

function FleetTruck({ vehicle }) {
  const ref = useRef();
  const { scene } = useGLTF('/models/truck.glb');
  const targetPoint = toScenePoint(vehicle.telemetry.coordinate);
  const heading = THREE.MathUtils.degToRad(-(vehicle.telemetry.heading_deg || 0)) + Math.PI / 2;
  const length = vehicle.truck_profile?.dimensions?.length_m ?? 7.32;
  const scale = 0.6 * (length / 7.32);

  useFrame(() => {
    if (!ref.current) {
      return;
    }

    ref.current.position.lerp(
      new THREE.Vector3(targetPoint[0], 0.4, targetPoint[2]),
      0.14,
    );
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, heading, 0.12);
  });

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.4, 2, 48]} />
        <meshBasicMaterial color={vehicle.color} transparent opacity={0.9} />
      </mesh>

      <group scale={[scale, scale, scale]} position={[0, 0.25, 0]}>
        <Clone object={scene} />
      </group>

      <Html position={[0, 2.8, 0]} center>
        <div className="truck-label">
          <strong>{vehicle.id}</strong>
          <span>{vehicle.telemetry.speed_kmh} km/h</span>
        </div>
      </Html>
    </group>
  );
}

function SimulationScene({ data, routingMode }) {
  if (!data?.vehicles?.length) {
    return null;
  }

  return (
    <>
      <color attach="background" args={['#08101b']} />
      <fog attach="fog" args={['#08101b', 45, 120]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[18, 26, 14]} intensity={2.4} castShadow />
      <pointLight position={[-20, 18, -12]} intensity={1.1} color="#38bdf8" />

      <PerspectiveCamera makeDefault position={[0, 26, 42]} fov={42} />
      <OrbitControls
        enablePan={false}
        minDistance={18}
        maxDistance={70}
        maxPolarAngle={Math.PI / 2.15}
      />

      <Grid
        position={[0, -0.01, 0]}
        args={[120, 120]}
        cellSize={3}
        cellThickness={0.6}
        cellColor="#102338"
        sectionSize={12}
        sectionThickness={1.2}
        sectionColor="#15314d"
        fadeDistance={80}
        fadeStrength={1}
      />

      {data.vehicles.map((vehicle) => (
        <group key={`route-${vehicle.id}`}>
          {routingMode === 'AI' ? (
            <>
              <RouteRibbon coordinates={vehicle.baseline.coordinates} color="#f97316" opacity={0.18} dashed />
              <RouteRibbon coordinates={vehicle.ai.coordinates} color={vehicle.color} opacity={0.95} />
            </>
          ) : (
            <>
              <RouteRibbon coordinates={vehicle.ai.coordinates} color={vehicle.color} opacity={0.2} dashed />
              <RouteRibbon coordinates={vehicle.baseline.coordinates} color="#94a3b8" opacity={0.9} />
            </>
          )}
          <FleetTruck vehicle={vehicle} />
        </group>
      ))}
    </>
  );
}

export default function TruckSimulation3D({ data, routingMode }) {
  if (!data?.vehicles?.length) {
    return <div className="empty-state">Waiting for truck simulation state...</div>;
  }

  return (
    <div className="simulation-shell">
      <Canvas shadows dpr={[1, 1.5]}>
        <SimulationScene data={data} routingMode={routingMode} />
      </Canvas>
      <div className="simulation-legend">
        <span>3D truck asset sourced from `external/3dtruck`.</span>
        <span>Cloudtrack load class and live telemetry are projected onto each vehicle.</span>
      </div>
    </div>
  );
}

useGLTF.preload('/models/truck.glb');
