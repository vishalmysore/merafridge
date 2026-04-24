import './style.css';
import * as THREE from 'three';
import { XRManager } from './XRManager.js';

class GrocBotApp {
    constructor() {
        this.container = document.getElementById('app');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        this.camera.position.set(0, 1.6, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = false;
        this.container.appendChild(this.renderer.domElement);

        this.xrManager = new XRManager(this.renderer, this.scene, this.camera);
        
        this.light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2);
        this.light.position.set(0.5, 1, 0.25);
        this.scene.add(this.light);

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

    async toggleAR() {
        const arButton = document.getElementById('ar-button');
        const controls = document.getElementById('controls');
        const uiContainer = document.getElementById('ui-container');

        if (!this.isARActive) {
            try {
                arButton.textContent = 'Starting...';
                await this.xrManager.startARSession();
                this.isARActive = true;
                arButton.textContent = 'EXIT AR';
                controls.style.display = 'block';
                this.showMessage('Find a floor and tap to place fridge');
            } catch (err) {
                console.error(err);
                alert('AR not supported or permission denied');
                arButton.textContent = 'ENTER AR';
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
        const wallMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, side: THREE.DoubleSide, transparent: true, opacity: 0.4 
        });

        const back = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), wallMat);
        back.position.z = -md/2;
        group.add(back);

        const bottom = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), wallMat);
        bottom.rotation.x = Math.PI/2;
        bottom.position.y = -mh/2;
        group.add(bottom);

        const sideG = new THREE.PlaneGeometry(md, mh);
        const left = new THREE.Mesh(sideG, wallMat);
        left.rotation.y = Math.PI/2; left.position.x = -mw/2;
        group.add(left);
        const right = new THREE.Mesh(sideG, wallMat);
        right.rotation.y = -Math.PI/2; right.position.x = mw/2;
        group.add(right);

        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.3 });
        for (let i = 1; i < this.shelvesCount; i++) {
            const s = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), shelfMat);
            s.rotation.x = Math.PI/2;
            s.position.y = -mh/2 + (i * (mh/this.shelvesCount));
            group.add(s);
        }

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
