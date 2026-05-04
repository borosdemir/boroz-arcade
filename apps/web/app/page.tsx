"use client";

import React, { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Float } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function RotatingCube() {
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh rotation={[45, 45, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.5} wireframe />
      </mesh>
    </Float>
  );
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  const handleLogin = async () => {
    router.push("/login");
  };

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Suspense fallback={null}>
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <RotatingCube />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
          </Suspense>
        </Canvas>
      </div>

      {/* Overlay Content */}
      <div className="relative z-10 text-center space-y-8 p-4">
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 drop-shadow-2xl animate-pulse">
          BOROZ ARCADE
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 font-light tracking-widest uppercase">
          The Future of Web Multiplayer (2026)
        </p>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mt-8">
          {user ? (
            <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <p className="text-gray-400 mb-2">Bienvenido, Guerrero</p>
              <p className="text-white font-bold">{user.email}</p>
              <button 
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.refresh();
                }}
                className="mt-4 px-6 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <>
              <button 
                onClick={handleLogin}
                className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-blue-500 hover:text-white transition-all duration-300 transform hover:scale-110 shadow-lg shadow-blue-500/20"
              >
                ENTRAR AL JUEGO
              </button>
              <button className="px-8 py-4 border border-white/20 text-white font-bold rounded-full hover:bg-white/10 transition-all duration-300">
                VER LEADERBOARD
              </button>
            </>
          )}
        </div>
        
        <div className="pt-12 flex items-center justify-center gap-8">
           <div className="text-xs text-gray-500">
             <p className="font-bold text-gray-300 uppercase">Supabase Auth</p>
             <p className={user ? "text-green-400" : "text-yellow-400"}>
               {user ? "Conectado" : "Esperando credenciales..."}
             </p>
           </div>
           <div className="text-xs text-gray-500">
             <p className="font-bold text-gray-300 uppercase">Real-time Engine</p>
             <p className="text-blue-400 italic">Próximamente (Nakama)</p>
           </div>
        </div>
      </div>
    </main>
  );
}
