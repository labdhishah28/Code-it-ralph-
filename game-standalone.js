// ============================================================================
// OAK WOODS PLATFORMER - Standalone Version
// ============================================================================

// ============================================================================
// BOOT SCENE - Asset Loading
// ============================================================================

class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Display loading text
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.add.text(width / 2, height / 2, 'Loading Oak Woods...', {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Load asset manifest
        this.load.json('oakwoods-manifest', 'public/assets/oakwoods/assets.json');
    }

    create() {
        const manifest = this.cache.json.get('oakwoods-manifest');

        if (!manifest || !manifest.meta || !manifest.meta.basePath) {
            this.add.text(10, 10, 'Error: Missing assets.json\nCheck public/assets/oakwoods/', {
                fontSize: '14px',
                color: '#ff0000'
            });
            return;
        }

        const basePath = 'public/' + manifest.meta.basePath;

        // Load background images
        for (const bg of manifest.images.backgrounds) {
            this.load.image(bg.key, `${basePath}/${bg.path}`);
        }

        // Load decoration images
        for (const dec of manifest.images.decorations) {
            this.load.image(dec.key, `${basePath}/${dec.path}`);
        }

        // Load character spritesheet
        const char = manifest.spritesheets.character;
        this.load.spritesheet(char.key, `${basePath}/${char.path}`, {
            frameWidth: char.frameWidth,
            frameHeight: char.frameHeight
        });

        // Load tileset
        const tileset = manifest.tilesets.main;
        this.load.image(tileset.key, `${basePath}/${tileset.path}`);

        // Load coin sprite
        this.load.image('coin', 'coin1.png');

        // Load dragon and fire sprites
        this.load.image('dragon', 'dragon.png');
        this.load.image('fire', 'fire.png');

        // Load power-up sprite
        this.load.image('powerup-health', 'leg.png');

        // Start loading
        this.load.once('complete', () => {
            this.scene.start('GameScene');
        });

        this.load.start();
    }
}

// ============================================================================
// GAME SCENE - Main Gameplay
// ============================================================================

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.groundGeneratedToX = 0;
        this.isAttacking = false;
        this.isCrouching = false;

        // Health & Lives System
        this.playerHealth = 3;
        this.maxHealth = 3;
        this.isInvincible = false;
        this.invincibilityDuration = 2000;

        // Score & Coins
        this.score = 0;
        this.coinsCollected = 0;

        // Coin spawning system
        this.coinSpawnTimer = 0;
        this.coinSpawnInterval = 1000; // 1 second (changed from 4000)
        this.difficultyLevel = 1;
        this.nextCoinX = 400; // Start spawning ahead of player

        // Dragon enemy system
        this.dragonSpawnTimer = 0;
        this.dragonSpawnInterval = 8000; // 8 seconds
        this.dragonsDefeated = 0;

        // Power-up system
        this.powerUpSpawnTimer = 0;
        this.powerUpSpawnInterval = 6000; // 6 seconds (changed from 15000)
    }

    create() {
        // === BACKGROUND LAYERS (Parallax) ===
        this.bgLayer1 = this.add.tileSprite(0, 0, 320, 180, 'oakwoods-bg-layer1')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        this.bgLayer2 = this.add.tileSprite(0, 0, 320, 180, 'oakwoods-bg-layer2')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        this.bgLayer3 = this.add.tileSprite(0, 0, 320, 180, 'oakwoods-bg-layer3')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // === GROUND TILEMAP ===
        this.map = this.make.tilemap({
            tileWidth: 24,
            tileHeight: 24,
            width: 500,
            height: 8
        });

        const tileset = this.map.addTilesetImage('oakwoods-tileset');
        if (!tileset) {
            console.error('Failed to add tileset');
            return;
        }

        const layer = this.map.createBlankLayer('ground', tileset, 0, 16);
        if (!layer) {
            console.error('Failed to create layer');
            return;
        }
        this.groundLayer = layer;

        // Fill initial ground
        for (let x = 0; x < 20; x++) {
            this.map.putTileAt(0, x, 7, true, 'ground');
        }
        this.groundGeneratedToX = 20;

        // Enable collision
        this.groundLayer.setCollisionByExclusion([-1]);

        // === DECORATIONS ===
        const groundY = 184;

        // Shop
        this.add.image(250, groundY, 'oakwoods-shop').setOrigin(0.5, 1);

        // Lamps
        this.add.image(50, groundY, 'oakwoods-lamp').setOrigin(0.5, 1);
        this.add.image(180, groundY, 'oakwoods-lamp').setOrigin(0.5, 1);

        // Sign
        this.add.image(320, groundY, 'oakwoods-sign').setOrigin(0.5, 1);

        // Fences
        this.add.image(400, groundY, 'oakwoods-fence1').setOrigin(0.5, 1);
        this.add.image(470, groundY, 'oakwoods-fence2').setOrigin(0.5, 1);

        // Rocks
        this.add.image(140, groundY, 'oakwoods-rock1').setOrigin(0.5, 1);
        this.add.image(350, groundY, 'oakwoods-rock2').setOrigin(0.5, 1);
        this.add.image(550, groundY, 'oakwoods-rock3').setOrigin(0.5, 1);

        // Grass
        this.add.image(70, groundY, 'oakwoods-grass1').setOrigin(0.5, 1);
        this.add.image(120, groundY, 'oakwoods-grass2').setOrigin(0.5, 1);
        this.add.image(200, groundY, 'oakwoods-grass3').setOrigin(0.5, 1);
        this.add.image(280, groundY, 'oakwoods-grass1').setOrigin(0.5, 1);
        this.add.image(380, groundY, 'oakwoods-grass2').setOrigin(0.5, 1);
        this.add.image(450, groundY, 'oakwoods-grass3').setOrigin(0.5, 1);

        // === PLAYER CHARACTER ===
        this.player = this.physics.add.sprite(100, 120, 'oakwoods-char-blue', 0);
        this.player.setBounce(0);
        this.player.body.setSize(20, 38);
        this.player.body.setOffset(18, 16);

        // === COINS ===
        this.coins = this.physics.add.group();
        // Coins will spawn dynamically every 4 seconds

        // Coin collection
        this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);

        // === DRAGONS ===
        this.dragons = this.physics.add.group();
        this.fireProjectiles = this.physics.add.group();

        // Dragon collisions
        this.physics.add.overlap(this.player, this.dragons, this.hitByDragon, null, this);
        this.physics.add.overlap(this.player, this.fireProjectiles, this.hitByFire, null, this);

        // === POWER-UPS ===
        this.powerUps = this.physics.add.group();
        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);

        // Add collision
        this.physics.add.collider(this.player, this.groundLayer);

        // === CAMERA ===
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setDeadzone(50, 50);

        // Set world bounds
        this.physics.world.setBounds(0, 0, 500 * 24, 180);
        this.player.setCollideWorldBounds(true);
        this.player.body.setBoundsRectangle(new Phaser.Geom.Rectangle(0, 0, 999999, 180));

        // === ANIMATIONS ===
        this.anims.create({
            key: 'char-blue-idle',
            frames: this.anims.generateFrameNumbers('oakwoods-char-blue', { start: 0, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        this.anims.create({
            key: 'char-blue-run',
            frames: this.anims.generateFrameNumbers('oakwoods-char-blue', { start: 16, end: 21 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'char-blue-jump',
            frames: this.anims.generateFrameNumbers('oakwoods-char-blue', { start: 28, end: 31 }),
            frameRate: 10,
            repeat: 0
        });

        this.anims.create({
            key: 'char-blue-fall',
            frames: this.anims.generateFrameNumbers('oakwoods-char-blue', { start: 35, end: 37 }),
            frameRate: 10,
            repeat: 0
        });

        this.anims.create({
            key: 'char-blue-attack',
            frames: this.anims.generateFrameNumbers('oakwoods-char-blue', { start: 8, end: 13 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'char-blue-crouch',
            frames: this.anims.generateFrameNumbers('oakwoods-char-blue', { start: 42, end: 48 }),
            frameRate: 12,
            repeat: -1
        });

        this.player.anims.play('char-blue-idle', true);

        // Listen for attack animation complete
        this.player.on('animationcomplete', (anim) => {
            if (anim.key === 'char-blue-attack') {
                this.isAttacking = false;
            }
        });

        // === INPUT ===
        this.cursors = this.input.keyboard.createCursorKeys();
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.testDamageKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // === UI ===
        this.createUI();

        // === AUDIO ===
        // Initialize audio context for sound effects
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // === SOUND EFFECTS ===
    playCoinSound() {
        const ctx = this.audioContext;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Pleasant coin sound (high pitch)
        oscillator.frequency.setValueAtTime(800, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
    }

    playDragonSound() {
        const ctx = this.audioContext;
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Growl/roar sound (low pitch)
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(100, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
    }

    update() {
        const speed = 100;
        const jumpVelocity = -250;

        const onGround = this.player.body.blocked.down;
        const velocityY = this.player.body.velocity.y;
        const isMovingHorizontally = this.cursors.left.isDown || this.cursors.right.isDown;

        // Horizontal movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        // Crouch (Down arrow)
        if (this.cursors.down.isDown && onGround && !this.isAttacking) {
            this.isCrouching = true;
            this.player.setVelocityX(0);
            // Reduce hitbox when crouching
            this.player.body.setSize(20, 25);
            this.player.body.setOffset(18, 29);
        } else {
            if (this.isCrouching) {
                // Restore normal hitbox
                this.player.body.setSize(20, 38);
                this.player.body.setOffset(18, 16);
            }
            this.isCrouching = false;
        }

        // Jump (can't jump while crouching)
        if (this.cursors.up.isDown && onGround && !this.isAttacking && !this.isCrouching) {
            this.player.setVelocityY(jumpVelocity);
        }

        // Attack (can't attack while crouching)
        if (Phaser.Input.Keyboard.JustDown(this.attackKey) && onGround && !this.isAttacking && !this.isCrouching) {
            this.isAttacking = true;
            this.player.setVelocityX(0);
            this.player.anims.play('char-blue-attack', true);
        }

        // Test damage (for development)
        if (Phaser.Input.Keyboard.JustDown(this.testDamageKey)) {
            this.takeDamage(1);
        }

        // === ANIMATION STATE MACHINE ===
        if (!this.isAttacking) {
            if (this.isCrouching) {
                // Crouching animation
                this.player.anims.play('char-blue-crouch', true);
            } else if (!onGround) {
                if (velocityY < 0) {
                    this.player.anims.play('char-blue-jump', true);
                } else {
                    this.player.anims.play('char-blue-fall', true);
                }
            } else {
                if (isMovingHorizontally) {
                    this.player.anims.play('char-blue-run', true);
                } else {
                    this.player.anims.play('char-blue-idle', true);
                }
            }
        }

        // === PARALLAX SCROLLING ===
        const camX = this.cameras.main.scrollX;
        this.bgLayer1.tilePositionX = camX * 0.1;
        this.bgLayer2.tilePositionX = camX * 0.3;
        this.bgLayer3.tilePositionX = camX * 0.5;

        // === INFINITE GROUND GENERATION ===
        const playerTileX = Math.floor(this.player.x / 24);
        const generateAhead = 20;

        if (playerTileX + generateAhead > this.groundGeneratedToX) {
            const tilesToGenerate = (playerTileX + generateAhead) - this.groundGeneratedToX;
            for (let i = 0; i < tilesToGenerate; i++) {
                const x = this.groundGeneratedToX + i;
                if (x < 500) {
                    this.map.putTileAt(0, x, 7, true, 'ground');
                }
            }
            this.groundGeneratedToX = Math.min(playerTileX + generateAhead, 500);
        }

        // === COIN SPAWNING SYSTEM ===
        this.coinSpawnTimer += this.game.loop.delta;

        if (this.coinSpawnTimer >= this.coinSpawnInterval) {
            this.spawnCoin();
            this.coinSpawnTimer = 0;

            // Increase difficulty every 20 seconds (5 coin spawns)
            if (this.coinsCollected > 0 && this.coinsCollected % 5 === 0) {
                this.difficultyLevel++;
            }
        }

        // === DRAGON SPAWNING SYSTEM ===
        this.dragonSpawnTimer += this.game.loop.delta;

        if (this.dragonSpawnTimer >= this.dragonSpawnInterval) {
            this.spawnDragon();
            this.dragonSpawnTimer = 0;
        }

        // Update dragons
        this.dragons.children.entries.forEach(dragon => {
            if (dragon.active) {
                this.updateDragon(dragon);

                // Check if player is attacking and hits dragon
                if (this.isAttacking && this.physics.overlap(this.player, dragon)) {
                    this.attackDragon(dragon);
                }
            }
        });

        // Update fire projectiles
        this.fireProjectiles.children.entries.forEach(fire => {
            if (fire.active && fire.x < this.player.x - 200) {
                fire.destroy(); // Remove off-screen projectiles
            }
        });

        // === POWER-UP SPAWNING SYSTEM ===
        this.powerUpSpawnTimer += this.game.loop.delta;

        if (this.powerUpSpawnTimer >= this.powerUpSpawnInterval) {
            this.spawnPowerUp();
            this.powerUpSpawnTimer = 0;
        }
    }

    // === COIN SYSTEM ===
    spawnCoin() {
        // Spawn coin ahead of player
        const x = this.nextCoinX;

        // Determine coin height based on difficulty
        // 1 = ground level, 2 = low (crouch), 3 = mid (normal), 4 = high (jump)
        const heightType = Phaser.Math.Between(1, 4);
        let y;

        switch (heightType) {
            case 1: // Ground level - easy to collect
                y = 155;
                break;
            case 2: // Low - requires crouch
                y = 165;
                break;
            case 3: // Mid height - normal run
                y = 135;
                break;
            case 4: // High - requires jump
                y = 100 - (this.difficultyLevel * 5); // Gets higher with difficulty
                break;
        }

        // Create coin using sprite
        const coin = this.coins.create(x, y, 'coin');
        coin.setScale(0.03); // Smaller than player
        coin.body.setAllowGravity(false);
        coin.body.setSize(30, 30); // Fixed size for reliable collision

        // Coin animation (bobbing)
        this.tweens.add({
            targets: coin,
            y: y - 5,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Update next spawn position
        this.nextCoinX += 150 + Phaser.Math.Between(-30, 30);
    }

    collectCoin(player, coin) {
        coin.destroy();

        this.score += 10;
        this.coinsCollected++;
        this.updateUI();

        // Play coin sound
        this.playCoinSound();

        // Coin sparkle effect
        const sparkle = this.add.circle(coin.x, coin.y, 12, 0xFFFF00, 0.8);
        this.tweens.add({
            targets: sparkle,
            alpha: 0,
            scale: 2,
            duration: 300,
            onComplete: () => sparkle.destroy()
        });
    }

    // === DRAGON ENEMY SYSTEM ===
    spawnDragon() {
        // Play dragon sound
        this.playDragonSound();

        // Spawn dragon ahead of player
        const x = this.player.x + 400;
        const y = 140;

        // Create dragon using sprite
        const dragon = this.dragons.create(x, y, 'dragon');
        dragon.setScale(0.08); // Reduced from 0.15 to make it narrower
        dragon.body.setAllowGravity(true);
        dragon.body.setSize(dragon.width * 0.8, dragon.height * 0.8);
        dragon.setBounce(0);
        dragon.setCollideWorldBounds(true);

        // Add collision with ground
        this.physics.add.collider(dragon, this.groundLayer);

        // Dragon AI properties
        dragon.health = 2 + Math.floor(this.difficultyLevel / 3);
        dragon.speed = 30 + (this.difficultyLevel * 5);
        dragon.direction = -1; // Start moving left
        dragon.patrolDistance = 200;
        dragon.startX = x;
    }

    updateDragon(dragon) {
        // Patrol back and forth
        dragon.setVelocityX(dragon.speed * dragon.direction);

        // Turn around at patrol limits
        if (dragon.direction === -1 && dragon.x <= dragon.startX - dragon.patrolDistance) {
            dragon.direction = 1;
            dragon.flipX = true;
        } else if (dragon.direction === 1 && dragon.x >= dragon.startX + dragon.patrolDistance) {
            dragon.direction = -1;
            dragon.flipX = false;
        }
    }

    dragonShootFire(dragon) {
        // Create fire projectile
        const fire = this.fireProjectiles.create(dragon.x, dragon.y, 'fire');
        fire.setScale(0.1); // Adjust scale as needed
        fire.body.setAllowGravity(false);
        fire.body.setSize(fire.width * 0.8, fire.height * 0.8);
        fire.setVelocityX(dragon.direction * -150); // Shoot towards player

        // Destroy fire after 3 seconds
        this.time.delayedCall(3000, () => {
            if (fire.active) fire.destroy();
        });
    }

    hitByDragon(player, dragon) {
        this.takeDamage(1);
    }

    hitByFire(player, fire) {
        fire.destroy();
        this.takeDamage(1);
    }

    attackDragon(dragon) {
        if (!dragon.isBeingHit) {
            dragon.isBeingHit = true;
            dragon.health--;

            // Flash effect
            dragon.setTint(0xFF0000);
            this.time.delayedCall(100, () => {
                dragon.clearTint();
                dragon.isBeingHit = false;
            });

            // Destroy if health depleted
            if (dragon.health <= 0) {
                dragon.destroy();
                this.dragonsDefeated++;
                this.score += 50;
                this.updateUI();
            }
        }
    }

    // === POWER-UP SYSTEM ===
    spawnPowerUp() {
        // Spawn power-up ahead of player
        const x = this.player.x + 300;
        const y = 140;

        // Create chicken leg power-up (health restore)
        const powerUp = this.powerUps.create(x, y, 'powerup-health');
        powerUp.setScale(0.05); // Adjust scale as needed
        powerUp.body.setAllowGravity(false);
        powerUp.body.setSize(powerUp.width * 0.04, powerUp.height * 0.03);
        powerUp.powerUpType = 'health';

        // Bobbing animation
        this.tweens.add({
            targets: powerUp,
            y: y - 10,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    collectPowerUp(player, powerUp) {
        if (powerUp.powerUpType === 'health') {
            // Restore 1 heart
            if (this.playerHealth < this.maxHealth) {
                this.playerHealth++;
                this.updateUI();

                // Heal effect
                const healText = this.add.text(powerUp.x, powerUp.y - 20, '+1 ❤️', {
                    fontSize: '16px',
                    color: '#00FF00'
                });
                this.tweens.add({
                    targets: healText,
                    y: healText.y - 30,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => healText.destroy()
                });
            }
        }

        powerUp.destroy();
    }

    // === HEALTH SYSTEM ===
    takeDamage(amount = 1) {
        if (this.isInvincible) return;

        this.playerHealth -= amount;
        this.updateUI();

        if (this.playerHealth <= 0) {
            this.playerDeath();
            return;
        }

        // Invincibility frames
        this.isInvincible = true;

        // Flash effect
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 10,
            onComplete: () => {
                this.player.alpha = 1;
                this.isInvincible = false;
            }
        });
    }

    playerDeath() {
        this.playerHealth = 0;
        this.updateUI();

        // Death animation
        this.player.setVelocity(0, -200);
        this.player.setTint(0x000000);

        this.time.delayedCall(1000, () => {
            this.showGameOver();
        });
    }

    showGameOver() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Game over overlay
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setScrollFactor(0);

        const gameOverText = this.add.text(width / 2, height / 2 - 20, 'GAME OVER', {
            fontSize: '32px',
            color: '#ff0000',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0);

        const scoreText = this.add.text(width / 2, height / 2 + 20, `Score: ${this.score}`, {
            fontSize: '16px',
            color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0);

        const restartText = this.add.text(width / 2, height / 2 + 50, 'Press R to Restart', {
            fontSize: '14px',
            color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0);

        // Restart on R key
        this.input.keyboard.once('keydown-R', () => {
            this.scene.restart();
        });
    }

    // === UI SYSTEM ===
    createUI() {
        // Health hearts
        this.hearts = [];
        for (let i = 0; i < this.maxHealth; i++) {
            const heart = this.add.text(10 + (i * 25), 10, '❤️', {
                fontSize: '20px'
            }).setScrollFactor(0);
            this.hearts.push(heart);
        }

        // Score display
        this.scoreText = this.add.text(250, 10, 'Score: 0', {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 8, y: 4 }
        }).setScrollFactor(0);
    }

    updateUI() {
        // Update hearts
        for (let i = 0; i < this.maxHealth; i++) {
            if (i < this.playerHealth) {
                this.hearts[i].setText('❤️');
            } else {
                this.hearts[i].setText('🖤');
            }
        }

        // Update score
        this.scoreText.setText(`Score: ${this.score}`);
    }
}

// ============================================================================
// GAME CONFIGURATION
// ============================================================================

const config = {
    type: Phaser.AUTO,
    width: 320,
    height: 180,
    parent: 'game-container',
    pixelArt: true,
    zoom: 3,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 },
            debug: false
        }
    },
    scene: [BootScene, GameScene]
};

// Start the game
const game = new Phaser.Game(config);
