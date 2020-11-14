"use strict";

/*
 * Based on:
 * https://threejs.org/examples/#webgl_animation_cloth
 * Cloth Simulation using a relaxed constraints solver
 */

// Suggested Readings
// Advanced Character Physics by Thomas Jakobsen Character
// https://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf
// http://en.wikipedia.org/wiki/Cloth_modeling
// http://cg.alexandra.dk/tag/spring-mass-system/
// Real-time Cloth Animation http://www.darwin3d.com/gamedev/articles/col0599.pdf

import * as THREE from './three/build/three.module.min.js';

class Particle {
    constructor(x, y, z, params, cloth) {
        this.params = params;
        this.position = new THREE.Vector3();
        this.previous = new THREE.Vector3();
        this.original = new THREE.Vector3();
        this.a = new THREE.Vector3(0, 0, 0); // acceleration
        this.mass = params.MASS;
        this.invMass = 1 / params.MASS;
        this.tmp = new THREE.Vector3();
        this.tmp2 = new THREE.Vector3();

        // init
        cloth.clothPlaneFunction(x, y, this.position); // position
        cloth.clothPlaneFunction(x, y, this.previous); // previous
        cloth.clothPlaneFunction(x, y, this.original);
    }
    addForce(force) {
        this.a.add(
                this.tmp2.copy(force).multiplyScalar(this.invMass)
                );
    }
    integrate(timesq) {
        const newPos = this.tmp.subVectors(this.position, this.previous);
        newPos.multiplyScalar(this.params.DRAG).add(this.position);
        newPos.add(this.a.multiplyScalar(timesq));

        this.tmp = this.previous;
        this.previous = this.position;
        this.position = newPos;

        this.a.set(0, 0, 0);
    }
}

class WindyCloth {

    constructor(params) {
        this.params = params;

        const w = params.xSegs || 10;
        const h = params.ySegs || 10;
        this.w = w;
        this.h = h;
        this.pinsTop = [];
        this.pinsRight = [];
        this.pinsBottom = [];
        this.pinsLeft = [];
        this.particles = [];
        this.diff = new THREE.Vector3();

        // ((x)-left/right, (y)up/-down, (z)front/-back)
        this.velocity = new THREE.Vector3(params.VELOCITY, 0, 0).multiplyScalar(params.MASS);

        const cloth_width = params.restDistance * params.xSegs;
        const cloth_height = params.restDistance * params.ySegs;

        this.clothPlaneFunction = function (u, v, target) {
            const x = (u - 0.5) * cloth_width;
            const y = (v + 0.5) * cloth_height;
            const z = 0;
            target.set(x, y, z);
        };

        this.geometry = new THREE.ParametricBufferGeometry(this.clothPlaneFunction, this.w, this.h);

        const particles = [];
        const constraints = [];

        // Create particles and static sides
        for (let v = 0; v <= h; v++) {
            for (let u = 0; u <= w; u++) {

                if (v === 0) {
                    this.pinsBottom.push(u);
                }
                if (u === w) {
                    this.pinsRight.push(particles.length);
                }
                if (v === h) {
                    this.pinsTop.push(particles.length);
                }
                if (u === 0) {
                    this.pinsLeft.push(particles.length);
                }

                particles.push(
                        new Particle(u / w, v / h, 0, params, this)
                        );
            }
        }

        switch (params.pinSide) {
            case 'top':
                this.pins = this.pinsTop;
                break;
            case 'right':
                this.pins = this.pinsRight;
                break;
            case 'bottom':
                this.pins = this.pinsBottom;
                break;
            case 'left':
                this.pins = this.pinsLeft;
                break;
        }

        // Structural
        for (let v = 0; v < h; v++) {
            for (let u = 0; u < w; u++) {
                constraints.push([
                    particles[ index(u, v) ],
                    particles[ index(u, v + 1) ],
                    params.restDistance
                ]);
                constraints.push([
                    particles[ index(u, v) ],
                    particles[ index(u + 1, v) ],
                    params.restDistance
                ]);
            }
        }

        for (let u = w, v = 0; v < h; v++) {
            constraints.push([
                particles[ index(u, v) ],
                particles[ index(u, v + 1) ],
                params.restDistance

            ]);
        }

        for (let v = h, u = 0; u < w; u++) {
            constraints.push([
                particles[ index(u, v) ],
                particles[ index(u + 1, v) ],
                params.restDistance
            ]);
        }

        this.particles = particles;
        this.constraints = constraints;

        function index(u, v) {
            return u + v * (w + 1);
        }
        this.index = index;
    }

    satisfyConstraints(p1, p2, distance) {
        this.diff.subVectors(p2.position, p1.position);
        const currentDist = this.diff.length();
        if (currentDist === 0)
            return; // prevents division by 0
        const correction = this.diff.multiplyScalar(1 - distance / currentDist);
        const correctionHalf = correction.multiplyScalar(0.5);
        p1.position.add(correctionHalf);
        p2.position.sub(correctionHalf);
    }

    simulate(now) {

        const windStrength = Math.cos(now / 7000) * 20 + 40;

        this.params.windForce.set(Math.sin(now / 2000), Math.cos(now / 3000), Math.sin(now / 1000));
        this.params.windForce.normalize();
        this.params.windForce.multiplyScalar(windStrength);

        // Aerodynamics forces
        const particles = this.particles;

        if (this.params.windEnabled) {
            let indx;
            const normal = new THREE.Vector3();
            const indices = this.geometry.index;
            const normals = this.geometry.attributes.normal;

            for (let i = 0, il = indices.count; i < il; i += 3) {
                for (let j = 0; j < 3; j++) {
                    indx = indices.getX(i + j);
                    normal.fromBufferAttribute(normals, indx);
                    this.params.tmpForce.copy(normal).normalize().multiplyScalar(normal.dot(this.params.windForce));
                    particles[ indx ].addForce(this.params.tmpForce);

                }
            }
        }

        for (let i = 0, il = particles.length; i < il; i++) {
            const particle = particles[ i ];
            particle.addForce(this.velocity);
            particle.integrate(this.params.TIMESTEP, this.params);
        }

        // Start Constraints
        const constraints = this.constraints;
        const il = constraints.length;

        for (let i = 0; i < il; i++) {
            const constraint = constraints[ i ];
            this.satisfyConstraints(constraint[ 0 ], constraint[ 1 ], constraint[ 2 ]);
        }

        // Floor Constraints
        for (let i = 0, il = particles.length; i < il; i++) {
            const particle = particles[ i ];
            const pos = particle.position;
            if (pos.y < -250) {
                pos.y = -250;
            }
        }

        // Pin Constraints
        for (let i = 0, il = this.pins.length; i < il; i++) {
            const xy = this.pins[ i ];
            const p = particles[ xy ];
            p.position.copy(p.original);
            p.previous.copy(p.original);
        }
    }
}


export { WindyCloth };