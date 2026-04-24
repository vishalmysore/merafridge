import * as THREE from 'three';

export class XRManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        this.session = null;
        this.referenceSpace = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        
        this.reticle = null;
        this.isSupported = false;
        this.isSessionActive = false;
        
        this.checkARSupport();
        this.createReticle();
    }

    async checkARSupport() {
        if ('xr' in navigator) {
            try {
                this.isSupported = await navigator.xr.isSessionSupported('immersive-ar');
            } catch (error) {
                this.isSupported = false;
            }
        } else {
            this.isSupported = false;
        }
    }

    createReticle() {
        const geometry = new THREE.RingGeometry(0.1, 0.12, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xcdec4b,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        this.reticle = new THREE.Mesh(geometry, material);
        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = false;
        this.scene.add(this.reticle);

        const dot = new THREE.Mesh(
            new THREE.CircleGeometry(0.02, 16),
            new THREE.MeshBasicMaterial({ color: 0xcdec4b, opacity: 0.9, transparent: true })
        );
        dot.rotation.x = -Math.PI / 2;
        this.reticle.add(dot);
    }

    async startARSession(overlayElement) {
        if (!this.isSupported) {
            throw new Error('WebXR AR not supported');
        }

        const sessionInit = {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: overlayElement }
        };

        this.session = await navigator.xr.requestSession('immersive-ar', sessionInit);
        await this.renderer.xr.setSession(this.session);
        this.referenceSpace = await this.session.requestReferenceSpace('local-floor');
        
        this.session.addEventListener('end', () => this.onSessionEnd());
        this.renderer.xr.enabled = true;
        this.isSessionActive = true;
        this.hitTestSourceRequested = false;
    }

    async endARSession() {
        if (this.session) {
            await this.session.end();
        }
    }

    onSessionEnd() {
        this.session = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.reticle.visible = false;
        this.isSessionActive = false;
        this.renderer.xr.enabled = false;
    }

    updateHitTest(frame) {
        if (!frame || !this.isSessionActive) return;

        if (!this.hitTestSourceRequested) {
            this.session.requestReferenceSpace('viewer').then((viewerSpace) => {
                this.session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                    this.hitTestSource = source;
                });
            });
            this.hitTestSourceRequested = true;
        }

        if (this.hitTestSource) {
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(this.referenceSpace);
                if (pose) {
                    this.reticle.visible = true;
                    this.reticle.matrix.fromArray(pose.transform.matrix);
                    return pose;
                }
            }
        }
        this.reticle.visible = false;
        return null;
    }

    getReticlePosition() {
        if (!this.reticle.visible) return null;
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(this.reticle.matrix);
        return position;
    }
}
