import './style.css';
import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

class GrocBot {
    constructor() {
        this.container = document.getElementById('three-canvas');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.container,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;

        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.reticle = null;
        this.placementMode = true;

        this.light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        this.light.position.set(0.5, 1, 0.25);
        this.scene.add(this.light);

        // Core State
        this.fridge = null;
        this.items = [];
        this.fridgeDimensions = { w: 60, h: 120, d: 50 };
        this.shelvesCount = 4;

        this.initUI();
        this.setupXR();
        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initUI() {
        this.onboarding = document.getElementById('onboarding');
        this.controls = document.getElementById('controls');
        this.modalOverlay = document.getElementById('modal-overlay');

        document.getElementById('start-scan').onclick = () => this.startScan();
        document.getElementById('manual-setup').onclick = () => this.showManualSetup();
        document.getElementById('save-dimensions').onclick = () => this.saveDimensions();
        document.getElementById('reset-fridge').onclick = () => this.resetFridge();

        document.querySelectorAll('.add-item-btn').forEach(btn => {
            btn.onclick = () => this.addItem(btn.dataset.type);
        });

        const saved = localStorage.getItem('grocbot_fridge');
        if (saved) {
            this.fridgeDimensions = JSON.parse(saved);
        }
    }

    setupXR() {
        const arButton = ARButton.createButton(this.renderer, {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.getElementById('ui-container') }
        });
        
        if (arButton) {
            document.getElementById('xr-button-container').appendChild(arButton);
        }
    }

    showManualSetup() {
        this.modalOverlay.classList.remove('hidden');
    }

    saveDimensions() {
        this.fridgeDimensions = {
            w: parseFloat(document.getElementById('fridge-w').value),
            h: parseFloat(document.getElementById('fridge-h').value),
            d: parseFloat(document.getElementById('fridge-d').value)
        };
        localStorage.setItem('grocbot_fridge', JSON.stringify(this.fridgeDimensions));
        this.modalOverlay.classList.add('hidden');
        this.onboarding.classList.add('hidden');
        this.controls.classList.remove('hidden');
        this.createFridge();
    }

    createFridge() {
        if (this.fridge) {
            this.scene.remove(this.fridge);
        }

        const { w, h, d } = this.fridgeDimensions;
        const group = new THREE.Group();

        const mw = w / 100;
        const mh = h / 100;
        const md = d / 100;

        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });

        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), wallMat);
        backWall.position.z = -md / 2;
        group.add(backWall);

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), wallMat);
        floor.rotation.x = Math.PI / 2;
        floor.position.y = -mh / 2;
        group.add(floor);

        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(md, mh), wallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.x = -mw / 2;
        group.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(md, mh), wallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.x = mw / 2;
        group.add(rightWall);

        const shelfMat = new THREE.MeshStandardMaterial({ 
            color: 0x444444, 
            transparent: true, 
            opacity: 0.8 
        });

        const shelfSpacing = mh / this.shelvesCount;
        for (let i = 1; i < this.shelvesCount; i++) {
            const shelf = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), shelfMat);
            shelf.rotation.x = Math.PI / 2;
            shelf.position.y = -mh / 2 + (i * shelfSpacing);
            group.add(shelf);
        }

        group.position.set(0, 0, -1);
        this.scene.add(group);
        this.fridge = group;

        if (!this.reticle) {
            const reticleGeom = new THREE.RingGeometry(0.1, 0.11, 32);
            reticleGeom.rotateX(-Math.PI / 2);
            this.reticle = new THREE.Mesh(reticleGeom, new THREE.MeshBasicMaterial());
            this.reticle.matrixAutoUpdate = false;
            this.reticle.visible = false;
            this.scene.add(this.reticle);
        }
    }

    addItem(type) {
        if (!this.fridge) {
            alert('Setup your fridge first!');
            return;
        }

        const itemData = this.getItemSpecs(type);
        const mw = itemData.w / 100;
        const mh = itemData.h / 100;
        const md = itemData.d / 100;

        const geometry = new THREE.BoxGeometry(mw, mh, md);
        const material = new THREE.MeshStandardMaterial({ color: itemData.color });
        const mesh = new THREE.Mesh(geometry, material);

        const shelfIndex = Math.floor(Math.random() * this.shelvesCount);
        const shelfSpacing = (this.fridgeDimensions.h / 100) / this.shelvesCount;
        const yPos = -(this.fridgeDimensions.h/100)/2 + (shelfIndex * shelfSpacing) + (mh/2);
        
        const xLimit = (this.fridgeDimensions.w / 100) / 2 - (mw / 2);
        const zLimit = (this.fridgeDimensions.d / 100) / 2 - (md / 2);
        
        mesh.position.set((Math.random() - 0.5) * xLimit * 2, yPos, (Math.random() - 0.5) * zLimit * 2);

        this.fridge.add(mesh);
        this.items.push({ type, mesh, id: Date.now() });
        this.updateUI();
    }

    getItemSpecs(type) {
        const specs = {
            milk:   { w: 7,  h: 22, d: 7,  color: 0xffffff, icon: '🥛', name: 'Milk' },
            eggs:   { w: 24, h: 7,  d: 11, color: 0xF5DEB3, icon: '🥚', name: 'Eggs' },
            yogurt: { w: 10, h: 10, d: 10, color: 0xffe4e1, icon: '🍦', name: 'Yogurt' },
            soda:   { w: 6,  h: 23, d: 6,  color: 0x22c55e, icon: '🍾', name: 'Soda' },
            box:    { w: 15, h: 8,  d: 15, color: 0x8b4513, icon: '📦', name: 'Leftovers' }
        };
        return specs[type] || specs.box;
    }

    updateUI() {
        const list = document.getElementById('current-items');
        list.innerHTML = '';
        
        this.items.forEach(item => {
            const specs = this.getItemSpecs(item.type);
            const card = document.createElement('div');
            card.className = 'grocery-card';
            card.innerHTML = `
                <span>${specs.icon}</span>
                <span>${specs.name}</span>
                <button class="remove-btn" data-id="${item.id}">✕</button>
            `;
            card.querySelector('.remove-btn').onclick = () => this.destroyItem(item.id);
            list.appendChild(card);
        });

        const fridgeVol = this.fridgeDimensions.w * this.fridgeDimensions.h * this.fridgeDimensions.d;
        let itemsVol = 0;
        this.items.forEach(item => {
            const s = this.getItemSpecs(item.type);
            itemsVol += (s.w * s.h * s.d);
        });

        const percent = Math.min(Math.round((itemsVol / fridgeVol) * 100), 100);
        document.getElementById('occupancy-fill').style.width = percent + '%';
        document.getElementById('occupancy-text').textContent = percent + '%';
    }

    destroyItem(id) {
        const index = this.items.findIndex(i => i.id === id);
        if (index > -1) {
            this.fridge.remove(this.items[index].mesh);
            this.items.splice(index, 1);
            this.updateUI();
        }
    }

    resetFridge() {
        this.items.forEach(item => this.fridge.remove(item.mesh));
        this.items = [];
        this.updateUI();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.renderer.setAnimationLoop((time, frame) => {
            if (frame) {
                const referenceSpace = this.renderer.xr.getReferenceSpace();
                const session = this.renderer.xr.getSession();

                if (this.hitTestSourceRequested === false) {
                    session.requestReferenceSpace('viewer').then((referenceSpace) => {
                        session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                            this.hitTestSource = source;
                        });
                    });

                    session.addEventListener('end', () => {
                        this.hitTestSourceRequested = false;
                        this.hitTestSource = null;
                        this.reticle.visible = false;
                    });
                    this.hitTestSourceRequested = true;
                }

                if (this.hitTestSource) {
                    const hitTestResults = frame.getHitTestResults(this.hitTestSource);
                    if (hitTestResults.length) {
                        const hit = hitTestResults[0];
                        this.reticle.visible = true;
                        this.reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                        if (this.placementMode && this.fridge) {
                            this.fridge.position.setFromMatrixPosition(this.reticle.matrix);
                        }
                    } else {
                        this.reticle.visible = false;
                    }
                }
            }
            this.renderer.render(this.scene, this.camera);
        });
    }

    startScan() {
        this.showManualSetup();
    }
}

new GrocBot();
