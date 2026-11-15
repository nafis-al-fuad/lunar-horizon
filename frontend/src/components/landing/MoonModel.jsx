import React, { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Center, Bounds } from '@react-three/drei'
import * as THREE from 'three'

function Moon() {
  const moonRef = useRef(null)
  const { scene } = useGLTF('/models/moon_small.glb')

  useFrame((_, delta) => {
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.12
    }
  })

  return (
    <Bounds fit clip margin={1.3}>
      <Center>
        <group ref={moonRef}>
          <primitive object={scene} />
        </group>
      </Center>
    </Bounds>
  )
}

export default function MoonModel() {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 35 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight position={[3, 2, 4]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-4, 1, -2]} intensity={2} color="#172b59" distance={12} />

        <Suspense fallback={null}>
          <Moon />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/moon_small.glb')
