AFRAME.registerComponent('custom-ar-hit-test', {
    schema: {
        target: { type: 'selector' }
    },

    init: function () {
        console.log("custom-ar-hit-test initialized");
        this.xrHitTestSource = null;
        this.viewerSpace = null;
        this.refSpace = null;

        this.el.sceneEl.addEventListener('enter-vr', () => {
            console.log("Enter VR event received");
            const session = this.el.sceneEl.renderer.xr.getSession();
            if (!session) {
                console.error("No XR session found in renderer");
                return;
            }

            this.el.sceneEl.renderer.xr.addEventListener('sessionstart', (ev) => {
                console.log("XR session started");
                this.session = ev.session;
            });

            this.session = session;

            // Request hit test source
            session.requestReferenceSpace('viewer').then((space) => {
                this.viewerSpace = space;
                session.requestHitTestSource({ space: this.viewerSpace })
                    .then((source) => {
                        console.log("Hit test source obtained");
                        this.xrHitTestSource = source;
                    })
                    .catch(err => console.error("Error requesting hit test source:", err));
            }).catch(err => console.error("Error requesting viewer reference space:", err));

            session.requestReferenceSpace('local').then((space) => {
                this.refSpace = space;
            }).catch(err => console.error("Error requesting local reference space:", err));

            // Handle select event for placement
            session.addEventListener('select', this.onSelect.bind(this));
        });

        this.el.sceneEl.addEventListener('exit-vr', () => {
            console.log("Exit VR");
            this.xrHitTestSource = null;
            this.session = null;
        });
    },

    onSelect: function () {
        if (!this.data.target) return;
        if (!this.data.target.getAttribute('visible')) return;

        console.log("Surface selected!");
        // Emit event that a surface was selected at the reticle's position
        this.el.emit('ar-hit-test-select', {
            position: this.data.target.object3D.position,
            rotation: this.data.target.object3D.rotation
        });
    },

    tick: function () {
        if (!this.session || !this.xrHitTestSource || !this.data.target) return;

        const frame = this.el.sceneEl.frame;
        if (!frame) return;

        const hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
        if (hitTestResults.length > 0) {
            const pose = hitTestResults[0].getPose(this.refSpace);

            this.data.target.setAttribute('visible', 'true');
            this.data.target.object3D.position.copy(pose.transform.position);
            this.data.target.object3D.quaternion.copy(pose.transform.orientation);
        } else {
            this.data.target.setAttribute('visible', 'false');
        }
    }
});

AFRAME.registerComponent('ar-hit-test-listener', {
    init: function () {
        console.log("ar-hit-test-listener initialized");
        const sceneEl = this.el;
        const model = document.querySelector('#placed-model');
        const overlay = document.querySelector('#overlay');

        sceneEl.addEventListener('ar-hit-test-select', (event) => {
            const reticle = document.querySelector('#reticle');

            model.setAttribute('position', reticle.getAttribute('position'));
            model.setAttribute('visible', 'true');

            if (overlay) overlay.innerText = "Arrastra horizontalmente para rotar";
        });
    }
});

AFRAME.registerComponent('smooth-rotate', {
    schema: {
        speed: { type: 'number', default: 2 }
    },

    init: function () {
        console.log("smooth-rotate initialized");
        this.targetRotationY = 0;
        this.currentRotationY = 0;
        this.isDragging = false;
        this.startX = 0;

        // Escuchar eventos en window para capturar gestos completos
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        window.addEventListener('touchstart', this.onTouchStart);
        window.addEventListener('touchmove', this.onTouchMove);
        window.addEventListener('touchend', this.onTouchEnd);
    },

    onTouchStart: function (e) {
        // Si el modelo note está visible, ignorar
        if (!this.el.getAttribute('visible')) return;
        if (e.touches.length !== 1) return;

        this.isDragging = true;
        this.startX = e.touches[0].clientX;
    },

    onTouchMove: function (e) {
        if (!this.isDragging || e.touches.length !== 1) return;

        // Prevent default para evitar scroll de página mientras se rota
        // e.preventDefault(); 

        const currentX = e.touches[0].clientX;
        const deltaX = currentX - this.startX;

        // Sensibilidad
        const rotationFactor = 0.01 * this.data.speed;

        this.targetRotationY -= deltaX * rotationFactor;
        this.startX = currentX;
    },

    onTouchEnd: function () {
        this.isDragging = false;
    },

    tick: function (time, timeDelta) {
        if (!this.el.object3D.visible) return;

        // Interpolación suave
        const alpha = 0.1;
        const diff = this.targetRotationY - this.currentRotationY;

        if (Math.abs(diff) > 0.0001) {
            this.currentRotationY += diff * alpha;
            this.el.object3D.rotation.y = this.currentRotationY;
        }
    },

    remove: function () {
        window.removeEventListener('touchstart', this.onTouchStart);
        window.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onTouchEnd);
    }
});
