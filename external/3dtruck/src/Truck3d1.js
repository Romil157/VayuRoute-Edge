import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Model } from './Truck3d'

export default function Truck3d() {
  return (

    <div className='fullscreen-container'>

      <Canvas style={{ height: "100vh", backgroundColor: "#eaeaea" }} camera={{ position: [6, 6, 6], fov: 45 }} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <Model scale={1} />
        <OrbitControls enableZoom={true} />
      </Canvas>
    </div>
  )
}
