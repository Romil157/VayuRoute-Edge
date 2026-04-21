import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats, Edges } from "@react-three/drei";
import * as THREE from "three";

const BOX_LENGTH = 0.46;
const BOX_WIDTH = 0.46;
const BOX_HEIGHT = 0.41;

// Generate 50 boxes placed layer by layer
const generatedBoxes = [];
let boxCount = 0;
for (let y = 0; y < 10 && boxCount < 50; y++) {
  for (let z = 0; z < 4 && boxCount < 50; z++) {
    for (let x = 0; x < 4 && boxCount < 50; x++) {
      generatedBoxes.push({
        custom_id: `Box#${boxCount + 1}`,
        position: {
          x: x * BOX_WIDTH,
          y: y * BOX_LENGTH,
          z: z * BOX_HEIGHT,
        },
      });
      boxCount++;
    }
  }
}

const sampleTruck = {
  length: 3.66,
  width: 2.0,
  height: 2.0,
  boxes: generatedBoxes,
};


function DetailedWheel({ position }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      {/* Tire (outer wheel) */}
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 0.2, 32]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Rim (inner lighter ring) */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.21, 32]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Center Cap */}
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, 0.22, 16]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.5} roughness={0.1} />
      </mesh>
    </group>
  );
}




function TruckView({ truck }) {
  return (
    <group position={[0, 0, 0]}>
      {/* Truck Container */}
      <mesh position={[truck.width / 2, truck.height / 2, truck.length / 2]}>
        <boxGeometry args={[truck.width, truck.height, truck.length]} />
        <meshStandardMaterial color="#cccccc" transparent opacity={0.1} side={THREE.DoubleSide} />
        <Edges scale={1.01} color="#444" />
      </mesh>

      {/* Wheels */}
      {[0.3, 1.7].map((x, i) => (
        <>
          {/* Front Wheels */}
          <DetailedWheel key={`wheel-front-${i}`} position={[x, -0.2, -0.5]} />

          {/* Rear Wheels */}
          <DetailedWheel key={`wheel-rear-${i}`} position={[x, -0.3, truck.length - 0.5]} />
        </>
      ))}
      {/* Boxes */}
      {truck.boxes.map((box, idx) => (
        <group
          key={idx}
          position={[
            box.position.x + BOX_WIDTH / 2,
            box.position.z + BOX_HEIGHT / 2,
            box.position.y + BOX_LENGTH / 2,
          ]}
        >
          <mesh>
            <boxGeometry args={[BOX_WIDTH, BOX_HEIGHT, BOX_LENGTH]} />
            <meshStandardMaterial
              color={box.custom_id.includes("High") ? "#FFA500" : "#87CEEB"}
              roughness={0.4}
              metalness={0.1}
            />
            <Edges scale={1.03} color="#111" />
          </mesh>
        </group>
      ))}

      {/* Front of Truck (Cab) */}
      <group position={[truck.width / 2, truck.height / 4, -0.5]}>
        <mesh>
          <boxGeometry args={[truck.width * 0.9, truck.height * 0.5, 1.0]} />
          <meshStandardMaterial color="red" metalness={0.5} roughness={0.2} />
          {/* <Edges scale={1.02} color="#000" /> */}
        </mesh>

      </group>
    </group>
  );
}

export default function App2() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#eaeaea" }}>
      <Canvas camera={{ position: [6, 6, 6], fov: 45 }} shadows>
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <TruckView truck={sampleTruck} />
        <OrbitControls enableZoom={true} />
        {/* <Stats /> */}
      </Canvas>
    </div>
  );
}
