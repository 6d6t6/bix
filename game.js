class BixGame {
    constructor() {
        // Define available block types
        this.blockTypes = {
            wood: {
                name: 'Wood',
                color: 0x966F33,
                material: new THREE.MeshPhongMaterial({ 
                    color: 0x966F33,
                    bumpScale: 0.05,
                    shininess: 10
                }),
                key: '1'
            },
            stone: {
                name: 'Stone',
                color: 0x808080,
                material: new THREE.MeshStandardMaterial({ 
                    color: 0x808080,
                    roughness: 0.9,
                    metalness: 0.1
                }),
                key: '2'
            },
            glass: {
                name: 'Glass',
                color: 0x88C6FF,
                material: new THREE.MeshPhysicalMaterial({ 
                    color: 0x88C6FF,
                    transparent: true,
                    opacity: 0.3,
                    roughness: 0,
                    metalness: 0,
                    transmission: 0.9,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1
                }),
                key: '3'
            },
            brick: {
                name: 'Brick',
                color: 0xB74D37,
                material: new THREE.MeshStandardMaterial({ 
                    color: 0xB74D37,
                    roughness: 0.8,
                    metalness: 0
                }),
                key: '4'
            },
            metal: {
                name: 'Metal',
                color: 0xC0C0C0,
                material: new THREE.MeshStandardMaterial({ 
                    color: 0xC0C0C0,
                    roughness: 0.2,
                    metalness: 0.9,
                    envMapIntensity: 1.0
                }),
                key: '5'
            },
            gold: {
                name: 'Gold',
                color: 0xFFD700,
                material: new THREE.MeshPhysicalMaterial({ 
                    color: 0xFFD700,
                    roughness: 0.1,
                    metalness: 1.0,
                    reflectivity: 1.0,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.3
                }),
                key: '6'
            },
            crystal: {
                name: 'Crystal',
                color: 0xFF69B4,
                material: new THREE.MeshPhysicalMaterial({ 
                    color: 0xFF69B4,
                    transparent: true,
                    opacity: 0.7,
                    roughness: 0.0,
                    metalness: 0.2,
                    transmission: 0.6,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.0,
                    reflectivity: 1.0,
                    envMapIntensity: 1.5
                }),
                key: '7'
            },
            obsidian: {
                name: 'Obsidian',
                color: 0x310062,
                material: new THREE.MeshPhysicalMaterial({ 
                    color: 0x310062,
                    roughness: 0.1,
                    metalness: 0.0,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    reflectivity: 1.0
                }),
                key: '8'
            }
        };
        
        // Set initial selected block type
        this.selectedBlockType = 'wood';

        // Initialize block selector
        this.initBlockSelector();

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
        this.renderer.setClearColor(0x33CCFF); // Sky blue background
        
        // Add clock and speed control container
        this.timeControlsContainer = document.createElement('div');
        this.timeControlsContainer.style.position = 'fixed';
        this.timeControlsContainer.style.bottom = '10px';
        this.timeControlsContainer.style.left = '10px';
        this.timeControlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.timeControlsContainer.style.color = 'white';
        this.timeControlsContainer.style.padding = '10px';
        this.timeControlsContainer.style.borderRadius = '5px';
        this.timeControlsContainer.style.fontFamily = 'monospace';
        this.timeControlsContainer.style.fontSize = '16px';
        
        // Create clock display
        this.clockDisplay = document.createElement('div');
        this.clockDisplay.style.marginBottom = '10px';
        this.timeControlsContainer.appendChild(this.clockDisplay);
        
        // Create speed control
        const speedControl = document.createElement('div');
        speedControl.style.display = 'flex';
        speedControl.style.alignItems = 'center';
        speedControl.style.gap = '10px';
        speedControl.style.marginBottom = '10px';
        
        const speedLabel = document.createElement('label');
        speedLabel.textContent = 'Speed:';
        speedControl.appendChild(speedLabel);
        
        // Create speed slider
        this.speedSlider = document.createElement('input');
        this.speedSlider.type = 'range';
        this.speedSlider.min = '1';      // 1x speed (real time)
        this.speedSlider.max = '3600';   // 3600x speed (1 sec = 1 hour)
        this.speedSlider.value = '1';    // Start at real time
        this.speedSlider.style.width = '120px';
        speedControl.appendChild(this.speedSlider);
        
        // Create speed display
        this.speedDisplay = document.createElement('span');
        this.speedDisplay.style.minWidth = '100px';
        this.updateSpeedDisplay(1);
        speedControl.appendChild(this.speedDisplay);
        
        this.timeControlsContainer.appendChild(speedControl);

        // Create time control
        const timeControl = document.createElement('div');
        timeControl.style.display = 'flex';
        timeControl.style.alignItems = 'center';
        timeControl.style.gap = '10px';
        timeControl.style.marginBottom = '10px';

        // Create pause/play button
        this.playPauseButton = document.createElement('button');
        this.playPauseButton.textContent = '⏸️';
        this.playPauseButton.style.padding = '5px 10px';
        this.playPauseButton.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        this.playPauseButton.style.border = 'none';
        this.playPauseButton.style.borderRadius = '3px';
        this.playPauseButton.style.cursor = 'pointer';
        this.playPauseButton.style.fontSize = '16px';
        timeControl.appendChild(this.playPauseButton);

        // Create time slider
        this.timeSlider = document.createElement('input');
        this.timeSlider.type = 'range';
        this.timeSlider.min = '0';       // 00:00
        this.timeSlider.max = '1439';    // 23:59
        this.timeSlider.value = '0';
        this.timeSlider.style.width = '200px';  // Make it wider than speed slider
        timeControl.appendChild(this.timeSlider);

        this.timeControlsContainer.appendChild(timeControl);
        
        // Create reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset to Current Time';
        resetButton.style.padding = '5px 10px';
        resetButton.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        resetButton.style.border = 'none';
        resetButton.style.borderRadius = '3px';
        resetButton.style.cursor = 'pointer';
        this.timeControlsContainer.appendChild(resetButton);
        
        document.body.appendChild(this.timeControlsContainer);
        
        // Initialize game time, speed and pause state
        this.timeSpeed = 1;
        this.lastUpdateTime = Date.now();
        this.gameTime = new Date();
        this.isPaused = false;
        
        // Add speed control listener
        this.speedSlider.addEventListener('input', (e) => {
            this.timeSpeed = parseFloat(e.target.value);
            this.updateSpeedDisplay(this.timeSpeed);
        });

        // Add time slider listener
        this.timeSlider.addEventListener('input', (e) => {
            if (this.isPaused) {
                const minutes = parseInt(e.target.value);
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                this.gameTime.setHours(hours, mins, 0, 0);
                this.updateDayNightCycle();
            }
        });

        // Add play/pause button listener
        this.playPauseButton.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            this.playPauseButton.textContent = this.isPaused ? '▶️' : '⏸️';
            if (!this.isPaused) {
                this.lastUpdateTime = Date.now();
            }
        });
        
        // Add reset button listener
        resetButton.addEventListener('click', () => {
            this.gameTime = new Date();
            this.lastUpdateTime = Date.now();
            this.updateTimeSlider();
        });
        
        // Setup day/night cycle
        this.setupDayNightCycle();
        
        this.renderer.physicallyCorrectLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Load environment map
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        
        // Create a simple environment map
        const envScene = new THREE.Scene();
        const gradientTexture = new THREE.CanvasTexture(this.generateGradientTexture());
        const envGeometry = new THREE.SphereGeometry(100, 32, 32);
        const envMaterial = new THREE.MeshBasicMaterial({ map: gradientTexture, side: THREE.BackSide });
        const envMesh = new THREE.Mesh(envGeometry, envMaterial);
        envScene.add(envMesh);
        
        // Generate environment map
        const envMap = pmremGenerator.fromScene(envScene).texture;
        this.scene.environment = envMap;
        pmremGenerator.dispose();
        
        // Initialize game grid
        this.gridSize = 64;
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
        this.cameraAngle = (5 * Math.PI) / 4; // 225 degrees - facing northwest from southeast corner
        this.targetCameraAngle = this.cameraAngle;
        this.rotationSpeed = 0.15; // Speed for tap rotation
        this.panoramicSpeed = 0.015; // Very smooth, gentle rotation for held keys
        this.lastRotationDirection = 0;
        this.isRotationKeyHeld = false;
        this.rotationKeyHoldStartTime = 0;
        this.holdThreshold = 200; // ms before considering it a hold
        this.cameraHeight = Math.atan(1/Math.sqrt(2)); // ~35.264 degrees for isometric
        this.cameraDistance = 40;
        this.cameraTarget = new THREE.Vector3(-0.5, 0, -0.5); // Initialize with centered offset
        this.targetCameraTarget = this.cameraTarget.clone(); // Add target position for animation
        this.cameraMoveSpeed = 0.1; // Speed for camera movement animation
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
                
                // Handle centering camera
                if (key === 'c') {
                    this.centerCamera();
                }

                // Handle block selection with number keys
                Object.entries(this.blockTypes).forEach(([type, data]) => {
                    if (e.key === data.key) {
                        this.selectedBlockType = type;
                        this.updateBlockSelector();
                    }
                });
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
        
        // Set camera position relative to target point
        this.camera.position.set(
            x + this.cameraTarget.x,
            y + this.cameraTarget.y,
            z + this.cameraTarget.z
        );
        
        // Always look directly at the target point
        this.camera.lookAt(this.cameraTarget);
        
        // Ensure proper up vector for isometric view
        this.camera.up.set(0, 1, 0);
        this.updateCameraProjection();
        this.updateCompass();
    }
    
    createBlock(x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.blocks[key]) return; // Prevent duplicate blocks
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const blockType = this.blockTypes[this.selectedBlockType];
        
        // Use predefined material if exists, otherwise create from color
        const material = blockType.material || new THREE.MeshPhongMaterial({ 
            color: blockType.color,
            shininess: 30
        });
        
        const block = new THREE.Mesh(geometry, material);
        block.position.set(x, y, z);
        block.userData.blockType = this.selectedBlockType; // Store block type for later reference
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
        const moveX = (this.keys['d'] ? 1 : 0) - (this.keys['a'] ? 1 : 0);
        const moveZ = (this.keys['s'] ? 1 : 0) - (this.keys['w'] ? 1 : 0);
        
        if (moveX === 0 && moveZ === 0) return;
        
        // Calculate movement direction based on camera angle
        const angle = this.cameraAngle;
        
        // Calculate movement vector in world space
        // Right vector (for A/D movement)
        const rightX = Math.cos(angle + Math.PI/2);
        const rightZ = Math.sin(angle + Math.PI/2);
        
        // Forward vector (for W/S movement)
        const forwardX = Math.cos(angle);
        const forwardZ = Math.sin(angle);
        
        // Combine movements
        const dx = (-moveX * rightX + moveZ * forwardX) * moveSpeed;
        const dz = (-moveX * rightZ + moveZ * forwardZ) * moveSpeed;
        
        // Update both current and target positions
        this.cameraTarget.x += dx;
        this.cameraTarget.z += dz;
        this.targetCameraTarget.copy(this.cameraTarget);
        
        this.updateCameraPosition();
    }
    
    onWindowResize() {
        this.updateCameraProjection();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update day/night cycle
        this.updateDayNightCycle();
        
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

        // Animate camera target movement
        if (!this.cameraTarget.equals(this.targetCameraTarget)) {
            const dx = this.targetCameraTarget.x - this.cameraTarget.x;
            const dy = this.targetCameraTarget.y - this.cameraTarget.y;
            const dz = this.targetCameraTarget.z - this.cameraTarget.z;
            
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(dz) > 0.01) {
                this.cameraTarget.x += dx * this.cameraMoveSpeed;
                this.cameraTarget.y += dy * this.cameraMoveSpeed;
                this.cameraTarget.z += dz * this.cameraMoveSpeed;
                this.updateCameraPosition();
            } else {
                this.cameraTarget.copy(this.targetCameraTarget);
                this.updateCameraPosition();
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
            specular: 0x000000
        });

        const halfGrid = this.gridSize / 2;
        for (let x = -halfGrid; x < halfGrid; x++) {
            for (let z = -halfGrid; z < halfGrid; z++) {
                const block = new THREE.Mesh(floorGeometry, floorMaterial);
                block.position.set(x, -0.6, z);
                this.scene.add(block);
                
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

    initBlockSelector() {
        const inventory = document.getElementById('inventory');
        inventory.innerHTML = '';
        
        // Create block type buttons
        Object.entries(this.blockTypes).forEach(([type, data]) => {
            const button = document.createElement('button');
            button.className = 'block-button';
            button.innerHTML = `${data.name} (${data.key})`;
            button.style.backgroundColor = '#' + data.color.toString(16).padStart(6, '0');
            button.style.color = this.getContrastColor(data.color);
            
            button.addEventListener('click', () => {
                this.selectedBlockType = type;
                this.updateBlockSelector();
            });
            
            inventory.appendChild(button);
        });
        
        this.updateBlockSelector();
    }

    updateBlockSelector() {
        // Update button states
        const buttons = document.querySelectorAll('.block-button');
        buttons.forEach(button => {
            const isSelected = button.textContent.startsWith(this.blockTypes[this.selectedBlockType].name);
            button.classList.toggle('selected', isSelected);
        });
    }

    getContrastColor(hexcolor) {
        // Convert hex to RGB
        const r = (hexcolor >> 16) & 255;
        const g = (hexcolor >> 8) & 255;
        const b = hexcolor & 255;
        
        // Calculate relative luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return black or white based on luminance
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    updateCompass() {
        const compassInner = document.getElementById('compass-inner');
        if (compassInner) {
            // Convert camera angle to degrees and invert the rotation
            // We subtract from 360 because we want the compass to rotate counter to the camera
            const currentRotation = parseFloat(compassInner.style.transform.replace('rotate(', '').replace('deg)', '') || 0);
            let targetDegrees = 360 - ((this.cameraAngle * 180) / Math.PI) - 90;
            
            // Normalize both angles to 0-360 range
            targetDegrees = ((targetDegrees % 360) + 360) % 360;
            const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
            
            // Calculate the shortest rotation path
            let diff = targetDegrees - normalizedCurrent;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            
            // Apply the new rotation
            const newRotation = currentRotation + diff;
            compassInner.style.transform = `rotate(${newRotation}deg)`;
        }
    }

    centerCamera() {
        // Set the target position for smooth animation
        this.targetCameraTarget.set(-0.5, 0, -0.5);
    }

    generateGradientTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        
        // Create gradient
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#33CCFF');  // Sky blue at top
        gradient.addColorStop(1, '#FFFFFF');  // White at bottom
        
        // Fill canvas with gradient
        context.fillStyle = gradient;
        context.fillRect(0, 0, 256, 256);
        
        return canvas;
    }

    setupDayNightCycle() {
        // Create sun with larger size and glowing material
        const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
        const sunMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1,
            toneMapped: false,
            transparent: true,
            opacity: 1
        });
        this.sun = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sun);

        // Create moon with larger size
        const moonGeometry = new THREE.SphereGeometry(4, 32, 32);
        const moonMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xeeeeee,
            emissive: 0xcccccc,
            emissiveIntensity: 0.5,
            toneMapped: false,
            transparent: true,
            opacity: 1
        });
        this.moon = new THREE.Mesh(moonGeometry, moonMaterial);
        this.scene.add(this.moon);

        // Create orbit visualization
        const orbitRadius = 50;
        const orbitPoints = [];
        const orbitSegments = 100;  // Increased for smoother circle

        // Create points for the complete circular orbit path
        for (let i = 0; i <= orbitSegments; i++) {
            const angle = (i / orbitSegments) * Math.PI * 2;  // 0 to 2PI for full circle
            const x = orbitRadius * Math.cos(angle);          // East-West position
            const y = orbitRadius * Math.sin(angle);          // Height (including below horizon)
            const z = 0;                                      // Keep at 0 for straight E-W path
            orbitPoints.push(new THREE.Vector3(x, y, z));
        }

        // Create orbit line for visualization
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 });
        this.sunOrbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
        this.scene.add(this.sunOrbitLine);

        // Create moon orbit line (same path, different color)
        const moonOrbitMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.3 });
        this.moonOrbitLine = new THREE.Line(orbitGeometry, moonOrbitMaterial);
        this.scene.add(this.moonOrbitLine);

        // Create main directional light for sun with shadows
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.scene.add(this.sunLight);

        // Create softer light for moon with subtle shadows
        this.moonLight = new THREE.DirectionalLight(0x4444ff, 0.2);
        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 1024;
        this.moonLight.shadow.mapSize.height = 1024;
        this.scene.add(this.moonLight);

        // Ambient light for base illumination
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(this.ambientLight);
    }

    updateDayNightCycle() {
        if (!this.isPaused) {
            const currentTime = Date.now();
            const realElapsed = currentTime - this.lastUpdateTime;
            const gameElapsed = realElapsed * this.timeSpeed;
            
            // Update game time
            this.gameTime = new Date(this.gameTime.getTime() + gameElapsed);
            this.lastUpdateTime = currentTime;
        }

        // Update time slider to match game time
        this.updateTimeSlider();
        
        // Get current hour and calculate positions
        const totalHours = this.gameTime.getHours() + 
                          (this.gameTime.getMinutes() / 60) + 
                          (this.gameTime.getSeconds() / 3600);
        
        // Update clock display
        const hours = this.gameTime.getHours();
        const minutes = this.gameTime.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        this.clockDisplay.textContent = `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
        
        // Constants for celestial paths
        const radius = 50;    // Distance from center (east-west)

        // Calculate sun angle based on time (complete 360° rotation)
        // At midnight (0:00), angle = -90° (below horizon)
        // At sunrise (6:00), angle = 0° (east horizon)
        // At noon (12:00), angle = 90° (highest point)
        // At sunset (18:00), angle = 180° (west horizon)
        const sunAngle = ((totalHours / 24) * Math.PI * 2) - Math.PI / 2;

        // Sun position: complete circle
        // Negate the X coordinate to make it rise in east (negative X) and set in west (positive X)
        const sunX = -radius * Math.cos(sunAngle);  // Negated to flip east/west direction
        const sunY = radius * Math.sin(sunAngle);
        const sunZ = 0;
        
        this.sun.position.set(sunX, sunY, sunZ);
        
        // Moon position: opposite side of orbit (offset by 12 hours)
        const moonAngle = sunAngle + Math.PI;  // 180 degrees opposite of sun
        const moonX = -radius * Math.cos(moonAngle);  // Negated to match sun's direction
        const moonY = radius * Math.sin(moonAngle);
        const moonZ = 0;
        
        this.moon.position.set(moonX, moonY, moonZ);

        // Make celestial bodies face camera
        this.sun.lookAt(this.camera.position);
        this.moon.lookAt(this.camera.position);

        // Update directional lights to match celestial positions
        this.sunLight.position.copy(this.sun.position);
        this.moonLight.position.copy(this.moon.position);
        
        // Calculate light intensities based on normalized height (only positive values)
        const sunHeight = Math.max(0, Math.sin(sunAngle));
        const moonHeight = Math.max(0, Math.sin(moonAngle));

        // Night time calculation (7 PM to 4 AM)
        const isNight = hours >= 19 || hours < 4;
        
        // Adjust intensities based on time of day
        const sunIntensity = isNight ? 0 : Math.max(0, sunHeight);
        const moonIntensity = isNight ? Math.max(0, moonHeight) * 0.2 : 0;

        // Helper function for smooth transitions
        const smoothstep = (min, max, value) => {
            const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
            return x * x * (3 - 2 * x);
        };

        // Calculate fade factors for sun and moon
        let sunOpacity = 0;
        let moonOpacity = 0;

        // Calculate normalized heights for fade calculations
        const sunNormalizedHeight = (Math.sin(sunAngle) + 1) / 2; // Convert from -1,1 to 0,1 range
        const moonNormalizedHeight = (Math.sin(moonAngle) + 1) / 2;

        // Sun fade calculations - fade in BEFORE rise, fade out AFTER set
        if (hours >= 3 && hours < 6) {
            // Pre-sunrise fade in (3AM-6AM, sun rises at 6AM)
            sunOpacity = smoothstep(3, 6, hours);
        } else if (hours >= 6 && hours < 18) {
            // Full day (6AM-6PM)
            sunOpacity = 1;
        } else if (hours >= 18 && hours < 21) {
            // Post-sunset fade out (6PM-9PM, sun sets at 6PM)
            sunOpacity = 1 - smoothstep(18, 21, hours);
        }

        // Moon fade calculations - fade in BEFORE rise, fade out AFTER set
        if (hours >= 15 && hours < 18) {
            // Pre-moonrise fade in (3PM-6PM, moon rises at 6PM)
            moonOpacity = smoothstep(15, 18, hours);
        } else if (hours >= 18 || hours < 6) {
            // Full night
            moonOpacity = 1;
        } else if (hours >= 6 && hours < 9) {
            // Post-moonset fade out (6AM-9AM, moon sets at 6AM)
            moonOpacity = 1 - smoothstep(6, 9, hours);
        }

        // Additional height-based fade for more natural transition
        // Use an even gentler power for a more gradual fade when below horizon
        sunOpacity *= Math.pow(sunNormalizedHeight, 0.25);
        moonOpacity *= Math.pow(moonNormalizedHeight, 0.25);

        // Apply opacity to celestial bodies with emissive intensity matching opacity
        this.sun.material.opacity = sunOpacity;
        this.sun.material.emissiveIntensity = sunOpacity;
        this.moon.material.opacity = moonOpacity;
        this.moon.material.emissiveIntensity = moonOpacity * 0.5; // Keep moon dimmer than sun

        this.sunLight.intensity = sunIntensity;
        this.moonLight.intensity = moonIntensity;

        // Update sky color with smoother transitions
        const daySkyColor = new THREE.Color(0x33CCFF);     // blue day sky
        const sunsetColor = new THREE.Color(0xFF6633);     // sunset/sunrise
        const twilightColor = new THREE.Color(0x6633CC);   // twilight
        const nightSkyColor = new THREE.Color(0x191970);   // blue night sky
        const moonlitSkyColor = new THREE.Color(0x333366); // moonlit sky
        
        let currentSkyColor = new THREE.Color();
        
        // Calculate moon influence
        const moonInfluence = moonHeight > 0.2 ? (moonHeight - 0.2) / 0.8 : 0;
        
        if (isNight) {
            if (hours >= 21 || hours < 3) {
                // Deep night
                if (moonHeight > 0) {
                    const moonT = Math.min(1, moonInfluence);
                    currentSkyColor.lerpColors(nightSkyColor, moonlitSkyColor, moonT);
                } else {
                    currentSkyColor.copy(nightSkyColor);
                }
            } else if (hours >= 3 && hours < 4) {
                // Pre-dawn transition (3AM-4AM)
                const t = smoothstep(3, 4, hours);
                currentSkyColor.lerpColors(nightSkyColor, twilightColor, t);
            } else if (hours >= 19 && hours < 21) {
                // Dusk transition (7PM-9PM)
                const t = smoothstep(19, 21, hours);
                currentSkyColor.lerpColors(twilightColor, nightSkyColor, t);
            }
        } else {
            if (hours >= 4 && hours < 5) {
                // Sunrise transition (4AM-5AM)
                const t = smoothstep(4, 5, hours);
                currentSkyColor.lerpColors(twilightColor, sunsetColor, t);
            } else if (hours >= 5 && hours < 6) {
                // Morning transition (5AM-6AM)
                const t = smoothstep(5, 6, hours);
                currentSkyColor.lerpColors(sunsetColor, daySkyColor, t);
            } else if (hours >= 17 && hours < 18) {
                // Late afternoon transition (5PM-6PM)
                const t = smoothstep(17, 18, hours);
                currentSkyColor.lerpColors(daySkyColor, sunsetColor, t);
            } else if (hours >= 18 && hours < 19) {
                // Sunset transition (6PM-7PM)
                const t = smoothstep(18, 19, hours);
                currentSkyColor.lerpColors(sunsetColor, twilightColor, t);
            } else {
                // Full day (6AM-5PM)
                currentSkyColor.copy(daySkyColor);
            }
        }
        
        // Apply final color with smooth transition
        const currentColor = new THREE.Color();
        this.renderer.getClearColor(currentColor);
        currentColor.lerp(currentSkyColor, 0.01); // Reduced from 0.1 to 0.01 for much smoother transitions
        this.renderer.setClearColor(currentColor);

        // Update ambient light with smoother transitions
        const baseAmbient = 0.1;
        const dayAmbient = 0.3;
        const moonAmbient = 0.15;
        
        let ambientIntensity = baseAmbient;
        if (!isNight && sunHeight > 0) {
            ambientIntensity += sunHeight * dayAmbient;
        }
        if (isNight && moonHeight > 0) {
            ambientIntensity += moonHeight * moonAmbient;
        }
        
        this.ambientLight.intensity = ambientIntensity;
    }

    updateSpeedDisplay(speed) {
        if (speed === 1) {
            this.speedDisplay.textContent = 'Real Time';
        } else if (speed < 60) {
            this.speedDisplay.textContent = `${speed}x Speed`;
        } else {
            const minutes = 60 / speed;
            if (minutes >= 1) {
                this.speedDisplay.textContent = `1 hr = ${minutes} min`;
            } else {
                const seconds = minutes * 60;
                this.speedDisplay.textContent = `1 hr = ${seconds.toFixed(1)} sec`;
            }
        }
    }

    resetGameTime() {
        // Set game start time based on current real time
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(0, 0, 0, 0);
        this.gameStartTime = midnight.getTime();
        this.timeOffset = (now.getHours() * 3600000) + 
                         (now.getMinutes() * 60000) + 
                         (now.getSeconds() * 1000);
    }

    updateTimeSlider() {
        // Convert current time to minutes since midnight
        const minutes = this.gameTime.getHours() * 60 + this.gameTime.getMinutes();
        this.timeSlider.value = minutes;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new BixGame();
}); 