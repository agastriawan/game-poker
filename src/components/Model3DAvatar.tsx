"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// Cache in-memory untuk menyimpan GLTF yang sudah di-load agar tidak download ulang
const gltfCache = new Map<string, GLTF>();
const gltfLoadingPromises = new Map<string, Promise<GLTF>>();

function loadGLTFWithCache(url: string): Promise<GLTF> {
  if (gltfCache.has(url)) {
    return Promise.resolve(gltfCache.get(url)!);
  }
  if (gltfLoadingPromises.has(url)) {
    return gltfLoadingPromises.get(url)!;
  }

  const promise = new Promise<GLTF>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        gltfCache.set(url, gltf);
        gltfLoadingPromises.delete(url);
        resolve(gltf);
      },
      undefined,
      (err) => {
        gltfLoadingPromises.delete(url);
        reject(err);
      }
    );
  });

  gltfLoadingPromises.set(url, promise);
  return promise;
}

export interface Model3DAvatarProps {
  modelPath: string;
  className?: string;
  focus?: "half" | "full";
  autoRotate?: boolean;
  isCurrentTurn?: boolean;
  isSpeaking?: boolean;
  isForfeited?: boolean;
  facing?: "front" | "left" | "right";
  fallback?: React.ReactNode;
}

export default function Model3DAvatar({
  modelPath,
  className = "w-44 h-44 sm:w-56 sm:h-56",
  focus = "half",
  autoRotate = false,
  isCurrentTurn = false,
  isSpeaking = false,
  isForfeited = false,
  facing = "front",
  fallback,
}: Model3DAvatarProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || !modelPath || typeof window === "undefined") return;

    let isDisposed = false;
    let animationFrameId: number;
    let mixer: THREE.AnimationMixer | null = null;

    // 1. Setup Scene & Camera
    // Gunakan FOV 42 dan jarak kamera luas agar TIDAK ADA BAGIAN KARAKTER YANG TERPOTONG
    const width = container.clientWidth || 200;
    const height = container.clientHeight || 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

    // 2. Setup Lights (Nuansa Kasino Mewah Merah Emas)
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 2.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.8);
    keyLight.position.set(2.5, 4, 3.5);
    scene.add(keyLight);

    const goldRimLight = new THREE.DirectionalLight(0xf59e0b, 2.4);
    goldRimLight.position.set(-2.5, 3, -2.5);
    scene.add(goldRimLight);

    const fillLight = new THREE.PointLight(0xa855f7, 1.6, 10);
    fillLight.position.set(0, 1.2, 2.5);
    scene.add(fillLight);

    // 3. Setup WebGL Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.innerHTML = "";
      container.appendChild(renderer.domElement);
    } catch {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const clock = new THREE.Clock();

    // 4. Load GLTF & Setup Pivot Wrapper
    loadGLTFWithCache(modelPath)
      .then((gltf) => {
        if (isDisposed) return;

        // Clone scene beserta skeleton & bones menggunakan SkeletonUtils
        const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;

        // =================================================================
        // HAPUS KACAMATA / GOGGLES PADA LAYLA SECARA BERSIH
        // =================================================================
        if (modelPath.toLowerCase().includes("layla")) {
          model.traverse((child) => {
            // Sembunyikan tulang kacamata
            if (
              child.name.includes("053") ||
              child.name.includes("055")
            ) {
              child.scale.set(0.00001, 0.00001, 0.00001);
              child.visible = false;
            }

            // Hapus/degenerasikan seluruh segitiga kacamata dari geometry index
            if (child instanceof THREE.SkinnedMesh && child.geometry) {
              const geom = child.geometry.clone();
              child.geometry = geom;
              const skinIndex = geom.attributes.skinIndex;
              const skinWeight = geom.attributes.skinWeight;
              const b053 = 41;
              const b055 = 42;

              if (skinIndex && skinWeight && geom.index) {
                const goggleVerts = new Set<number>();
                for (let i = 0; i < skinIndex.count; i++) {
                  const j = [
                    skinIndex.getX(i),
                    skinIndex.getY(i),
                    skinIndex.getZ(i),
                    skinIndex.getW(i),
                  ];
                  const w = [
                    skinWeight.getX(i),
                    skinWeight.getY(i),
                    skinWeight.getZ(i),
                    skinWeight.getW(i),
                  ];
                  for (let k = 0; k < 4; k++) {
                    if (w[k] > 0.05 && (j[k] === b053 || j[k] === b055)) {
                      goggleVerts.add(i);
                    }
                  }
                }

                if (goggleVerts.size > 0) {
                  const idxArr = geom.index.array as Uint16Array | Uint32Array;
                  for (let i = 0; i < idxArr.length; i += 3) {
                    const a = idxArr[i];
                    const b = idxArr[i + 1];
                    const c = idxArr[i + 2];
                    if (
                      goggleVerts.has(a) ||
                      goggleVerts.has(b) ||
                      goggleVerts.has(c)
                    ) {
                      idxArr[i] = 0;
                      idxArr[i + 1] = 0;
                      idxArr[i + 2] = 0;
                    }
                  }
                  geom.index.needsUpdate = true;
                }
              }
            }
          });
        }

        // =================================================================
        // PILIH ANIMASI NETRAL SEPERTI VEXANA (HANYA IDLE: city_idle / fight_idle)
        // Menghindari atraksi akrobatik/jungkir balik (city_action)
        // =================================================================
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);

          const allAnimNames = gltf.animations.map((a) => a.name);
          const bestClipName =
            allAnimNames.find((n) => /city_idle/i.test(n)) ||
            allAnimNames.find((n) => /fight_idle/i.test(n)) ||
            allAnimNames.find((n) => /idle/i.test(n)) ||
            allAnimNames[0];

          const origClip = gltf.animations.find((a) => a.name === bestClipName);
          if (origClip) {
            // Clone clip agar modifikasi tracks tidak merusak cache
            const clip = origClip.clone();

            // Pada Layla, buang track animasi kacamata agar tidak ter-reset
            if (modelPath.toLowerCase().includes("layla")) {
              clip.tracks = clip.tracks.filter(
                (t) => !t.name.includes("053") && !t.name.includes("055")
              );
            }

            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.play();
            mixer.update(0.05); // Langkah awal ke dalam animasi idle
          }
        }

        // Paksa pembaruan world matrix dari seluruh hierarki tulang & mesh
        model.updateMatrixWorld(true);

        // Hitung Bounding Box riil dari pose animasi aktif
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const realHeight = size.y > 0.0001 ? size.y : 1;

        // TARGET TINGGI KARAKTER BUST (DADA / BAHU KE KEPALA)
        // Kita fokus pada half-body bust (dari dada/pinggang ke kepala = ~44% dari tinggi model)
        // sehingga kaki dan sepatu sama sekali tidak ada (tidak akan menembus meja atau dock).
        // Natalia sedikit diperbesar (targetHeight = 1.25) agar gagah dan seimbang dengan Kagura & Vexana
        const isNatalia = modelPath.toLowerCase().includes("natalia");
        const effectiveHeight =
          focus === "half" ? realHeight * 0.44 : realHeight;
        const targetHeight = isNatalia && focus === "half" ? 1.25 : 1.0;
        const scale = targetHeight / effectiveHeight;

        // Titik fokus Y:
        // Jika "half": fokus pada leher/dada atas (77% dari tinggi karakter)
        // Jika "full": fokus pada tengah tubuh (50%)
        const targetY =
          focus === "half"
            ? box.min.y + realHeight * 0.77
            : box.min.y + realHeight * 0.5;

        // Pivot Wrapper: memusatkan karakter secara tepat di origin (0, 0, 0)
        const pivot = new THREE.Group();
        model.position.set(-center.x, -targetY, -center.z);
        pivot.add(model);
        pivot.scale.setScalar(scale);

        // Arah hadap awal berdasarkan posisi kursi di meja
        let baseAngle = 0;
        if (facing === "left") {
          baseAngle = 0.35; // menoleh ke arah tengah meja
        } else if (facing === "right") {
          baseAngle = -0.35;
        }
        pivot.rotation.y = baseAngle;

        scene.add(pivot);

        // Atur Posisi Kamera secara seragam dan luas agar kepala/rambut tidak terpotong
        if (focus === "half") {
          camera.position.set(0, -0.05, 2.75);
          camera.lookAt(0, -0.05, 0);
        } else {
          camera.position.set(0, 0.02, 2.15);
          camera.lookAt(0, 0.02, 0);
        }

        setIsLoading(false);

        // Reset clock sebelum memulai render loop agar delta tidak melompat
        clock.start();

        // 5. Render Loop yang Mulus (60fps)
        const animate = () => {
          if (isDisposed) return;
          animationFrameId = requestAnimationFrame(animate);

          // Batasi delta maksimum 0.05s agar animasi tidak melompat jika tab sempat background
          const rawDelta = clock.getDelta();
          const delta = Math.min(rawDelta, 0.05);

          if (mixer) {
            mixer.update(delta);
          }

          if (autoRotate || focus === "full") {
            pivot.rotation.y += 0.012;
          } else if (isCurrentTurn) {
            // Berayun lebih aktif saat giliran jalan
            const t = clock.getElapsedTime();
            pivot.rotation.y = baseAngle + Math.sin(t * 1.5) * 0.16;
          } else {
            // Ayunan nafas santai halus
            const t = clock.getElapsedTime();
            pivot.rotation.y = baseAngle + Math.sin(t * 0.7) * 0.06;
          }

          renderer.render(scene, camera);
        };

        animate();
      })
      .catch((err) => {
        console.error("Gagal memuat model 3D:", err);
        if (!isDisposed) {
          setHasError(true);
          setIsLoading(false);
        }
      });

    // Handle Resize Container
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });

    resizeObserver.observe(container);

    // 6. Cleanup
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      if (mixer) {
        mixer.stopAllAction();
      }

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelPath, focus, autoRotate, isCurrentTurn, facing]);

  if (hasError) {
    return <>{fallback || null}</>;
  }

  return (
    <div
      className={[
        "relative flex items-center justify-center select-none pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]",
        className,
        isForfeited ? "grayscale opacity-35" : "",
        isSpeaking ? "brightness-125" : "",
        isCurrentTurn ? "drop-shadow-[0_0_25px_rgba(251,191,36,0.75)]" : "",
      ].join(" ")}
      style={{
        maskImage:
          focus === "half"
            ? "linear-gradient(to bottom, black 70%, transparent 92%)"
            : undefined,
        WebkitMaskImage:
          focus === "half"
            ? "linear-gradient(to bottom, black 70%, transparent 92%)"
            : undefined,
      }}
    >
      <div ref={mountRef} className="w-full h-full pointer-events-none" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
