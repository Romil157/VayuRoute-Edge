import React from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from "@react-three/fiber";
const TruckModel = () => {
    return (
        <group scale={[0.5, 0.5, 0.5]} position={[0, 1, 0]}>
            {/* Main Cab */}
            <mesh position={[0, 1.5, 0]}>
                <boxGeometry args={[2.5, 2, 4]} />
                <meshStandardMaterial color="red" />
            </mesh>

            {/* Cabin Top */}
            <mesh position={[0, 3, -1]}>
                <boxGeometry args={[2.5, 1, 1.5]} />
                <meshStandardMaterial color="gray" />
            </mesh>

            {/* Exhaust Pipes */}
            <mesh position={[-1.2, 2.5, 1.5]}>
                <cylinderGeometry args={[0.05, 0.05, 2]} />
                <meshStandardMaterial color="silver" />
            </mesh>
            <mesh position={[1.2, 2.5, 1.5]}>
                <cylinderGeometry args={[0.05, 0.05, 2]} />
                <meshStandardMaterial color="silver" />
            </mesh>

            {/* Trailer */}
            <mesh position={[0, 1.5, -10]}>
                <boxGeometry args={[2.5, 2.5, 12]} />
                <meshStandardMaterial color="#b0b0b0" />
            </mesh>

            {/* Red Stripes */}
            {[...Array(10)].map((_, i) => (
                <mesh key={i} position={[1.26, 2 - i * 0.2, -10]}>
                    <boxGeometry args={[0.02, 0.15, 11.5]} />
                    <meshStandardMaterial color="red" />
                </mesh>
            ))}

            {/* Wheels */}
            {[
                [-1.2, 0.5, 1.8],
                [1.2, 0.5, 1.8],
                [-1.2, 0.5, -1.8],
                [1.2, 0.5, -1.8],
                [-1.2, 0.5, -7],
                [1.2, 0.5, -7],
                [-1.2, 0.5, -10],
                [1.2, 0.5, -10],
                [-1.2, 0.5, -12],
                [1.2, 0.5, -12],
            ].map(([x, y, z], i) => (
                <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.5, 0.5, 0.4, 32]} />
                    <meshStandardMaterial color="black" />
                </mesh>
            ))}
        </group>
    );
};

export default function Scene() {
    return (
        <>
            <Canvas style={{height : "100vh"}} camera={{ position: [6, 6, 6], fov: 45 }} shadows>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 10, 5]} intensity={1} />
                <TruckModel />
                <OrbitControls />

            </Canvas>
        </>
    );
}
