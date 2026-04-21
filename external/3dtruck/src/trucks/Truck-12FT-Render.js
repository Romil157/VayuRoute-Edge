import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Truck12 } from './Truck-12FT'


export default function Truck12Render() {
  return (

    <div className='fullscreen-container'>

      <Canvas style={{ height: "100vh", backgroundColor: "#eaeaea" }} camera={{ position: [6, 6, 6], fov: 45 }} shadows>
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
        <Truck12 scale={0.1} />
        <OrbitControls enableZoom={true} />
      </Canvas>
    </div>
  )
}
