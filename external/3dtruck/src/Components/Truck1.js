import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stats, Edges } from "@react-three/drei";
import * as THREE from "three";
import React, { useEffect, useMemo, useState } from "react";
import { Html } from "@react-three/drei"; // For floating legend panel


// Box dimensions
const BOX_LENGTH = 0.46;
// const BOX_WIDTH = 0.46;
const BOX_WIDTH = 0.46;
const BOX_HEIGHT = 0.41;

var different = {
  "b1": { "length": 0.8, "width": 0.6, "height": 0.6 },
  "b2": { "length": 0.4, "width": 0.4, "height": 0.4 },
  "b3": { "length": 0.6, "width": 0.4, "height": 0.6 },
  "b4": { "length": 0.8, "width": 0.8, "height": 0.8 },
}


// Priority-color map
const PRIORITY_COLORS = { 
  1: "#FFA500",   // Orange
  2: "#87CEEB",   // Sky Blue
  3: "#34D399",   // Green
  4: "#f472b6",   // Pink
  5: "#A78BFA",   // Purple
  6: "#FBBF24",   // Amber
  7: "#60A5FA",   // Blue
  8: "#F87171",   // Red
  9: "#4ADE80",   // Light Green
  10: "#C084FC",  // Lavender
  11: "#FACC15",  // Yellow
  12: "#2DD4BF",  // Teal
  13: "#FB923C",  // Deep Orange
  14: "#38BDF8",  // Light Blue
  15: "#E879F9",  // Magenta
  16: "#A3E635",  // Lime
  17: "#F43F5E",  // Rose
  18: "#06B6D4",  // Cyan
  19: "#F59E0B",  // Dark Yellow
  20: "#3B82F6",  // Primary Blue
  21: "#D946EF",  // Orchid
  22: "#10B981",  // Emerald
  23: "#F97316",  // Bright Orange
  24: "#2563EB",  // Royal Blue
  25: "#EC4899",  // Deep Pink
  26: "#22C55E",  // Forest Green
  27: "#EAB308",  // Golden
  28: "#8B5CF6",  // Violet
  29: "#EF4444",  // Bold Red
  30: "#14B8A6",  // Aqua
  31: "#FFA500",   // Orange
  32: "#87CEEB",   // Sky Blue
  33: "#34D399",   // Green
  34: "#f472b6",   // Pink
  35: "#A78BFA",   // Purple
  36: "#FBBF24",   // Amber
  37: "#60A5FA",   // Blue
  38: "#F87171",   // Red
  39: "#4ADE80",   // Light Green
  40: "#C084FC",
};


function DetailedWheel({ position }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 0.2, 32]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.21, 32]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.05, 0.05, 0.22, 16]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.5} roughness={0.1} />
      </mesh>
    </group>
  );
}

export default function TruckView({ truck, showWeights }) {

  const [ignorePriorites, setIgnorePrioriteis] = useState(new Set([]))


  const rowWiseWeightMap = useMemo(() => {
    const map = new Map();

    truck.boxes.forEach(box => {
      const xKey = box.position.x.toFixed(2); // Avoid float precision bugs
      const prev = map.get(xKey) || 0;
      map.set(xKey, prev + box.weight);
    });

    return [...map.entries()].map(([x, weight]) => ({
      x: parseFloat(x),
      weight
    }));
  }, [truck.boxes]);

  let dim = truck.dimensions
  const TRUCK_LENGTH = dim.length.value;
  const TRUCK_WIDTH = dim.width.value
  const TRUCK_HEIGHT = dim.height.value;

  console.log(TRUCK_LENGTH, TRUCK_WIDTH, TRUCK_HEIGHT)

  // Group boxes by customer with color for each priority
  var id = truck.boxes.map((e) => e.custom_id)


  return (
    <>
      {/* Truck 3D View */}
      <group>
        {/* Transparent container */}
        <mesh position={[TRUCK_WIDTH / 2, TRUCK_HEIGHT / 2, TRUCK_LENGTH / 2]}>
          <boxGeometry args={[TRUCK_WIDTH, TRUCK_HEIGHT, TRUCK_LENGTH]} />
          <meshStandardMaterial color="#cccccc" transparent opacity={0.1} side={THREE.DoubleSide} />
          <Edges scale={1.01} color="#444" />
        </mesh>

        {/* Wheels */}
        {[0.3, 1.7].map((x, i) => (
          <React.Fragment key={i}>
            {/* front wheel */}
            <DetailedWheel position={[x, -0.25, -0.5]} />

            {/* rear wheel */}
            <DetailedWheel position={[x, -0.3, TRUCK_LENGTH - 0.5]} />
          </React.Fragment>
        ))}

        {showWeights &&
          rowWiseWeightMap.map(({ x, weight }, idx) => (
            <Html
              key={idx}
              position={[x + BOX_WIDTH / 2, TRUCK_HEIGHT + 0.2, TRUCK_LENGTH / 2]}
              center
              distanceFactor={5}
              occlude
              className="tooltip-box "
            >
              <div><strong>Total:</strong> {weight.toFixed(1)} kg</div>
            </Html>
          ))}

        {/* Boxes */}
        {truck.boxes.map((box, idx) => {
          if (ignorePriorites.has(box.priority)) return null

          return (
            <group
              key={box.custom_id}
              // position={[
              //   box.position.x + BOX_WIDTH / 2,
              //   box.position.z + BOX_HEIGHT / 2,
              //   box.position.y + BOX_LENGTH / 2,
              // ]}
              position={[
                box.position.x + different[box["box_type"]].width / 2,
                box.position.z + different[box["box_type"]].height / 2,
                box.position.y + different[box["box_type"]]["length"] / 2,
              ]}
            >
              <mesh>
                {/* <boxGeometry args={[BOX_WIDTH, BOX_HEIGHT, BOX_LENGTH]} /> */}
                <boxGeometry args={[different[box["box_type"]].width, different[box["box_type"]].height, different[box["box_type"]]["length"]]} />
                <meshStandardMaterial
                  color={PRIORITY_COLORS[box.priority] || "#999"}
                  roughness={0.4}
                  metalness={0.1}
                />
                <Edges scale={1.03} color="#111" />
              </mesh>
            </group>
          )
        })}
        <axesHelper args={[2]} />

        {/* Front Cab */}
        <group position={[TRUCK_WIDTH / 2, TRUCK_HEIGHT / 4, -0.5]}>
          <mesh>
            <boxGeometry args={[TRUCK_WIDTH * 0.9, TRUCK_HEIGHT * 0.5, 1.0]} />
            <meshStandardMaterial color="red" metalness={0.5} roughness={0.2} />
          </mesh>
        </group>
      </group>

      {/* Customer Color Panel (Legend) */}
    </>
  );
}
