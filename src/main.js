import './style.css';
import * as THREE from 'three';
import { XRManager, getXRCapabilities } from './XRManager.js';

class GrocBotApp {
    constructor() {
        this.container = document.getElementById('app');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        this.camera.position.set(0, 1.6, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.xr.enabled = false;
        this.container.appendChild(this.renderer.domElement);

        this.xrManager = new XRManager(this.renderer, this.scene, this.camera);
        
        // Better lighting setup for realistic 3D fridge
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(2, 3, 2);
        this.scene.add(directionalLight);
        
        // Add a second directional light from the side for better depth
        const sideLight = new THREE.DirectionalLight(0xffffff, 0.4);
        sideLight.position.set(-2, 1, 1);
        this.scene.add(sideLight);
        
        // Spot light from above for highlights
        const spotLight = new THREE.SpotLight(0xffffff, 0.5);
        spotLight.position.set(0, 3, 0);
        spotLight.angle = Math.PI / 4;
        this.scene.add(spotLight);

        this.fridge = null;
        this.items = [];
        this.fridgeDimensions = { w: 60, h: 120, d: 50 };
        this.shelvesCount = 4;
        this.isARActive = false;

        this.init();
    }

    async init() {
        this.setupUI();
        this.createFridge();
        
        this.renderer.setAnimationLoop((time, frame) => this.animate(time, frame));
        window.addEventListener('resize', () => this.onResize());
        
        // Load settings
        const saved = localStorage.getItem('grocbot_fridge');
        if (saved) {
            this.fridgeDimensions = JSON.parse(saved);
            this.syncUI();
            this.createFridge();
        }

        // Check XR capabilities with timeout
        try {
            const timeoutPromise = new Promise(resolve => 
                setTimeout(() => resolve({ supported: false, reason: 'Timeout checking WebXR' }), 2000)
            );
            const capabilities = await Promise.race([getXRCapabilities(), timeoutPromise]);
            this.updateXRStatus(capabilities);
        } catch (error) {
            this.updateXRStatus({ supported: false, reason: error.message || 'Error checking WebXR' });
        }
    }

    setupUI() {
        const arButton = document.getElementById('ar-button');
        arButton.onclick = () => this.toggleAR();

        document.querySelectorAll('.step-btn').forEach(btn => {
            btn.onclick = () => this.updateDimension(btn.dataset.dim, parseInt(btn.dataset.val));
        });

        document.querySelectorAll('.add-item-btn').forEach(btn => {
            btn.onclick = () => this.addItem(btn.dataset.type);
        });
    }

    updateXRStatus(capabilities) {
        const statusElement = document.getElementById('xr-status');
        const arButton = document.getElementById('ar-button');
        
        if (capabilities.supported && capabilities.ar) {
            statusElement.textContent = 'WebXR Ready';
            statusElement.style.color = '#4ade80';
            arButton.disabled = false;
        } else {
            statusElement.textContent = capabilities.reason || 'WebXR not supported';
            statusElement.style.color = '#f87171';
            arButton.disabled = true;
            arButton.style.opacity = '0.5';
        }
    }

    async toggleAR() {
        const arButton = document.getElementById('ar-button');
        const controls = document.getElementById('controls');

        if (!this.isARActive) {
            try {
                arButton.textContent = 'Starting...';
                arButton.disabled = true;
                await this.xrManager.startARSession();
                this.isARActive = true;
                arButton.textContent = 'EXIT AR';
                arButton.disabled = false;
                controls.style.display = 'block';
                this.showMessage('Find a floor and tap to place fridge');
            } catch (err) {
                console.error('AR Session Error:', err);
                this.showMessage('AR start failed: ' + (err.message || 'Permission denied or not supported'));
                arButton.textContent = 'ENTER AR';
                arButton.disabled = false;
            }
        } else {
            await this.xrManager.endARSession();
            this.isARActive = false;
            arButton.textContent = 'ENTER AR';
            controls.style.display = 'none';
        }
    }

    updateDimension(dim, delta) {
        this.fridgeDimensions[dim] = Math.max(10, this.fridgeDimensions[dim] + delta);
        this.syncUI();
        this.createFridge();
        localStorage.setItem('grocbot_fridge', JSON.stringify(this.fridgeDimensions));
    }

    syncUI() {
        document.getElementById('val-w').textContent = this.fridgeDimensions.w;
        document.getElementById('val-h').textContent = this.fridgeDimensions.h;
        document.getElementById('val-d').textContent = this.fridgeDimensions.d;
    }

    createFridge() {
        if (this.fridge) this.scene.remove(this.fridge);
        const { w, h, d } = this.fridgeDimensions;
        const group = new THREE.Group();
        const mw = w / 100, mh = h / 100, md = d / 100;

        // Main fridge body (stainless steel look)
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xe8e8e8,
            metalness: 0.7,
            roughness: 0.3
        });

        // Fridge body box
        const bodyGeom = new THREE.BoxGeometry(mw, mh, md);
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        group.add(body);

        // Inner black area (slight inset to show depth)
        const innerMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            metalness: 0.2,
            roughness: 0.8
        });
        const innerGeom = new THREE.BoxGeometry(mw - 0.02, mh - 0.02, md * 0.95);
        const inner = new THREE.Mesh(innerGeom, innerMat);
        inner.position.z = -0.01;
        group.add(inner);

        // Shelves inside
        const shelfMat = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc,
            metalness: 0.3,
            roughness: 0.6,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 1; i < this.shelvesCount; i++) {
            const shelfGeom = new THREE.BoxGeometry(mw - 0.04, 0.01, md * 0.9);
            const shelf = new THREE.Mesh(shelfGeom, shelfMat);
            shelf.position.y = -mh/2 + (i * (mh/this.shelvesCount));
            shelf.position.z = -0.02;
            group.add(shelf);
        
        // Create item group for better visuals
        const itemGroup = new THREE.Group();
        
        // Main item body with rounded edges
        const mainGeom = new THREE.BoxGeometry(s.w/100, s.h/100, s.d/100);
        const mainMat = new THREE.MeshStandardMaterial({ 
            color: s.color,
            metalness: s.metalness || 0.1,
            roughness: s.roughness || 0.6
        });
        const mainMesh = new THREE.Mesh(mainGeom, mainMat);
        itemGroup.add(mainMesh);

        // Add label
                w: 7, h: 22, d: 7, 
                color: 0xf8f8ff, 
                metalness: 0.1, 
                roughness: 0.3,
                icon: '🥛', 
                name: 'Milk' 
            },
            eggs: { 
                w: 24, h: 7, d: 11, 
                color: 0xfffacd, 
                metalness: 0.0, 
                roughness: 0.9,
                icon: '🥚', 
                name: 'Eggs' 
            },
            yogurt: { 
                w: 10, h: 10, d: 10, 
                color: 0xfff0f5, 
                metalness: 0.05, 
                roughness: 0.7,
                icon: '🍦', 
                name: 'Yogurt' 
            },
            soda: { 
                w: 6, h: 23, d: 6, 
                color: 0x2ecc71, 
                metalness: 0.2, 
                roughness: 0.2,
                icon: '🥤', 
                name: 'Soda' 
            },
            box: { 
                w: 15, h: 8, d: 15, 
                color: 0xd2691e, 
                metalness: 0.0, 
                roughness: 0.95,
                icon: '📦', 
                name: 'Box' 
           
            const cap = new THREE.Mesh(capGeom, capMat);
            cap.position.y = (s.h/100)/2 + 0.007;
            itemGroup.add(cap);
            
            // Blue label stripe
            const labelGeom = new THREE.BoxGeometry(s.w/100 + 0.001, s.h/300, s.d/100 + 0.001);
            const labelMat = new THREE.MeshStandardMaterial({ color: 0x4169e1 });
            const label = new THREE.Mesh(labelGeom, labelMat);
            label.position.y = 0;
            itemGroup.add(label);
        } else if (type === 'eggs') {
            // Add egg bumps on top
            const eggMat = new THREE.MeshStandardMaterial({ color: 0xfffacd });
            for (let i = 0; i < 6; i++) {
                const eggGeom = new THREE.SphereGeometry(0.015, 12, 8);
                const egg = new THREE.Mesh(eggGeom, eggMat);
                egg.position.set(
                    ((i % 3) - 1) * 0.05, 
                    (s.h/100)/2 + 0.008,
                    (Math.floor(i / 3) - 0.5) * 0.035
                );
                egg.scale.y = 1.2;
                itemGroup.add(egg);
            }
        } else if (type === 'yogurt') {
            // Foil lid on top
            const lidGeom = new THREE.CylinderGeometry(s.w/200, s.w/200, 0.002, 16);
            const lidMat = new THREE.MeshStandardMaterial({ 
                color: 0xc0c0c0,
                metalness: 0.9,
                roughness: 0.1
            });
            const lid = new THREE.Mesh(lidGeom, lidMat);
            lid.position.y = (s.h/100)/2 + 0.001;
            itemGroup.add(lid);
        } else if (type === 'soda') {
            // Bottle cap
            const capGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16);
            const capMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const cap = new THREE.Mesh(capGeom, capMat);
            cap.position.y = (s.h/100)/2 + 0.01;
            itemGroup.add(cap);
            
            // Label wrap
            const labelGeom = new THREE.CylinderGeometry(0.031, 0.031, s.h/300, 16);
            const labelMat = new THREE.MeshStandardMaterial({ color: 0xff6b6b });
            const label = new THREE.Mesh(labelGeom, labelMat);
            label.position.y = 0;
            itemGroup.add(label);
        } else if (type === 'box') {
            // Add tape strips
            const tapeGeom = new THREE.BoxGeometry(s.w/100 + 0.002, 0.005, 0.01);
            const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd4a76a });
            const tape1 = new THREE.Mesh(tapeGeom, tapeMat);
            tape1.position.y = (s.h/100)/2 + 0.001;
            itemGroup.add(tape1);
            
            const tape2 = new THREE.Mesh(tapeGeom, tapeMat);
            tape2.rotation.y = Math.PI / 2;
            tape2.position.y = (s.h/100)/2 + 0.001;
            itemGroup.add(tape2);
        }

        const shelfIdx = Math.floor(Math.random() * this.shelvesCount);
        const y = -(this.fridgeDimensions.h/200) + (shelfIdx * (this.fridgeDimensions.h/100/this.shelvesCount)) + (s.h/200) + 0.01;
        itemGroup.position.set((Math.random()-0.5)*0.2, y, (Math.random()-0.5)*0.2);
        itemGroup.rotation.y = Math.random() * Math.PI * 2;
        
        this.fridge.add(itemGroup);
        this.items.push({ type, mesh: itemGroup
            side: THREE.DoubleSide
        });
        
        const doorGeom = new THREE.BoxGeometry(mw - 0.04, mh - 0.04, 0.03);
        const door = new THREE.Mesh(doorGeom, doorMat);
        door.position.z = (md / 2) + 0.015;
        group.add(door);

        // Door handle
        const handleMat = new THREE.MeshStandardMaterial({ 
            color: 0x404040,
            metalness: 0.9,
            roughness: 0.1
        });
        
        const handleGeom = new THREE.CylinderGeometry(0.012, 0.012, mh * 0.6, 16);
        const handle = new THREE.Mesh(handleGeom, handleMat);
        handle.position.set(mw * 0.4, 0, (md / 2) + 0.04);
        group.add(handle);

        // Top handle bar
        const topHandleGeom = new THREE.BoxGeometry(mw * 0.9, 0.025, 0.025);
        const topHandle = new THREE.Mesh(topHandleGeom, handleMat);
        topHandle.position.set(0, mh * 0.45, (md / 2) + 0.04);
        group.add(topHandle);

        // Bottom grille
        const grilleGeom = new THREE.BoxGeometry(mw * 0.8, 0.05, 0.02);
        const grilleMat = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.5,
            roughness: 0.7
        });
        const grille = new THREE.Mesh(grilleGeom, grilleMat);
        grille.position.set(0, -mh/2 + 0.05, (md / 2) + 0.015);
        group.add(grille);

        group.position.set(0, 0, -1.5);
        this.scene.add(group);
        this.fridge = group;
        this.items = [];
        this.updateStats();
    }

    addItem(type) {
        if (!this.fridge) return;
        const s = this.getItemSpecs(type);
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(s.w/100, s.h/100, s.d/100),
            new THREE.MeshStandardMaterial({ color: s.color })
        );
        const shelfIdx = Math.floor(Math.random() * this.shelvesCount);
        const y = -(this.fridgeDimensions.h/200) + (shelfIdx * (this.fridgeDimensions.h/100/this.shelvesCount)) + (s.h/200);
        mesh.position.set((Math.random()-0.5)*0.2, y, (Math.random()-0.5)*0.2);
        this.fridge.add(mesh);
        this.items.push({ type, mesh, id: Date.now() });
        this.updateStats();
    }

    getItemSpecs(type) {
        const specs = {
            milk: { w: 7, h: 22, d: 7, color: 0xffffff, icon: '🥛', name: 'Milk' },
            eggs: { w: 24, h: 7, d: 11, color: 0xF5DEB3, icon: '🥚', name: 'Eggs' },
            yogurt: { w: 10, h: 10, d: 10, color: 0xffe4e1, icon: '🍦', name: 'Yogurt' },
            soda: { w: 6, h: 23, d: 6, color: 0x22c55e, icon: '🍾', name: 'Soda' },
            box: { w: 15, h: 8, d: 15, color: 0x8b4513, icon: '📦', name: 'Box' }
        };
        return specs[type];
    }

    updateStats() {
        const vol = this.fridgeDimensions.w * this.fridgeDimensions.h * this.fridgeDimensions.d;
        let iv = 0;
        this.items.forEach(i => { const s = this.getItemSpecs(i.type); iv += (s.w*s.h*s.d); });
        const p = Math.min(Math.round((iv/vol)*100), 100);
        document.getElementById('occupancy-fill').style.width = p + '%';
        document.getElementById('occupancy-text').textContent = p + '% FULL';
    }

    showMessage(txt) {
        const m = document.getElementById('app-message');
        m.textContent = txt; m.classList.remove('hidden');
        setTimeout(() => m.classList.add('hidden'), 3000);
    }

    animate(time, frame) {
        if (this.isARActive && frame) {
            const pose = this.xrManager.updateHitTest(frame);
            if (pose && this.fridge) {
                this.fridge.position.setFromMatrixPosition(this.xrManager.reticle.matrix);
                this.fridge.position.y += (this.fridgeDimensions.h / 200); // Sit on surface
            }
        } else if (!this.isARActive) {
            if (this.fridge) this.fridge.rotation.y += 0.01;
        }
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.onload = () => new GrocBotApp();
