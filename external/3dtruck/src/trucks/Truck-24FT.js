
import { useGLTF } from '@react-three/drei'
import * as THREE from "three";
import { OrbitControls, Stats, Edges } from "@react-three/drei";
import truck from '../data';

export function Truck24(props) {
    const { nodes, materials } = useGLTF('/models/scene (43).glb')
    const BOX_WIDTH = 0.46
    const BOX_LENGTH = 0.46
    const BOX_HEIGHT = 0.41
    const TRUCK_LENGTH = 7.24;
    const TRUCK_WIDTH = 2.44;
    const TRUCK_HEIGHT = 2.6;
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
    return (

        <>
            <mesh position={[TRUCK_WIDTH / 2, TRUCK_HEIGHT / 2, TRUCK_LENGTH / 2]}>
                <boxGeometry args={[TRUCK_WIDTH, TRUCK_HEIGHT, TRUCK_LENGTH]} />
                <meshStandardMaterial color="#cccccc" transparent opacity={0.1} side={THREE.DoubleSide} />
                <Edges scale={1.01} color="#444" />
            </mesh>
            <axesHelper args={[2]} />
            {truck.boxes.map((box, idx) => {
                return (
                    <group
                        key={box.custom_id}
                        position={[
                            box.position.x + BOX_WIDTH / 2,
                            box.position.z + BOX_HEIGHT / 2,
                            box.position.y + BOX_LENGTH / 2,
                        ]}
                    >
                        <mesh>
                            <boxGeometry args={[BOX_WIDTH, BOX_HEIGHT, BOX_LENGTH]} />
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
            <group position={[1.2, -0.2, 0.6]} scale={[1, 0.9, 0.88]} rotation={[0, Math.PI, 0]} dispose={null}>
                <group    {...props} dispose={null}>
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_F_1_1_1.geometry}
                        material={materials.wheelDISK}
                        position={[0.8, -0.501, -4.019]}
                        rotation={[-Math.PI, 0, -Math.PI]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_F_1_1_2.geometry}
                        material={materials.wheelDISK}
                        position={[0.8, -0.501, -4.019]}
                        rotation={[-Math.PI, 0, -Math.PI]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_F_1_1_3.geometry}
                        material={materials.wheelDISK}
                        position={[0.8, -0.501, -5.416]}
                        rotation={[-Math.PI, 0, -Math.PI]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_F_1_1_4.geometry}
                        material={materials.wheelDISK}
                        position={[-0.897, -0.501, -4.019]}
                        rotation={[-Math.PI, 0, 0]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_F_1_1_5.geometry}
                        material={materials.wheelDISK}
                        position={[-0.897, -0.501, -5.389]}
                        rotation={[-Math.PI, 0, 0]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.body_12_1.geometry}
                        material={nodes.body_12_1.material}
                        position={[0, 0.101, 2.245]}
                        scale={[1, 0.04, 1]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle.geometry}
                        material={nodes.Circle.material}
                        position={[1.005, -0.477, 1.915]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_1.geometry}
                        material={nodes.Circle_1.material}
                        position={[0.834, -0.477, 1.915]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_2.geometry}
                        material={nodes.Circle_2.material}
                        position={[1.005, -0.477, 1.915]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_3.geometry}
                        material={nodes.Circle_3.material}
                        position={[0.912, -0.477, -4.077]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_4.geometry}
                        material={nodes.Circle_4.material}
                        position={[0.852, -0.477, -5.404]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_5.geometry}
                        material={nodes.Circle_5.material}
                        position={[0.852, -0.477, -5.404]}
                        rotation={[0, Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_6.geometry}
                        material={nodes.Circle_6.material}
                        position={[-0.899, -0.477, -5.404]}
                        rotation={[0, -Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_7.geometry}
                        material={nodes.Circle_7.material}
                        position={[-0.899, -0.477, -4.015]}
                        rotation={[0, -Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.Circle_8.geometry}
                        material={nodes.Circle_8.material}
                        position={[-0.899, -0.477, 1.929]}
                        rotation={[0, -Math.PI / 2, 0]}
                        scale={[0.62, 0.62, 0.83]}
                    />
                    <group position={[0, 0.42, 2.02]}>
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_1.geometry}
                            material={materials.Mercedes_kapote}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_2.geometry}
                            material={materials.effect_ShadedGlass}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_3.geometry}
                            material={materials.Mercedes_kabBACK}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_4.geometry}
                            material={materials.Mercedes_air1}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_5.geometry}
                            material={materials._black}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_6.geometry}
                            material={materials.Mercedes_kabFRONT1}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_7.geometry}
                            material={materials.Mercedes_kabSIDE}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_8.geometry}
                            material={materials.Mercedes_kabTOP}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_9.geometry}
                            material={materials.Mercedes_parts1}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_10.geometry}
                            material={materials.Mercedes_stupen1}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_11.geometry}
                            material={materials.Mercedes_butt}
                        />
                        {/* <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_12.geometry}
                            material={materials.Mercedes_carriage}
                            position={[-0.093, 0, 0.154]}
                        /> */}
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_13.geometry}
                            material={materials.common_shveller}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_14.geometry}
                            material={materials.c_metalic}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_15.geometry}
                            material={materials.common_engFRONT}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_16.geometry}
                            material={materials.common_engSIDE}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_17.geometry}
                            material={materials.common_engTOP}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_18.geometry}
                            material={materials.common_mirrorBACK}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_19.geometry}
                            material={materials.common_mirrorFACE}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.body_20.geometry}
                            material={materials.common_BackLights}
                        />
                    </group>
                    <group position={[-0.835, -0.49, 1.97]} scale={0.926}>
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.wheel_F.geometry}
                            material={materials.wheelQUARTER}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.wheel_F_1.geometry}
                            material={materials.wheelDISK}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.wheel_F_2.geometry}
                            material={materials.wheelPROT}
                        />
                    </group>
                    <group position={[0.835, -0.49, 1.97]} rotation={[-Math.PI, 0, -Math.PI]} scale={0.926}>
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.wheel_F_1_1.geometry}
                            material={materials.wheelDISK}
                        />
                        <mesh
                            castShadow
                            receiveShadow
                            geometry={nodes.wheel_F_2_1.geometry}
                            material={materials.wheelPROT}
                        />
                    </group>
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_B_1.geometry}
                        material={materials.wheelPROT}
                        position={[-0.6, -0.49, -5.45]}
                        scale={0.926}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_B_1_1.geometry}
                        material={materials.wheelPROT}
                        position={[-0.6, -0.49, -4.05]}
                        scale={0.926}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_B_1_2.geometry}
                        material={materials.wheelPROT}
                        position={[0.6, -0.49, -4.05]}
                        rotation={[-Math.PI, 0, -Math.PI]}
                        scale={0.926}
                    />
                    <mesh
                        castShadow
                        receiveShadow
                        geometry={nodes.wheel_B_1_3.geometry}
                        material={materials.wheelPROT}
                        position={[0.6, -0.49, -5.45]}
                        rotation={[-Math.PI, 0, -Math.PI]}
                        scale={0.926}
                    />
                </group>
            </group>
        </>

    )
}

useGLTF.preload('/models/scene (43).glb')


