class Avatar {
    constructor(game, gridSize) {
        this.game = game;  // Store the game instance
        this.scene = game.scene;  // Get the scene from the game
        this.gridSize = 1;
        this.position = { x: 0, y: 0, z: 0 };
        this.cardinalOrientation = 'north';    // Default orientation for N,E,S,W
        this.intercardinalOrientation = 'north'; // Default orientation for NE,SE,SW,NW
        this.targetRotation = 0;
        this.currentRotation = 0;
        this.activeKeys = new Set();  // Track active movement keys
        this.lastMovementDir = null;  // Store last movement direction
        this.movementBuffer = null;  // Store buffered movement
        this.movementTimeout = null; // Store timeout ID
        this.MOVEMENT_DELAY = 50;    // 50ms delay to detect multi-key presses
        this.lastCameraAngle = 0;    // Store last camera angle
        
        // Avatar parts
        this.parts = {
            head: null,
            face: null,
            body: null,
            leftArm: null,
            rightArm: null,
            leftLeg: null,
            rightLeg: null
        };
        
        this.colors = {
            skin: 0xffdbac,
            shirt: 0x3498db,
            pants: 0x2c3e50,
            shoes: 0x34495e,
            eyes: 0x000000
        };
        
        this.chatBubble = null;
        this.chatTimeout = null;
        
        this.chatBubbles = [];  // Array to store multiple chat bubbles
        this.bubbleSpacing = 10;  // Vertical spacing between bubbles
        this.lastAnimationTime = Date.now();  // For smooth animation timing
        
        this.createAvatar();
    }

    createAvatar() {
        // Create avatar parts
        const headGeometry = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const bodyGeometry = new THREE.BoxGeometry(0.45, 0.6, 0.2);
        const armGeometry = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const legGeometry = new THREE.BoxGeometry(0.2, 0.5, 0.2);

        // Materials
        const skinMaterial = new THREE.MeshStandardMaterial({ color: this.colors.skin });
        const shirtMaterial = new THREE.MeshStandardMaterial({ color: this.colors.shirt });
        const pantsMaterial = new THREE.MeshStandardMaterial({ color: this.colors.pants });
        
        // Create face features
        const faceGeometry = new THREE.PlaneGeometry(0.45, 0.45);
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 128;
        faceCanvas.height = 128;
        const ctx = faceCanvas.getContext('2d');
        
        // Draw face
        ctx.fillStyle = '#' + this.colors.skin.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 128, 128);
        
        // Draw eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(30, 48, 12, 12);
        ctx.fillRect(78, 48, 12, 12);
        
        // Draw mouth
        ctx.fillRect(40, 88, 36, 4);

        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        const faceMaterial = new THREE.MeshBasicMaterial({ map: faceTexture });

        // Create mesh parts
        this.parts.head = new THREE.Mesh(headGeometry, skinMaterial);
        this.parts.face = new THREE.Mesh(faceGeometry, faceMaterial);
        this.parts.body = new THREE.Mesh(bodyGeometry, shirtMaterial);
        this.parts.leftArm = new THREE.Mesh(armGeometry, shirtMaterial);
        this.parts.rightArm = new THREE.Mesh(armGeometry, shirtMaterial);
        this.parts.leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        this.parts.rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);

        // Position parts relative to center
        // Legs start at y=0 to be truly flush with floor
        this.parts.leftLeg.position.set(-0.1, -0.25, 0);
        this.parts.rightLeg.position.set(0.1, -0.25, 0);
        
        // Body starts right above legs
        this.parts.body.position.y = 0.3;  // 0.5 (legs height) + 0.3 (half body height)
        this.parts.leftArm.position.set(-0.325, 0.3, 0);
        this.parts.rightArm.position.set(0.325, 0.3, 0);
        
        // Head at top
        this.parts.head.position.y = 0.85;  // 0.55 (body pos) + 0.3 (half body) + 0.225 (half head)
        this.parts.face.position.set(0, 0.85, 0.23);

        // Create avatar group
        this.group = new THREE.Group();
        Object.values(this.parts).forEach(part => {
            if (part) this.group.add(part);
        });

        // Add to scene
        this.scene.add(this.group);
        this.updatePosition();
    }

    updatePosition() {
        this.group.position.set(
            this.position.x,
            this.position.y,
            this.position.z
        );
    }

    isIntercardinalAngle(angle) {
        // Convert angle to degrees and normalize to 0-360
        const degrees = ((angle * 180 / Math.PI) + 360) % 360;
        
        // Check if we're at NE (45°), SE (135°), SW (225°), or NW (315°)
        // Allow for some small deviation (±10°)
        const isNE = Math.abs(degrees - 45) <= 22.5;
        const isSE = Math.abs(degrees - 135) <= 22.5;
        const isSW = Math.abs(degrees - 225) <= 22.5;
        const isNW = Math.abs(degrees - 315) <= 22.5;
        
        return isNE || isSE || isSW || isNW;
    }

    getCompassDirection(angle) {
        // Convert angle to degrees and normalize to 0-360
        // Subtract 90 degrees to align with game's coordinate system
        const degrees = (((angle * 180 / Math.PI) - 90 + 360) % 360);
        
        // Get the base compass direction before any orientation adjustments
        let baseDirection;
        if (degrees >= 337.5 || degrees < 22.5) baseDirection = 'N';
        else if (degrees >= 22.5 && degrees < 67.5) baseDirection = 'NE';
        else if (degrees >= 67.5 && degrees < 112.5) baseDirection = 'E';
        else if (degrees >= 112.5 && degrees < 157.5) baseDirection = 'SE';
        else if (degrees >= 157.5 && degrees < 202.5) baseDirection = 'S';
        else if (degrees >= 202.5 && degrees < 247.5) baseDirection = 'SW';
        else if (degrees >= 247.5 && degrees < 292.5) baseDirection = 'W';
        else if (degrees >= 292.5 && degrees < 337.5) baseDirection = 'NW';
        else baseDirection = 'N';

        // Apply orientation based on whether it's a cardinal or intercardinal direction
        const isIntercardinal = baseDirection.length === 2; // NE, SE, SW, NW are 2 characters
        const orientation = isIntercardinal ? this.intercardinalOrientation : this.cardinalOrientation;
        
        // Calculate orientation offset
        const orientationOffsets = {
            'north': 0,
            'east': 90,
            'south': 180,
            'west': 270
        };
        
        const adjustedDegrees = (degrees + orientationOffsets[orientation]) % 360;
        
        // Convert back to compass direction
        if (adjustedDegrees >= 337.5 || adjustedDegrees < 22.5) return 'N';
        if (adjustedDegrees >= 22.5 && adjustedDegrees < 67.5) return 'NE';
        if (adjustedDegrees >= 67.5 && adjustedDegrees < 112.5) return 'E';
        if (adjustedDegrees >= 112.5 && adjustedDegrees < 157.5) return 'SE';
        if (adjustedDegrees >= 157.5 && adjustedDegrees < 202.5) return 'S';
        if (adjustedDegrees >= 202.5 && adjustedDegrees < 247.5) return 'SW';
        if (adjustedDegrees >= 247.5 && adjustedDegrees < 292.5) return 'W';
        if (adjustedDegrees >= 292.5 && adjustedDegrees < 337.5) return 'NW';
        return 'N';
    }

    move(direction, cameraAngle) {
        this.lastCameraAngle = cameraAngle;  // Store camera angle

        // Clear any existing movement timeout
        if (this.movementTimeout) {
            clearTimeout(this.movementTimeout);
        }

        // Add key to active set
        this.activeKeys.add(direction);
        
        // Set up the movement buffer
        this.movementBuffer = {
            keys: new Set(this.activeKeys),
            cameraAngle: cameraAngle
        };

        // Wait a short time to see if other keys are pressed
        this.movementTimeout = setTimeout(() => {
            this.executeMovement();
        }, this.MOVEMENT_DELAY);
    }

    executeMovement() {
        if (!this.movementBuffer) return;

        const { keys, cameraAngle } = this.movementBuffer;
        const compassDir = this.getCompassDirection(cameraAngle);
        const directionMappings = {
            'N':  { 'ArrowUp': 'N', 'ArrowRight': 'E', 'ArrowDown': 'S', 'ArrowLeft': 'W' },
            'NE': { 'ArrowUp': 'E', 'ArrowRight': 'S', 'ArrowDown': 'W', 'ArrowLeft': 'N' },
            'E':  { 'ArrowUp': 'E', 'ArrowRight': 'S', 'ArrowDown': 'W', 'ArrowLeft': 'N' },
            'SE': { 'ArrowUp': 'S', 'ArrowRight': 'W', 'ArrowDown': 'N', 'ArrowLeft': 'E' },
            'S':  { 'ArrowUp': 'S', 'ArrowRight': 'W', 'ArrowDown': 'N', 'ArrowLeft': 'E' },
            'SW': { 'ArrowUp': 'W', 'ArrowRight': 'N', 'ArrowDown': 'E', 'ArrowLeft': 'S' },
            'W':  { 'ArrowUp': 'W', 'ArrowRight': 'N', 'ArrowDown': 'E', 'ArrowLeft': 'S' },
            'NW': { 'ArrowUp': 'N', 'ArrowRight': 'E', 'ArrowDown': 'S', 'ArrowLeft': 'W' }
        };

        // Calculate movement based on all buffered keys
        let dx = 0, dz = 0;
        let movements = new Set();

        // Process all active keys
        keys.forEach(key => {
            const mappedDir = directionMappings[compassDir][key];
            if (mappedDir) {
                const movement = this.getMovementForDirection(mappedDir);
                dx += movement.x;
                dz += movement.z;
                movements.add(mappedDir);
            }
        });

        // Determine movement direction and rotation
        let targetDir;
        const isDiagonal = keys.size === 2;
        
        if (dx !== 0 && dz !== 0 && isDiagonal) {
            // Diagonal movement (only if exactly 2 keys are pressed)
            if (dx > 0 && dz < 0) targetDir = 'NE';
            else if (dx > 0 && dz > 0) targetDir = 'SE';
            else if (dx < 0 && dz > 0) targetDir = 'SW';
            else if (dx < 0 && dz < 0) targetDir = 'NW';
            
            // For diagonal movement, move exactly one tile in both directions
            dx = Math.sign(dx);
            dz = Math.sign(dz);
        } else if (dx !== 0 || dz !== 0) {
            // Cardinal movement
            if (dx > 0) targetDir = 'E';
            else if (dx < 0) targetDir = 'W';
            else if (dz > 0) targetDir = 'S';
            else if (dz < 0) targetDir = 'N';
            
            // For cardinal movement, move exactly one tile
            dx = Math.sign(dx);
            dz = Math.sign(dz);
        }

        // Apply movement and rotation
        if (targetDir) {
            const movement = this.getMovementForDirection(targetDir);
            // Round current position to nearest integer before adding movement
            this.position.x = Math.round(this.position.x) + dx;
            this.position.z = Math.round(this.position.z) + dz;
            this.targetRotation = movement.rotation;
            this.lastMovementDir = targetDir;
            this.updatePosition();
        }

        // Clear the movement buffer
        this.movementBuffer = null;
    }

    removeKey(direction) {
        this.activeKeys.delete(direction);
        
        // Clear any existing movement timeout
        if (this.movementTimeout) {
            clearTimeout(this.movementTimeout);
            this.movementTimeout = null;
        }

        // If there are remaining keys, trigger a new movement
        if (this.activeKeys.size > 0) {
            this.move([...this.activeKeys][0], this.lastCameraAngle);
        } else if (this.lastMovementDir) {
            // If no keys are pressed, maintain the last rotation
            const movement = this.getMovementForDirection(this.lastMovementDir);
            this.targetRotation = movement.rotation;
        }
    }

    getMovementForDirection(direction) {
        const movements = {
            'N': { x: 0, z: -1, rotation: Math.PI },
            'E': { x: 1, z: 0, rotation: Math.PI/2 },
            'S': { x: 0, z: 1, rotation: 0 },
            'W': { x: -1, z: 0, rotation: -Math.PI/2 },
            // Add diagonal movements
            'NE': { x: 1, z: -1, rotation: Math.PI * 0.75 },  // 135°
            'SE': { x: 1, z: 1, rotation: Math.PI * 0.25 },   // 45°
            'SW': { x: -1, z: 1, rotation: -Math.PI * 0.25 }, // -45°
            'NW': { x: -1, z: -1, rotation: -Math.PI * 0.75 } // -135°
        };
        return movements[direction];
    }

    getDiagonalRotation(dx, dz) {
        // Calculate rotation for diagonal movement
        const angle = Math.atan2(dx, -dz);  // Use atan2 for correct quadrant
        return angle;
    }

    animate(zoomLevel = 1) {
        // Smoothly rotate towards target rotation
        const rotationDiff = this.targetRotation - this.currentRotation;
        
        // Normalize the difference to be between -PI and PI
        let normalizedDiff = rotationDiff;
        while (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
        while (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;
        
        // Apply smooth rotation with faster speed
        if (Math.abs(normalizedDiff) > 0.01) {
            this.currentRotation += normalizedDiff * 0.5;
            this.currentRotation = ((this.currentRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            this.group.rotation.y = this.currentRotation;
        } else {
            this.currentRotation = this.targetRotation;
            this.group.rotation.y = this.currentRotation;
        }
        
        // Update chat bubbles if any exist
        if (this.chatBubbles.length > 0) {
            const currentTime = Date.now();
            const deltaTime = Math.min((currentTime - this.lastAnimationTime) / 1000, 0.1); // Cap delta time
            this.lastAnimationTime = currentTime;

            // Update float offsets for all bubbles
            const floatSpeed = 3; // pixels per second
            this.chatBubbles.forEach((bubbleData, index) => {
                if (index === 0) {
                    bubbleData.floatOffset = Math.min(0, bubbleData.floatOffset - floatSpeed * deltaTime);
                } else {
                    const prevBubble = this.chatBubbles[index - 1];
                    const targetOffset = prevBubble.floatOffset - bubbleData.element.offsetHeight - 10;
                    bubbleData.floatOffset = Math.min(targetOffset, bubbleData.floatOffset - floatSpeed * deltaTime);
                }
            });

            this.updateChatBubblesPosition(zoomLevel);
        }
    }

    setColor(part, color) {
        if (this.colors[part] !== undefined) {
            this.colors[part] = color;
            this.updateColors();
        }
    }

    updateColors() {
        this.parts.head.material.color.setHex(this.colors.skin);
        this.parts.body.material.color.setHex(this.colors.shirt);
        this.parts.leftArm.material.color.setHex(this.colors.shirt);
        this.parts.rightArm.material.color.setHex(this.colors.shirt);
        this.parts.leftLeg.material.color.setHex(this.colors.pants);
        this.parts.rightLeg.material.color.setHex(this.colors.pants);

        // Update face texture
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = 128;
        faceCanvas.height = 128;
        const ctx = faceCanvas.getContext('2d');
        
        // Draw face with updated skin color
        ctx.fillStyle = '#' + this.colors.skin.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 128, 128);
        
        // Draw eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(30, 48, 12, 12);
        ctx.fillRect(78, 48, 12, 12);
        
        // Draw mouth
        ctx.fillRect(40, 88, 36, 4);

        // Update the face texture
        const faceTexture = new THREE.CanvasTexture(faceCanvas);
        this.parts.face.material.map = faceTexture;
        this.parts.face.material.needsUpdate = true;
    }

    setCardinalOrientation(orientation) {
        this.cardinalOrientation = orientation;
    }

    setIntercardinalOrientation(orientation) {
        this.intercardinalOrientation = orientation;
    }

    formatMessage(message) {
        // First escape any HTML to prevent XSS
        let escaped = message.replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[char]);

        // Convert emoji shortcodes to actual emoji characters using emoji-toolkit
        escaped = joypixels.shortnameToUnicode(escaped);

        // Handle color formatting at the start of message
        const colorMatch = escaped.match(/^@([a-zA-Z]+)@(.*)/);
        if (colorMatch) {
            const [_, color, rest] = colorMatch;
            // Only apply color if it's a valid CSS color name
            const tempElement = document.createElement('div');
            tempElement.style.color = color;
            if (tempElement.style.color !== '') {
                escaped = `<span style="color: ${color}">${rest}</span>`;
            }
        }

        // Then apply markdown-style formatting
        return escaped
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // **bold**
            .replace(/\*(.+?)\*/g, '<em>$1</em>')             // *italic*
            .replace(/\_\_(.+?)\_\_/g, '<u>$1</u>')           // __underline__
            .replace(/\~\~(.+?)\~\~/g, '<s>$1</s>')          // ~~strikethrough~~
            .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>'); // ||spoiler||
    }

    showChatMessage(message) {
        // Create new chat bubble
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        
        // Format the message but keep the prefix as-is
        const formattedMessage = this.formatMessage(message);
        bubble.innerHTML = `<span style="font-weight: bold; */margin-right: 1ch;*/">P1: </span>${formattedMessage}`;
        
        // Parse emojis in the bubble
        twemoji.parse(bubble, {
            folder: 'svg',
            ext: '.svg'
        });
        
        // Add click handlers for spoilers
        bubble.querySelectorAll('.spoiler').forEach(spoiler => {
            spoiler.addEventListener('click', () => {
                spoiler.classList.add('revealed');
            });
        });

        document.body.appendChild(bubble);

        // Calculate number of lines based on bubble width and content
        const computedStyle = window.getComputedStyle(bubble);
        const lineHeight = parseFloat(computedStyle.lineHeight);
        const lines = Math.max(1, Math.ceil(bubble.offsetHeight / (lineHeight || 20))); // fallback to 20px if lineHeight is 'normal'
        bubble.style.setProperty('--lines', lines);

        // Create bubble data object
        const bubbleData = {
            element: bubble,
            createdAt: Date.now(),
            timeout: null,
            floatOffset: 0  // Current float animation offset
        };

        // Add to bubbles array
        this.chatBubbles.push(bubbleData);

        // Position the bubble above the avatar's head
        this.updateChatBubblesPosition();

        // Initial transform for centering horizontally
        bubble.style.transform = 'translate(-50%, 0)';

        // Start fade out near the end
        bubbleData.timeout = setTimeout(() => {
            bubble.style.opacity = '0';
            bubble.style.transition = 'opacity 2s ease';
            
            // Remove bubble after fade out
            setTimeout(() => {
                this.removeChatBubble(bubbleData);
            }, 2000);
        }, 120000);  // Start fade after 2 min
    }

    removeChatBubble(bubbleData) {
        const index = this.chatBubbles.indexOf(bubbleData);
        if (index > -1) {
            bubbleData.element.remove();
            clearTimeout(bubbleData.timeout);
            this.chatBubbles.splice(index, 1);
            this.updateChatBubblesPosition();  // Reposition remaining bubbles
        }
    }

    updateChatBubblesPosition(zoomLevel = 1) {
        if (this.chatBubbles.length === 0) return;

        // Sort bubbles by creation time, newest first
        this.chatBubbles.sort((a, b) => b.createdAt - a.createdAt);

        // Convert 3D position to screen coordinates
        const vector = new THREE.Vector3();
        vector.setFromMatrixPosition(this.group.matrixWorld);
        
        // Scale height based on zoom level
        const baseHeight = 3;
        const heightScale = Math.max(0.5, 1.5 / zoomLevel);
        vector.y += baseHeight * heightScale;

        // Project the 3D point onto the 2D screen using the game's camera
        vector.project(this.game.camera);

        // Convert to screen coordinates
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        // Update base positions
        this.chatBubbles.forEach(bubbleData => {
            const bubble = bubbleData.element;
            bubble.style.left = `${x}px`;
            bubble.style.top = `${y}px`;
        });

        // Position each bubble, ensuring minimum spacing and no pull-down
        this.chatBubbles.forEach((bubbleData, index) => {
            if (index === 0) {
                // Newest bubble floats up to 0
                bubbleData.floatOffset = Math.min(0, bubbleData.floatOffset);
            } else {
                const prevBubble = this.chatBubbles[index - 1];
                const minOffset = prevBubble.floatOffset - bubbleData.element.offsetHeight - 10;
                // Only push the bubble up if it would overlap with the one below
                if (bubbleData.floatOffset > minOffset) {
                    bubbleData.floatOffset = minOffset;
                }
            }
        });

        // Apply final positions
        this.chatBubbles.forEach(bubbleData => {
            bubbleData.element.style.transform = `translate(-50%, ${bubbleData.floatOffset}px)`;
        });
    }

    // Remove the old updateChatBubblePosition method as it's no longer used
    updateChatBubblePosition() {
        // This method is deprecated
        return;
    }
}

class BixGame {
    constructor() {
        this.blocks = {};
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.gridSize = 32;
        this.cameraAngle = 5 *Math.PI / 4;  // 45 degrees
        this.targetCameraAngle = this.cameraAngle;
        this.isInventoryDragging = false;  // Initialize the dragging flag
        this.chatMessages = [];  // Store chat messages

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
                    opacity: 0.5,
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
                color: 0xFFAE00,
                material: new THREE.MeshPhysicalMaterial({ 
                    color: 0xFFAE00,
                    roughness: 0.5,
                    metalness: 0.6,
                    reflectivity: 0.2,
                    clearcoat: 0.3,
                    clearcoatRoughness: 0.3,
                    envMapIntensity: 1,
                    transmission: 0.6,
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
                color: 0x330033,
                material: new THREE.MeshPhysicalMaterial({ 
                    color: 0x330033,
                    roughness: 0.1,
                    metalness: 0.0,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    reflectivity: 0.5
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
        this.timeControlsContainer.style.fontFamily = '"Victor Mono", monospace';
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
        this.playPauseButton.style.padding = '5px 10px';
        this.playPauseButton.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        this.playPauseButton.style.border = 'none';
        this.playPauseButton.style.borderRadius = '3px';
        this.playPauseButton.style.cursor = 'pointer';
        this.playPauseButton.style.fontSize = '16px';
        this.playPauseButton.style.lineHeight = '1';
        this.playPauseButton.innerHTML = '⏸️';
        twemoji.parse(this.playPauseButton);
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
            this.playPauseButton.innerHTML = this.isPaused ? '▶️' : '⏸️';
            twemoji.parse(this.playPauseButton);
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
        
        // Initialize avatar before starting animation
        this.avatar = new Avatar(this, this.gridSize);  // Pass 'this' instead of this.scene
        
        // Add keyboard controls for avatar with key release handling
        document.addEventListener('keydown', (event) => {
            // Only process movement keys if controls are enabled and not typing in chat
            if (this.controlsEnabled && (!document.activeElement || !document.activeElement.closest('#chat-input'))) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                    event.preventDefault();
                    this.avatar.move(event.key, this.cameraAngle);
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            // Only process movement keys if controls are enabled and not typing in chat
            if (this.controlsEnabled && (!document.activeElement || !document.activeElement.closest('#chat-input'))) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                    event.preventDefault();
                    this.avatar.removeKey(event.key);
                    // Recalculate movement with remaining keys
                    if (this.avatar.activeKeys.size > 0) {
                        this.avatar.move([...this.avatar.activeKeys][0], this.cameraAngle);
                    }
                }
            }
        });

        // Setup controls
        this.setupControls();
        
        // Start game loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Initialize chat input
        this.setupChat();
    }
    
    setupControls() {
        this.keys = {};
        this.controlsEnabled = true;  // Initialize controls as enabled by default
        
        window.addEventListener('keydown', (e) => {
            if (!e.key) return;  // Skip if no key property
            const key = e.key.toLowerCase();
            
            // Always handle zoom with Ctrl/Cmd + +/-
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoom(1);
                    return;
                } else if (e.key === '-' || e.key === '_') {
                    e.preventDefault();
                    this.zoom(-1);
                    return;
                }
            }

            // Only process other controls if they are enabled and not typing in chat
            if (this.controlsEnabled && (!document.activeElement || !document.activeElement.closest('#chat-input'))) {
                // Handle WASD for camera movement
                if (['w', 'a', 's', 'd'].includes(key)) {
                    this.keys[key] = true;
                }
                
                // Only trigger rotation keys on initial keydown
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
            }
        });

        window.addEventListener('keyup', (e) => {
            if (!e.key) return;  // Skip if no key property
            const key = e.key.toLowerCase();
            this.keys[key] = false;
            
            // Only process controls if they are enabled and not typing in chat
            if (this.controlsEnabled && (!document.activeElement || !document.activeElement.closest('#chat-input'))) {
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

            // Check if cursor is over any window
            const isOverWindow = e.target.closest('.draggable-window');
            if (!isOverWindow) {
                // Only handle zoom if not over a window
                const delta = -Math.sign(e.deltaY);
                this.zoom(delta);
            }
        }, { passive: false });
    }

    zoom(delta) {
        const zoomSpeed = 0.15;
        const newZoomLevel = this.zoomLevel * (1 + delta * zoomSpeed);
        
        // Limit zoom range
        if (newZoomLevel >= 0.4 && newZoomLevel <= 2.5) {
            this.zoomLevel = newZoomLevel;
            this.updateCameraProjection();
        }
    }

    getHighestBlockAtPosition(x, z) {
        let maxY = -1;
        Object.values(this.blocks).forEach(block => {
            if (Math.round(block.position.x) === x && Math.round(block.position.z) === z) {
                maxY = Math.max(maxY, Math.round(block.position.y));
            }
        });
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
        // Don't show preview block if interacting with inventory
        const inventoryWindow = document.getElementById('inventory-window');
        if (inventoryWindow.contains(document.activeElement) || 
            this.isInventoryDragging) {
            this.previewBlock.visible = false;
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Only check intersections with floor blocks
        const floorBlocks = Object.values(this.blocks).filter(block => block.position.y === -0.6);
        const intersects = this.raycaster.intersectObjects(floorBlocks);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const floorX = Math.round(intersect.point.x);
            const floorZ = Math.round(intersect.point.z);
            
            // Get the build height based on mode
            let buildY;
            if (this.buildHeightMode === 'auto') {
                const highestY = this.getHighestBlockAtPosition(floorX, floorZ);
                buildY = highestY + 1;
            } else {
                buildY = this.fixedBuildHeight;
            }
            
            // Additional bounds check to ensure we're within the grid
            if (floorX >= -this.gridSize/2 && 
                floorX < this.gridSize/2 && 
                floorZ >= -this.gridSize/2 && 
                floorZ < this.gridSize/2) {
                const key = `${floorX},${buildY},${floorZ}`;
                if (!this.blocks[key]) {
                    this.previewBlock.position.set(floorX, buildY, floorZ);
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
        // Only process camera movement if controls are enabled
        if (!this.controlsEnabled) return;

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
        // Initialize windows configuration
        this.windows = {
            inventory: {
                id: 'inventory-window',
                icon: '📦',
                title: 'Inventory'
            },
            shop: {
                id: 'shop-window',
                icon: '🛍️',
                title: 'Shop'
            },
            buildTools: {
                id: 'build-tools-window',
                icon: '🏗️',
                title: 'Build Tools'
            },
            messages: {
                id: 'messages-window',
                icon: '💬',
                title: 'Messages'
            },
            avatar: {
                id: 'avatar-window',
                icon: '👤',
                title: 'Character'
            },
            settings: {
                id: 'settings-window',
                icon: '⚙️',
                title: 'Settings'
            }
        };

        // Track active window
        this.activeWindow = null;

        // Initialize dock
        const dockContent = document.getElementById('dock-content');
        
        // Create dock icons for all windows
        Object.entries(this.windows).forEach(([key, window]) => {
            const dockItem = document.createElement('div');
            dockItem.className = 'dock-item';
            dockItem.innerHTML = `<span style="color: white; font-size: 20px;">${window.icon}</span>`;
            dockItem.setAttribute('data-window', key);
            
            // Add click handler
            dockItem.addEventListener('click', () => {
                this.toggleWindow(key);
            });
            
            dockContent.appendChild(dockItem);
        });

        // Setup all windows
        Object.entries(this.windows).forEach(([key, window]) => {
            const windowElement = document.getElementById(window.id);
            const closeButton = windowElement.querySelector('.close-button');
            
            // Make window draggable
            this.makeWindowDraggable(windowElement);
            
            // Add close button handler
            closeButton.addEventListener('click', () => {
                this.hideWindow(key);
            });

            // Add click handler to bring window to front
            windowElement.addEventListener('mousedown', (e) => {
                if (!windowElement.classList.contains('active')) {
                    this.setActiveWindow(key);
                }
            });
        });

        // Initialize inventory specific functionality
        this.initInventory();
        this.initShop();
        this.initAvatarEditor();

        // Initialize settings specific functionality
        this.initSettings();

        // Initialize messages specific functionality
        this.initMessages();

        // Initialize build tools specific functionality
        this.initBuildTools();
    }

    setActiveWindow(key) {
        // Remove active class from all windows
        document.querySelectorAll('.draggable-window').forEach(window => {
            window.classList.remove('active');
        });

        if (key) {
            const windowElement = document.getElementById(this.windows[key].id);
            windowElement.classList.add('active');
            windowElement.style.zIndex = this.getTopZIndex() + 1;
            this.activeWindow = key;
        } else {
            this.activeWindow = null;
        }
    }

    toggleWindow(key) {
        const windowElement = document.getElementById(this.windows[key].id);
        const isVisible = windowElement.style.display === 'block';
        const isActive = this.activeWindow === key;

        if (!isVisible) {
            // If window is hidden, show it and make it active
            this.showWindow(key);
            this.setActiveWindow(key);
        } else if (isActive) {
            // If window is visible and active, hide it
            this.hideWindow(key);
        } else {
            // If window is visible but not active, make it active
            this.setActiveWindow(key);
        }
    }

    showWindow(key) {
        const windowElement = document.getElementById(this.windows[key].id);
        const dockItem = document.querySelector(`.dock-item[data-window="${key}"]`);
        
        // If the window hasn't been positioned yet, center it
        if (!windowElement.style.left || !windowElement.style.top) {
            // Need to make it temporarily visible to get dimensions
            windowElement.style.visibility = 'hidden';
            windowElement.style.display = 'block';
            
            const rect = windowElement.getBoundingClientRect();
            const centerX = (window.innerWidth - rect.width) / 2;
            const centerY = (window.innerHeight - rect.height) / 2;
            
            windowElement.style.left = `${centerX}px`;
            windowElement.style.top = `${centerY}px`;
            windowElement.style.visibility = 'visible';
        } else {
            windowElement.style.display = 'block';
        }

        dockItem.classList.add('active');
        
        // Add indicator
        if (!dockItem.querySelector('.indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'indicator';
            dockItem.appendChild(indicator);
        }
    }

    hideWindow(key) {
        const windowElement = document.getElementById(this.windows[key].id);
        const dockItem = document.querySelector(`.dock-item[data-window="${key}"]`);
        
        windowElement.style.display = 'none';
        dockItem.classList.remove('active');
        
        // Remove indicator
        const indicator = dockItem.querySelector('.indicator');
        if (indicator) {
            indicator.remove();
        }

        // If this was the active window, clear active state
        if (this.activeWindow === key) {
            this.setActiveWindow(null);
        }
    }

    updateBlockSelector() {
        // Update selected state in inventory grid
        const items = document.querySelectorAll('.inventory-item');
        items.forEach(item => {
            if (item.getAttribute('data-block-type') === this.selectedBlockType) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
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

    getTopZIndex() {
        return Math.max(
            1000,
            ...Array.from(document.querySelectorAll('.draggable-window'))
                .map(el => parseInt(getComputedStyle(el).zIndex) || 0)
        );
    }

    initInventory() {
        const inventoryGrid = document.getElementById('inventory-grid');
        
        // Create inventory grid items
        Object.entries(this.blockTypes).forEach(([type, block]) => {
            const item = document.createElement('div');
            item.className = 'inventory-item';
            item.setAttribute('data-block-type', type);
            
            const preview = document.createElement('div');
            preview.style.width = '30px';
            preview.style.height = '30px';
            preview.style.backgroundColor = '#' + block.color.toString(16).padStart(6, '0');
            preview.style.border = '1px solid rgba(255, 255, 255, 0.3)';
            preview.style.borderRadius = '4px';
            
            item.appendChild(preview);
            item.title = `${block.name} (${block.key})`;
            
            item.addEventListener('click', () => {
                this.selectedBlockType = type;
                this.updateBlockSelector();
            });
            
            inventoryGrid.appendChild(item);
        });

        // Show initial selection
        this.updateBlockSelector();
    }

    initShop() {
        const shopGrid = document.getElementById('shop-grid');
        // Add shop items here
        const shopItems = [
            { name: 'Premium Blocks Pack', price: '500', icon: '🎨' },
            { name: 'Special Effects', price: '1000', icon: '✨' },
            { name: 'Custom Colors', price: '750', icon: '🎯' },
            { name: 'Terrain Tools', price: '1500', icon: '⛰️' }
        ];

        shopItems.forEach(item => {
            const shopItem = document.createElement('div');
            shopItem.className = 'inventory-item';
            shopItem.style.width = 'auto';
            shopItem.style.height = 'auto';
            shopItem.style.padding = '12px';
            shopItem.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span style="font-size: 24px;">${item.icon}</span>
                    <div style="text-align: center;">
                        <div>${item.name}</div>
                        <div style="color: #ffd700;">🪙 ${item.price}</div>
                    </div>
                </div>
            `;
            shopGrid.appendChild(shopItem);
        });
    }

    initAvatarEditor() {
        const avatarEditor = document.getElementById('avatar-editor');
        avatarEditor.innerHTML = `
            <div class="avatar-customization">
                <div class="color-section">
                    <h3>Skin Color</h3>
                    <input type="color" id="skin-color" value="#ffdbac">
                </div>
                <div class="color-section">
                    <h3>Shirt Color</h3>
                    <input type="color" id="shirt-color" value="#3498db">
                </div>
                <div class="color-section">
                    <h3>Pants Color</h3>
                    <input type="color" id="pants-color" value="#2c3e50">
                </div>
            </div>
        `;

        // Add color change listeners
        document.getElementById('skin-color').addEventListener('input', (e) => {
            this.avatar.setColor('skin', parseInt(e.target.value.substring(1), 16));
        });

        document.getElementById('shirt-color').addEventListener('input', (e) => {
            this.avatar.setColor('shirt', parseInt(e.target.value.substring(1), 16));
        });

        document.getElementById('pants-color').addEventListener('input', (e) => {
            this.avatar.setColor('pants', parseInt(e.target.value.substring(1), 16));
        });
    }

    initSettings() {
        const cardinalSelect = document.getElementById('cardinal-movement');
        const intercardinalSelect = document.getElementById('intercardinal-movement');
        
        // Prevent letter keys from affecting dropdowns
        const preventLetterKeys = (e) => {
            // If it's a letter key (a-z or A-Z)
            if (/^[a-zA-Z]$/.test(e.key)) {
                e.preventDefault();
            }
        };

        cardinalSelect.addEventListener('keydown', preventLetterKeys);
        intercardinalSelect.addEventListener('keydown', preventLetterKeys);
        
        // Add change listeners for both movement directions
        cardinalSelect.addEventListener('change', (e) => {
            this.avatar.setCardinalOrientation(e.target.value);
        });
        
        intercardinalSelect.addEventListener('change', (e) => {
            this.avatar.setIntercardinalOrientation(e.target.value);
        });
    }

    initMessages() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and content
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                
                // Add active class to clicked button and corresponding content
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                const tabContent = document.querySelector(`#${tabId === 'chat' ? 'chat-history' : tabId === 'dms' ? 'direct-messages' : 'mentions'}`);
                tabContent.classList.add('active');
            });
        });
    }

    initBuildTools() {
        // Initialize build height mode
        this.buildHeightMode = 'auto';
        this.fixedBuildHeight = 0;

        const buildHeightModeInputs = document.querySelectorAll('input[name="build-height-mode"]');
        const fixedHeightInput = document.getElementById('fixed-build-height');

        buildHeightModeInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.buildHeightMode = e.target.value;
                fixedHeightInput.disabled = this.buildHeightMode === 'auto';
            });
        });

        fixedHeightInput.addEventListener('change', (e) => {
            this.fixedBuildHeight = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
            e.target.value = this.fixedBuildHeight;
        });
    }

    makeWindowDraggable(windowElement) {
        const header = windowElement.querySelector('.window-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-controls') === null) {
                isDragging = true;
                this.isInventoryDragging = true;
                initialX = e.clientX - windowElement.offsetLeft;
                initialY = e.clientY - windowElement.offsetTop;
                
                // Find the window key and make it active
                const key = Object.entries(this.windows).find(([k, w]) => w.id === windowElement.id)?.[0];
                if (key) {
                    this.setActiveWindow(key);
                }
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                currentX = Math.max(0, Math.min(currentX, window.innerWidth - windowElement.offsetWidth));
                currentY = Math.max(0, Math.min(currentY, window.innerHeight - windowElement.offsetHeight));
                
                windowElement.style.left = currentX + 'px';
                windowElement.style.top = currentY + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            this.isInventoryDragging = false;
        });
    }

    setupChat() {
        const chatInput = document.getElementById('chat-input');
        const chatContent = chatInput.querySelector('.chat-content');
        const chatHistory = document.getElementById('chat-history');
        
        const MAX_CHARS = 100;  // Maximum characters allowed

        // Ensure proper focus behavior
        const ensureFocus = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // If content isn't focused, focus it and place cursor at end
            if (document.activeElement !== chatContent) {
                chatContent.focus();
                // Place cursor at end of content
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(chatContent);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        };

        // Add click handlers to both the container and content
        chatInput.addEventListener('click', ensureFocus);
        chatContent.addEventListener('click', (e) => e.stopPropagation());

        // Handle input to enforce character limit
        chatContent.addEventListener('input', (e) => {
            const text = chatContent.textContent;
            if (text.length > MAX_CHARS) {
                e.preventDefault();
                chatContent.textContent = text.slice(0, MAX_CHARS);
                // Restore cursor position at the end
                const range = document.createRange();
                const selection = window.getSelection();
                range.selectNodeContents(chatContent);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });

        // Prevent line breaks and handle paste
        chatContent.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });

        // Stop paste event from bubbling up from chatInput
        chatInput.addEventListener('paste', (e) => {
            e.stopPropagation();
        });

        // Handle paste events, converting line breaks to spaces
        chatContent.addEventListener('paste', (e) => {
            e.preventDefault();
            e.stopPropagation();
            let text = e.clipboardData.getData('text/plain');
            // Convert line breaks to spaces, ensuring there's exactly one space between words
            text = text.replace(/[\r\n\s]+/g, ' ').trim();
            const currentLength = chatContent.textContent.length;
            const availableSpace = MAX_CHARS - currentLength;
            if (availableSpace > 0) {
                document.execCommand('insertText', false, text.slice(0, availableSpace));
            }
        });

        // Create new messages button
        const newMessagesButton = document.createElement('button');
        newMessagesButton.className = 'new-messages-button';
        newMessagesButton.textContent = 'NEW MESSAGES';
        chatHistory.appendChild(newMessagesButton);
        
        // Track if user has scrolled up
        let isUserScrolled = false;
        let lastScrollHeight = chatHistory.scrollHeight;
        
        // Handle scroll events
        chatHistory.addEventListener('scroll', () => {
            const isScrolledToBottom = chatHistory.scrollHeight - chatHistory.clientHeight <= chatHistory.scrollTop + 1;
            
            if (isScrolledToBottom) {
                isUserScrolled = false;
                newMessagesButton.classList.remove('visible');
            } else {
                isUserScrolled = true;
            }
        });
        
        // Handle new messages button click
        newMessagesButton.addEventListener('click', () => {
            chatHistory.scrollTop = chatHistory.scrollHeight;
            newMessagesButton.classList.remove('visible');
            isUserScrolled = false;
        });

        // Handle chat input
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                const message = chatContent.textContent.trim();
                
                if (message) {
                    // Show floating chat bubble
                    this.avatar.showChatMessage(message);
                    
                    // Add message to chat history
                    const messageObj = {
                        sender: 'P1',
                        content: message,
                        timestamp: new Date()
                    };
                    this.chatMessages.push(messageObj);
                    
                    // Create and append message element
                    const messageElement = document.createElement('div');
                    messageElement.className = 'chat-message';
                    messageElement.innerHTML = `<span style="font-weight: bold;">P1: </span>${this.avatar.formatMessage(message)}`;
                    
                    // Parse emojis in the message
                    twemoji.parse(messageElement, {
                        folder: 'svg',
                        ext: '.svg'
                    });
                    
                    // Add click handlers for spoilers in the chat history
                    messageElement.querySelectorAll('.spoiler').forEach(spoiler => {
                        spoiler.addEventListener('click', () => {
                            spoiler.classList.add('revealed');
                        });
                    });
                    
                    chatHistory.appendChild(messageElement);
                    
                    // Handle scrolling behavior
                    if (!isUserScrolled) {
                        chatHistory.scrollTop = chatHistory.scrollHeight;
                    } else if (chatHistory.scrollHeight > lastScrollHeight) {
                        newMessagesButton.classList.add('visible');
                    }
                    
                    lastScrollHeight = chatHistory.scrollHeight;
                    
                    // Clear input
                    chatContent.textContent = '';
                }
            }
        });

        // Prevent game controls when typing
        const disableControls = () => {
            this.controlsEnabled = false;
            // Clear any held keys to prevent stuck movement
            this.keys = {};
        };

        const enableControls = () => {
            this.controlsEnabled = true;
        };

        chatInput.addEventListener('focusin', disableControls);
        chatContent.addEventListener('focusin', disableControls);
        chatInput.addEventListener('focusout', enableControls);
        chatContent.addEventListener('focusout', enableControls);

        // Handle paste to strip formatting
        chatInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }

    formatTime(date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    setEmojiContent(element, emoji) {
        element.textContent = emoji;
        twemoji.parse(element, {
            folder: 'svg',
            ext: '.svg'
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update day/night cycle
        this.updateDayNightCycle();
        
        // Update avatar rotation
        this.avatar.animate(this.zoomLevel);
        
        // Check for held rotation keys only if controls are enabled
        if (this.controlsEnabled && (this.keys['q'] || this.keys['e'])) {
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
}

// Start the game when the page loads
window.addEventListener('load', () => {
    const game = new BixGame();
}); 