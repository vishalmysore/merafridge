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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(2, 3, 2);
        this.scene.add(directionalLight);
        
        const sideLight = new THREE.DirectionalLight(0xffffff, 0.5);
        sideLight.position.set(-2, 1, 1);
        this.scene.add(sideLight);
        
        const spotLight = new THREE.SpotLight(0xffffff, 0.6);
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
        
        const saved = localStorage.getItem('grocbot_fridge');
        if (saved) {
            this.fridgeDimensions = JSON.parse(saved);
            this.syncUI();
            this.createFridge();
        }

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

        // Toggle panel collapse
        const toggleBtn = document.getElementById('toggle-panel');
        const panelContent = document.getElementById('panel-content');
        if (toggleBtn && panelContent) {
            toggleBtn.onclick = () => {
                const isCollapsed = panelContent.style.display === 'none';
                panelContent.style.display = isCollapsed ? 'block' : 'none';
                toggleBtn.classList.toggle('collapsed', !isCollapsed);
            };
        }

        // Bottom navigation
        const navAddItem = document.getElementById('nav-add-item');
        const navOrganize = document.getElementById('nav-organize');
        const navShopping = document.getElementById('nav-shopping');
        const groceryList = document.getElementById('grocery-list');
        const currentItems = document.getElementById('current-items');

        if (navAddItem) {
            navAddItem.onclick = () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                navAddItem.classList.add('active');
                groceryList.style.display = 'block';
                currentItems.style.display = 'none';
            };
        }

        if (navOrganize) {
            navOrganize.onclick = () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                navOrganize.classList.add('active');
                groceryList.style.display = 'none';
                currentItems.style.display = 'block';
            };
        }

        if (navShopping) {
            navShopping.onclick = () => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                navShopping.classList.add('active');
                groceryList.style.display = 'none';
                currentItems.style.display = 'none';
                this.showMessage('Shopping list feature coming soon!');
            };
        }
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
        const bottomNav = document.getElementById('bottom-nav');

        if (!this.isARActive) {
            try {
                arButton.textContent = 'Starting...';
                arButton.disabled = true;
                await this.xrManager.startARSession();
                this.isARActive = true;
                arButton.textContent = 'EXIT AR';
                arButton.disabled = false;
                controls.style.display = 'block';
                bottomNav.style.display = 'block';
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
            bottomNav.style.display = 'none';
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

        // Transparent glass walls - super clear like in the image
        const glassMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff,
            metalness: 0.0,
            roughness: 0.05,
            transparent: true,
            opacity: 0.15,
            transmission: 0.95,
            thickness: 0.5,
            side: THREE.DoubleSide
        });

        // Create all 6 glass panels
        const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), glassMat);
        frontGlass.position.z = md/2;
        group.add(frontGlass);

        const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), glassMat);
        backGlass.position.z = -md/2;
        group.add(backGlass);

        const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(md, mh), glassMat);
        leftGlass.rotation.y = Math.PI/2;
        leftGlass.position.x = -mw/2;
        group.add(leftGlass);

        const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(md, mh), glassMat);
        rightGlass.rotation.y = -Math.PI/2;
        rightGlass.position.x = mw/2;
        group.add(rightGlass);

        const topGlass = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), glassMat);
        topGlass.rotation.x = Math.PI/2;
        topGlass.position.y = mh/2;
        group.add(topGlass);

        const bottomGlass = new THREE.Mesh(new THREE.PlaneGeometry(mw, md), glassMat);
        bottomGlass.rotation.x = -Math.PI/2;
        bottomGlass.position.y = -mh/2;
        group.add(bottomGlass);

        // Chrome/metal frame posts
        const frameMat = new THREE.MeshStandardMaterial({ 
            color: 0xc0c0c0,
            metalness: 0.95,
            roughness: 0.15
        });

        const postRadius = 0.008;
        const postGeom = new THREE.CylinderGeometry(postRadius, postRadius, mh, 8);
        
        // Vertical corner posts
        const corners = [
            { x: -mw/2, z: -md/2 },
            { x: mw/2, z: -md/2 },
            { x: -mw/2, z: md/2 },
            { x: mw/2, z: md/2 }
        ];

        corners.forEach(corner => {
            const post = new THREE.Mesh(postGeom, frameMat);
            post.position.set(corner.x, 0, corner.z);
            group.add(post);
        });

        // Horizontal frame bars
        const topBarGeom = new THREE.CylinderGeometry(postRadius, postRadius, mw, 8);
        const sideBarGeom = new THREE.CylinderGeometry(postRadius, postRadius, md, 8);

        // Top frame
        const topFrontBar = new THREE.Mesh(topBarGeom, frameMat);
        topFrontBar.rotation.z = Math.PI/2;
        topFrontBar.position.set(0, mh/2, md/2);
        group.add(topFrontBar);

        const topBackBar = new THREE.Mesh(topBarGeom, frameMat);
        topBackBar.rotation.z = Math.PI/2;
        topBackBar.position.set(0, mh/2, -md/2);
        group.add(topBackBar);

        const topLeftBar = new THREE.Mesh(sideBarGeom, frameMat);
        topLeftBar.rotation.x = Math.PI/2;
        topLeftBar.position.set(-mw/2, mh/2, 0);
        group.add(topLeftBar);

        const topRightBar = new THREE.Mesh(sideBarGeom, frameMat);
        topRightBar.rotation.x = Math.PI/2;
        topRightBar.position.set(mw/2, mh/2, 0);
        group.add(topRightBar);

        // Bottom frame
        const bottomFrontBar = new THREE.Mesh(topBarGeom, frameMat);
        bottomFrontBar.rotation.z = Math.PI/2;
        bottomFrontBar.position.set(0, -mh/2, md/2);
        group.add(bottomFrontBar);

        const bottomBackBar = new THREE.Mesh(topBarGeom, frameMat);
        bottomBackBar.rotation.z = Math.PI/2;
        bottomBackBar.position.set(0, -mh/2, -md/2);
        group.add(bottomBackBar);

        const bottomLeftBar = new THREE.Mesh(sideBarGeom, frameMat);
        bottomLeftBar.rotation.x = Math.PI/2;
        bottomLeftBar.position.set(-mw/2, -mh/2, 0);
        group.add(bottomLeftBar);

        const bottomRightBar = new THREE.Mesh(sideBarGeom, frameMat);
        bottomRightBar.rotation.x = Math.PI/2;
        bottomRightBar.position.set(mw/2, -mh/2, 0);
        group.add(bottomRightBar);

        // Clear glass shelves
        const shelfGlassMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xffffff,
            metalness: 0.0,
            roughness: 0.1,
            transparent: true,
            opacity: 0.2,
            transmission: 0.9,
            thickness: 0.3
        });
        
        for (let i = 1; i < this.shelvesCount; i++) {
            const shelfGeom = new THREE.BoxGeometry(mw - 0.02, 0.008, md - 0.02);
            const shelf = new THREE.Mesh(shelfGeom, shelfGlassMat);
            shelf.position.y = -mh/2 + (i * (mh/this.shelvesCount));
            group.add(shelf);

            // Shelf support bars
            const shelfSupportGeom = new THREE.CylinderGeometry(postRadius * 0.5, postRadius * 0.5, mw - 0.02, 6);
            const frontSupport = new THREE.Mesh(shelfSupportGeom, frameMat);
            frontSupport.rotation.z = Math.PI/2;
            frontSupport.position.y = shelf.position.y;
            frontSupport.position.z = md/2 - 0.01;
            group.add(frontSupport);
        }

        group.position.set(0, 0, -1.5);
        this.scene.add(group);
        this.fridge = group;
        this.items = [];
        this.updateStats();
    }

    createItemTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Background colors
        const colors = {
            milk: { bg: '#ffffff', accent: '#ff0000' },
            eggs: { bg: '#fffacd', accent: '#8b4513' },
            yogurt: { bg: '#fff0f5', accent: '#ff69b4' },
            soda: { bg: '#2ecc71', accent: '#27ae60' },
            box: { bg: '#d2691e', accent: '#8b4513' }
        };
        
        const color = colors[type] || colors.box;
        
        // Fill background
        ctx.fillStyle = color.bg;
        ctx.fillRect(0, 0, 256, 256);
        
        // Add brand-like elements
        ctx.fillStyle = color.accent;
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (type === 'milk') {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 80, 256, 96);
            ctx.fillStyle = '#ffffff';
            ctx.fillText('MILK', 128, 128);
            ctx.font = '24px Arial';
            ctx.fillText('Fresh & Pure', 128, 160);
        } else if (type === 'eggs') {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('🥚', 128, 80);
            ctx.fillStyle = '#8b4513';
            ctx.font = '32px Arial';
            ctx.fillText('FARM EGGS', 128, 150);
        } else if (type === 'yogurt') {
            ctx.fillStyle = '#ff69b4';
            ctx.font = '40px Arial';
            ctx.fillText('YOGURT', 128, 128);
            ctx.font = '20px Arial';
            ctx.fillText('Strawberry', 128, 170);
        } else if (type === 'soda') {
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(0, 60, 256, 136);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 52px Arial';
            ctx.fillText('SPRITE', 128, 128);
        } else if (type === 'box') {
            // Cardboard texture
            ctx.fillStyle = '#8b4513';
            ctx.strokeStyle = '#d4a76a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(128, 64);
            ctx.lineTo(192, 128);
            ctx.lineTo(128, 192);
            ctx.lineTo(64, 128);
            ctx.closePath();
            ctx.stroke();
            
            ctx.font = '20px Arial';
            ctx.fillText('FRAGILE', 128, 128);
        }
        
        return new THREE.CanvasTexture(canvas);
    }

    addItem(type) {
        if (!this.fridge) return;
        const s = this.getItemSpecs(type);
        
        const itemGroup = new THREE.Group();
        
        // Create texture for the item
        const texture = this.createItemTexture(type);
        
        // Main item body
        const mainGeom = new THREE.BoxGeometry(s.w/100, s.h/100, s.d/100);
        const mainMat = new THREE.MeshStandardMaterial({ 
            map: texture,
            metalness: s.metalness || 0.1,
            roughness: s.roughness || 0.6
        });
        const mainMesh = new THREE.Mesh(mainGeom, mainMat);
        itemGroup.add(mainMesh);

        // Add 3D details
        if (type === 'milk') {
            const capGeom = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16);
            const capMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            const cap = new THREE.Mesh(capGeom, capMat);
            cap.position.y = (s.h/100)/2 + 0.007;
            itemGroup.add(cap);
        } else if (type === 'eggs') {
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
            const capGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16);
            const capMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
            const cap = new THREE.Mesh(capGeom, capMat);
            cap.position.y = (s.h/100)/2 + 0.01;
            itemGroup.add(cap);
        } else if (type === 'box') {
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
        this.items.push({ type, mesh: itemGroup, id: Date.now() });
        this.updateStats();
    }

    getItemSpecs(type) {
        const specs = {
            milk: { 
                w: 7, h: 22, d: 7, 
                metalness: 0.1, 
                roughness: 0.3,
                icon: '🥛', 
                name: 'Milk',
                calories: 150,
                protein: 8,
                carbs: 12,
                fats: 8,
                healthy: true,
                emoji: '😊'
            },
            eggs: { 
                w: 24, h: 7, d: 11, 
                metalness: 0.0, 
                roughness: 0.9,
                icon: '🥚', 
                name: 'Eggs',
                calories: 210,
                protein: 18,
                carbs: 2,
                fats: 15,
                healthy: true,
                emoji: '😊'
            },
            yogurt: { 
                w: 10, h: 10, d: 10, 
                metalness: 0.05, 
                roughness: 0.7,
                icon: '🍦', 
                name: 'Yogurt',
                calories: 120,
                protein: 6,
                carbs: 18,
                fats: 2,
                healthy: true,
                emoji: '😊'
            },
            soda: { 
                w: 6, h: 23, d: 6, 
                metalness: 0.2, 
                roughness: 0.2,
                icon: '🥤', 
                name: 'Soda',
                calories: 140,
                protein: 0,
                carbs: 39,
                fats: 0,
                healthy: false,
                emoji: '😕'
            },
            box: { 
                w: 15, h: 8, d: 15, 
                metalness: 0.0, 
                roughness: 0.95,
                icon: '📦', 
                name: 'Box',
                calories: 0,
                protein: 0,
                carbs: 0,
                fats: 0,
                healthy: true,
                emoji: '📦'
            }
        };
        return specs[type];
    }

    updateStats() {
        const vol = this.fridgeDimensions.w * this.fridgeDimensions.h * this.fridgeDimensions.d;
        let iv = 0;
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFats = 0;
        let healthyCount = 0;
        let unhealthyCount = 0;

        this.items.forEach(i => { 
            const s = this.getItemSpecs(i.type); 
            iv += (s.w*s.h*s.d);
            totalCalories += s.calories;
            totalProtein += s.protein;
            totalCarbs += s.carbs;
            totalFats += s.fats;
            
            if (s.healthy) {
                healthyCount++;
            } else if (i.type !== 'box') {
                unhealthyCount++;
            }
        });

        const p = Math.min(Math.round((iv/vol)*100), 100);
        document.getElementById('occupancy-fill').style.width = p + '%';
        document.getElementById('occupancy-text').textContent = p + '% FULL';

        // Update nutrition totals
        document.getElementById('total-calories').textContent = totalCalories + ' kcal';
        document.getElementById('total-protein').textContent = totalProtein + 'g';
        document.getElementById('total-carbs').textContent = totalCarbs + 'g';
        document.getElementById('total-fats').textContent = totalFats + 'g';

        // Update overall health indicator
        this.updateOverallHealth(healthyCount, unhealthyCount);

        // Update current items list
        this.updateCurrentItemsList();
    }

    updateOverallHealth(healthyCount, unhealthyCount) {
        const emojiElement = document.getElementById('overall-health-emoji');
        const textElement = document.getElementById('overall-health-text');
        
        if (this.items.length === 0) {
            emojiElement.textContent = '😊';
            textElement.textContent = 'Add items to see health status';
            textElement.style.color = '#888';
            return;
        }

        const healthRatio = healthyCount / (healthyCount + unhealthyCount);
        
        if (healthRatio >= 0.8) {
            emojiElement.textContent = '😊';
            textElement.textContent = 'Excellent! Very nutritious selection';
            textElement.style.color = '#4ade80';
        } else if (healthRatio >= 0.6) {
            emojiElement.textContent = '🙂';
            textElement.textContent = 'Good! Mostly healthy choices';
            textElement.style.color = '#a3e635';
        } else if (healthRatio >= 0.4) {
            emojiElement.textContent = '😐';
            textElement.textContent = 'Okay - Mix of healthy and unhealthy';
            textElement.style.color = '#fbbf24';
        } else if (healthRatio >= 0.2) {
            emojiElement.textContent = '😕';
            textElement.textContent = 'Not great - More unhealthy items';
            textElement.style.color = '#fb923c';
        } else {
            emojiElement.textContent = '😞';
            textElement.textContent = 'Poor - Mostly unhealthy choices';
            textElement.style.color = '#f87171';
        }
    }

    updateCurrentItemsList() {
        const container = document.getElementById('current-items');
        if (!container) return;

        container.innerHTML = '<h4 style="margin: 10px 0; font-size: 14px; color: #888;">Items in Fridge:</h4>';
        
        this.items.forEach((item, index) => {
            const spec = this.getItemSpecs(item.type);
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.05); margin: 5px 0; border-radius: 8px; font-size: 12px;';
            
            itemDiv.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 20px;">${spec.icon}</span>
                    <span style="font-weight: 500;">${spec.name}</span>
                </div>
                <div style="text-align: right; font-size: 11px; color: #888;">
                    <div>${spec.calories} kcal</div>
                    <div>P:${spec.protein}g C:${spec.carbs}g F:${spec.fats}g</div>
                </div>
            `;
            
            container.appendChild(itemDiv);
        });
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
                this.fridge.position.y += (this.fridgeDimensions.h / 200);
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
