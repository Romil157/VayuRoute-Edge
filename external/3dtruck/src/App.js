import React, { useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import axios from 'axios';

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFD93D', '#C7F464', '#FF9F1C', '#9D4EDD', '#5A189A', '#00B4D8'];

function Box({ size, position, label, details, color }) {
  const centerPos = size.map((v, i) => position[i] + v / 2);
  const [hovered, setHovered] = useState(false);

  return (
    <group>
      <mesh
        position={centerPos}
        castShadow
        receiveShadow
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[centerPos[0], centerPos[1] + 2, centerPos[2]]} occlude>
        <div style={{
          background: '#f0f0f0',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          border: '1px solid #666'
        }}>{label}</div>
      </Html>
      {hovered && (
        <Html position={[centerPos[0], centerPos[1] + 6, centerPos[2]]}>
          <div style={{
            background: '#fff',
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #333',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            fontSize: '12px'
          }}>
            <strong>Order: {label}</strong><br />
            Size: {size.join('x')}<br />
            {details?.weight && <>Weight: {details.weight}kg</>}
          </div>
        </Html>
      )}
    </group>
  );
}

function Carton({ size, position, boxes, index, onClick }) {
  const volumeUsed = boxes.reduce((acc, box) => acc + (box.size[0] * box.size[1] * box.size[2]), 0);

  return (
    <group position={position} onClick={() => onClick(index, boxes, size)}>
      <mesh position={[size[0] / 2, size[1] / 2, size[2] / 2]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={'#8B4513'} transparent opacity={0.4} />
      </mesh>
      <Html position={[size[0] / 2, size[1] + 2, size[2] / 2]}>
        <div style={{
          background: '#8B4513',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontWeight: 'bold'
        }}>📦 Carton {index + 1}</div>
      </Html>
      {boxes.map((box, j) => (
        <Box
          key={j}
          size={box.size}
          position={box.pos}
          label={box.id}
          details={box}
          color={COLORS[j % COLORS.length]}
        />
      ))}
    </group>
  );
}

function Wheel({ position }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[5, 5, 5, 32]} />
      <meshStandardMaterial color={'#111'} />
    </mesh>
  );
}

function Truck({ cartons, onCartonClick }) {
  const truckSize = [520, 200, 200];
  const truckColor = '#333';
  const columns = 6;
  const rows = 2;
  const layers = 3;
  const cartonSpacing = 2;

  const alignedCartons = cartons.map((carton, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns) % rows;
    const layer = Math.floor(i / (columns * rows));
    return {
      ...carton,
      position: [col * (carton.size[0] + cartonSpacing), row * (carton.size[1] + cartonSpacing), layer * (carton.size[2] + cartonSpacing)]
    };
  });

  return (
    <group position={[-260, 0, -100]}>
      <mesh position={[truckSize[0] / 2, truckSize[1] / 2, truckSize[2] / 2]}>
        <boxGeometry args={truckSize} />
        <meshStandardMaterial color={truckColor} transparent opacity={0.08} />
      </mesh>

      <mesh position={[truckSize[0] + 20, 40, truckSize[2] / 2]}>
        <boxGeometry args={[40, 80, 200]} />
        <meshStandardMaterial color={'#444'} />
      </mesh>

      {[0, 160, 320, 480].map(x => (
        [10, 190].map(z => (
          <Wheel key={`${x}-${z}`} position={[x + 15, -5, z]} />
        ))
      ))}

      {alignedCartons.map((carton, i) => (
        <Carton
          key={i}
          size={carton.size}
          position={carton.position}
          boxes={carton.boxes}
          index={i}
          onClick={onCartonClick}
        />
      ))}

      <Html position={[260, truckSize[1] + 10, truckSize[2] / 2]}>
        <div style={{
          background: '#333',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold'
        }}>🚛 Indian Truck (5.2m x 2m x 2m) with Fixed Cartons</div>
      </Html>
    </group>
  );
}

export default function App() {
  const [cartons, setCartons] = useState([]);
  const [selectedCarton, setSelectedCarton] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:9000/cartons').then(res => {
      const colorMap = new Map();
      let colorIndex = 0;

      const newCartons = res.data.map(carton => {
        const boxesWithColors = carton.boxes.map(box => {
          if (!colorMap.has(box.id)) {
            colorMap.set(box.id, COLORS[colorIndex % COLORS.length]);
            colorIndex++;
          }
          return { ...box, color: colorMap.get(box.id) };
        });
        return { ...carton, boxes: boxesWithColors };
      });

      setCartons(newCartons);
    });
  }, []);

  const handleCartonClick = (index, boxes, size) => {
    const weight = boxes.reduce((acc, box) => acc + (box.weight || 0), 0);
    const volume = boxes.reduce((acc, box) => acc + (box.size[0] * box.size[1] * box.size[2]), 0);
    setSelectedCarton({ index, boxes, size, weight, volume });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [650, 300, 700], fov: 45 }} shadows>
          <ambientLight intensity={0.5} />
          <directionalLight position={[150, 300, 150]} castShadow intensity={1.2} />
          <OrbitControls />
          <Truck cartons={cartons} onCartonClick={handleCartonClick} />
        </Canvas>
      </div>
      <div style={{ width: '320px', padding: '16px', borderLeft: '1px solid #ccc', background: '#f9f9f9' }}>
        {selectedCarton ? (
          <div>
            <h3>📦 Carton {selectedCarton.index + 1}</h3>
            <p><strong>Size:</strong> {selectedCarton.size.join(' x ')}</p>
            <p><strong>Weight Used:</strong> {selectedCarton.weight} kg</p>
            <p><strong>Volume Used:</strong> {selectedCarton.volume} cubic units</p>
            <h4>Orders:</h4>
            <ul>
              {selectedCarton.boxes.map((box, i) => (
                <li key={i}>Order <strong>{box.id}</strong> - Size: {box.size.join(' x ')}, Weight: {box.weight}kg</li>
              ))}
            </ul>
          </div>
        ) : <p>Click a carton to see details.</p>}
      </div>
    </div>
  );
}
