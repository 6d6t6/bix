class BixGame {
    constructor() {
        this.scene = new THREE.Scene();
        
        // Set up camera with proper isometric view
        const aspect = window.innerWidth / window.innerHeight;
        const d = 20;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue background
        
        // Initialize game grid
        this.gridSize = 16;
        this.blocks = {};
        
        // Setup lighting for isometric view
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
        
        // Create permanent floor
        this.createFloor();
        
        // Create block preview
        const previewGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const previewMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            wireframe: true
        });
        this.previewBlock = new THREE.Mesh(previewGeometry, previewMaterial);
        this.previewBlock.visible = false;
        this.scene.add(this.previewBlock);

        // Setup raycaster
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Set initial isometric camera position
        this.cameraAngle = Math.PI / 4; // 45 degrees
        this.targetCameraAngle = this.cameraAngle;
        this.rotationSpeed = 0.15; // Speed for tap rotation
        this.panoramicSpeed = 0.015; // Very smooth, gentle rotation for held keys
        this.lastRotationDirection = 0;
        this.isRotationKeyHeld = false;
        this.rotationKeyHoldStartTime = 0;
        this.holdThreshold = 200; // ms before considering it a hold
        this.cameraHeight = Math.atan(1/Math.sqrt(2)); // ~35.264 degrees for isometric
        this.cameraDistance = 40;
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.zoomLevel = 1;
        this.updateCameraPosition();
        
        // Setup controls
        this.setupControls();
        
        // Start game loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    setupControls() {
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            
            // Only trigger on initial keydown
            if (!this.keys[key]) {
                this.keys[key] = true;
                
                // Handle rotation keys
                if (key === 'q' || key === 'e') {
                    const direction = key === 'q' ? -1 : 1;
                    this.rotationKeyHoldStartTime = Date.now();
                    this.rotate(direction);
                }
            }
            
            // Handle zoom with Ctrl/Cmd + +/-
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoom(1);
                } else if (e.key === '-' || e.key === '_') {
                    e.preventDefault();
                    this.zoom(-1);
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = false;
            
            // Handle rotation key release
            if (key === 'q' || key === 'e') {
                const holdDuration = Date.now() - this.rotationKeyHoldStartTime;
                
                if (holdDuration >= this.holdThreshold) {
                    // If it was a hold, snap to next 45-degree increment
                    const direction = key === 'q' ? -1 : 1;
                    const currentAngleNorm = this.cameraAngle % (Math.PI / 4);
                    const snapAmount = direction > 0 ? 
                        (Math.PI / 4) - currentAngleNorm : 
                        -currentAngleNorm;
                    
                    this.targetCameraAngle = this.cameraAngle + snapAmount;
                    this.lastRotationDirection = direction;
                    this.rotationSpeed = 0.15; // Reset to fast rotation for snapping
                }
            }
        });
        
        // Mouse controls
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.onRightClick(e);
        });
        
        // Prevent browser zoom
        window.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
            // Handle zoom with scroll wheel/trackpad
            const delta = -Math.sign(e.deltaY);
            this.zoom(delta);
        }, { passive: false });
    }

    zoom(delta) {
        const zoomSpeed = 0.15;
        const newZoomLevel = this.zoomLevel * (1 + delta * zoomSpeed);
        
        // Limit zoom range
        if (newZoomLevel >= 0.5 && newZoomLevel <= 2.0) {
            this.zoomLevel = newZoomLevel;
            this.updateCameraProjection();
        }
    }

    getHighestBlockAtPosition(x, z) {
        let maxY = -1;
        for (const key in this.blocks) {
            const [bx, by, bz] = key.split(',').map(Number);
            if (bx === x && bz === z) {
                maxY = Math.max(maxY, by);
            }
        }
        return maxY;
    }

    getGridCoordinates(point, normal = null) {
        const halfGrid = this.gridSize / 2;
        
        // Convert world coordinates to grid coordinates
        let x = Math.floor(point.x + 0.5);  // Add 0.5 to round to nearest integer
        let z = Math.floor(point.z + 0.5);
        
        // Get the height based on existing blocks, excluding floor blocks
        let y = 0;
        for (const key in this.blocks) {
            const [bx, by, bz] = key.split(',').map(Number);
            if (bx === x && bz === z && by >= 0) {
                y = Math.max(y, by + 1);
            }
        }
        
        // Ensure coordinates are within grid bounds
        x = Math.max(-halfGrid, Math.min(halfGrid - 1, x));
        z = Math.max(-halfGrid, Math.min(halfGrid - 1, z));
        
        // Adjust y position to be flush with floor
        y = Math.max(0, y);
        
        return { x, y, z };
    }

    onMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.updatePreviewBlock();
    }

    updatePreviewBlock() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Only check intersections with floor blocks
        const floorBlocks = Object.values(this.blocks).filter(block => block.position.y === -0.6);
        const intersects = this.raycaster.intersectObjects(floorBlocks);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const floorX = Math.round(intersect.point.x);
            const floorZ = Math.round(intersect.point.z);
            
            // Find the height of the highest block at this position
            const highestY = this.getHighestBlockAtPosition(floorX, floorZ);
            const nextY = highestY + 1;
            
            // Additional bounds check to ensure we're within the grid
            if (floorX >= -this.gridSize/2 && 
                floorX < this.gridSize/2 && 
                floorZ >= -this.gridSize/2 && 
                floorZ < this.gridSize/2) {
                const key = `${floorX},${nextY},${floorZ}`;
                if (!this.blocks[key]) {
                    this.previewBlock.position.set(floorX, nextY, floorZ);
                    this.previewBlock.visible = true;
                    return;
                }
            }
        }
        
        this.previewBlock.visible = false;
    }
    
    onMouseClick(event) {
        if (this.previewBlock.visible) {
            const position = this.previewBlock.position;
            this.createBlock(position.x, position.y, position.z);
        }
    }
    
    updateCameraPosition() {
        // Calculate camera position maintaining isometric angle
        const x = Math.cos(this.cameraAngle) * Math.cos(this.cameraHeight) * this.cameraDistance;
        const y = Math.sin(this.cameraHeight) * this.cameraDistance;
        const z = Math.sin(this.cameraAngle) * Math.cos(this.cameraHeight) * this.cameraDistance;
        
        this.camera.position.set(
            x + this.cameraTarget.x,
            y + this.cameraTarget.y,
            z + this.cameraTarget.z
        );
        this.camera.lookAt(this.cameraTarget);
        
        // Ensure proper up vector for isometric view
        this.camera.up.set(0, 1, 0);
        this.updateCameraProjection();
    }
    
    createBlock(x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.blocks[key]) return; // Prevent duplicate blocks
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshPhongMaterial({ color: 0x966F33 });
        const block = new THREE.Mesh(geometry, material);
        block.position.set(x, y, z); // Y is now aligned with floor surface
        this.scene.add(block);
        this.blocks[key] = block;
    }
    
    removeBlock(x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.blocks[key]) {
            this.scene.remove(this.blocks[key]);
            delete this.blocks[key];
        }
    }
    
    getGridPosition(point, normal = null) {
        // Offset slightly to handle floating point precision
        const epsilon = 0.001;
        let x = Math.round(point.x - epsilon);
        let y = Math.round(point.y - epsilon);
        let z = Math.round(point.z - epsilon);
        
        if (normal) {
            x += Math.round(normal.x);
            y += Math.round(normal.y);
            z += Math.round(normal.z);
        }
        
        return { x, y, z };
    }
    
    onRightClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(Object.values(this.blocks));
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const position = intersect.object.position;
            this.removeBlock(position.x, position.y, position.z);
        }
    }
    
    updateCamera() {
        const moveSpeed = 0.5;
        const moveX = (this.keys['a'] ? 1 : 0) - (this.keys['d'] ? 1 : 0);
        const moveZ = (this.keys['w'] ? 1 : 0) - (this.keys['s'] ? 1 : 0);
        
        if (moveX === 0 && moveZ === 0) return;
        
        // Calculate movement direction based on camera angle
        const angle = this.cameraAngle;
        
        // Horizontal movement (A/D)
        const dx = -moveX * Math.cos(angle + Math.PI/2);
        const dz = -moveX * Math.sin(angle + Math.PI/2);
        
        // Vertical movement (W/S)
        const dx2 = moveZ * Math.cos(angle);
        const dz2 = moveZ * Math.sin(angle);
        
        // Combine movements and apply speed
        this.cameraTarget.x += (dx + dx2) * moveSpeed;
        this.cameraTarget.z += (dz + dz2) * moveSpeed;
        this.updateCameraPosition();
    }
    
    onWindowResize() {
        this.updateCameraProjection();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Check for held rotation keys
        if (this.keys['q'] || this.keys['e']) {
            const holdDuration = Date.now() - this.rotationKeyHoldStartTime;
            
            if (holdDuration >= this.holdThreshold) {
                // Smooth panoramic rotation while held
                const direction = this.keys['q'] ? -1 : 1;
                this.cameraAngle += direction * this.panoramicSpeed;
                this.cameraAngle = (this.cameraAngle + Math.PI * 2) % (Math.PI * 2);
                this.targetCameraAngle = this.cameraAngle;
                this.lastRotationDirection = direction; // Keep track for snap rotation
                this.updateCameraPosition();
            }
        }
        
        // Normal rotation animation for taps or snapping
        if (this.cameraAngle !== this.targetCameraAngle) {
            let angleDiff = this.targetCameraAngle - this.cameraAngle;
            
            // Adjust the difference based on last rotation direction to ensure continuous rotation
            if (this.lastRotationDirection !== 0) {
                if (this.lastRotationDirection > 0 && angleDiff < 0) {
                    angleDiff += Math.PI * 2;
                } else if (this.lastRotationDirection < 0 && angleDiff > 0) {
                    angleDiff -= Math.PI * 2;
                }
            }
            
            // Apply smooth rotation
            if (Math.abs(angleDiff) > 0.01) {
                this.cameraAngle += angleDiff * this.rotationSpeed;
                this.cameraAngle = (this.cameraAngle + Math.PI * 2) % (Math.PI * 2);
                this.updateCameraPosition();
            } else {
                this.cameraAngle = this.targetCameraAngle;
                this.updateCameraPosition();
                this.lastRotationDirection = 0;
            }
        }

        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }

    updateCameraProjection() {
        const aspect = window.innerWidth / window.innerHeight;
        const d = 20 / this.zoomLevel;
        this.camera.left = -d * aspect;
        this.camera.right = d * aspect;
        this.camera.top = d;
        this.camera.bottom = -d;
        this.camera.updateProjectionMatrix();
    }

    createFloor() {
        const floorGeometry = new THREE.BoxGeometry(1, 0.2, 1);
        const floorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x808080,
            shininess: 0,
            specular: 0x000000 // No specular highlights for a matte look
        });

        const halfGrid = this.gridSize / 2;
        for (let x = -halfGrid; x < halfGrid; x++) {
            for (let z = -halfGrid; z < halfGrid; z++) {
                const block = new THREE.Mesh(floorGeometry, floorMaterial);
                block.position.set(x, -0.6, z); // Moved down to -0.5 (was -0.4)
                this.scene.add(block);
                
                // Store floor blocks in blocks object with special y-coordinate
                const key = `${x},-1,${z}`;
                this.blocks[key] = block;
            }
        }
    }

    rotate(direction) {
        // Rotate by 45 degrees (PI/4) each time
        const rotationAmount = (Math.PI / 4) * direction;
        this.targetCameraAngle += rotationAmount;
        this.lastRotationDirection = direction; // Store the rotation direction
        
        // Keep target angle between 0 and 2PI
        this.targetCameraAngle = (this.targetCameraAngle + Math.PI * 2) % (Math.PI * 2);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new BixGame();
}); 