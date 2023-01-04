
import * as THREE from 'three';

import { ParametricGeometry } from './three_r148/ParametricGeometry.js';
import Stats from './three_r148/stats.module.js';
import { OrbitControls } from './three_r148/OrbitControls.js';

import{ WindyCloth } from './WindyCloth.js';


class Main {

    constructor() {
        
    }

    static init() {

        const wind_params = {
            DAMPING: 0.03,
            DRAG: 1 - 0.03, //1 - DAMPING
            MASS: 0.1,
            restDistance: 25,
            xSegs: 15,
            ySegs: 10,
            VELOCITY: 1000,
            windForce: new THREE.Vector3(0, 0, 0),
            tmpForce: new THREE.Vector3(),
            windEnabled: true,
            TIMESTEP: 0.000324, // (18 / 1000) * (18 / 1000)
            pinSide: 'left' // top. right, bottom or left
        };

        this.cloth = new WindyCloth(wind_params);

        this.container;
        this.stats;
        this.camera;
        this.scene;
        this.renderer;
        this.sphere;
        this.flagMesh;
        this.flagPoleMesh;
        this.flagPoleTopMesh;

        this.container = document.createElement('div');
        this.container.setAttribute('id', 'main_view');
        document.body.appendChild(this.container);

        // scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x07074d);
        this.scene.fog = new THREE.Fog(0x07074d, 500, 10000);

        // camera
        this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 1, 10000);
        this.camera.position.set(0, -100, 3500);
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));

        // lights
        // DirectionalLight makes far better shadows than SpotLight
        const light = new THREE.DirectionalLight(0xdfebff, 1);

        light.position.set(-150, 550, 1000);
        light.position.multiplyScalar(1.3);
        light.castShadow = true;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;

        const d = 2000;

        light.shadow.camera.left = -d;
        light.shadow.camera.right = d;
        light.shadow.camera.top = d;
        light.shadow.camera.bottom = -d;
        light.shadow.camera.far = 4000;

        this.scene.add(light);

        // START FLAG
        // cloth material
        const loader = new THREE.TextureLoader();

        const clothTexture = loader.load('textures/welsh.jpg');
        clothTexture.anisotropy = 16;

        const clothMaterial = new THREE.MeshLambertMaterial({
            map: clothTexture,
            side: THREE.DoubleSide,
            alphaTest: 0
        });

        // cloth mesh
        this.flagMesh = new THREE.Mesh(this.cloth.geometry, clothMaterial);
        this.flagMesh.position.set(0, 110, 0);
        this.flagMesh.castShadow = true;

        // gives it the light depth variations
        this.flagMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            map: clothTexture,
            alphaTest: 0
        });

        this.scene.add(this.flagMesh);
        // END FLAG

        // ground
        const groundTexture = loader.load('./textures/grasslight-big.jpg');

        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(25, 25);
        groundTexture.anisotropy = 16;
        groundTexture.encoding = THREE.sRGBEncoding;

        const groundMaterial = new THREE.MeshLambertMaterial({map: groundTexture});

        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), groundMaterial);
        mesh.position.y = -250;
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;

        this.scene.add(mesh);

        // flag pole and parts
        // flag pole
        const reflectiveMat = new THREE.MeshStandardMaterial({color: 0xe5e6ff, roughness: 0.1, metalness: 1.0});
        // pole
        const poleGeo = new THREE.CylinderGeometry(10, 10, 750, 10);

        const flagPoleMesh = new THREE.Mesh(poleGeo, reflectiveMat);
        flagPoleMesh.position.x = -200;
        flagPoleMesh.position.y = 125;
        flagPoleMesh.receiveShadow = true;
        flagPoleMesh.castShadow = true;

        this.scene.add(flagPoleMesh);

        // round top
        const poleTopGeo = new THREE.SphereGeometry(15, 16, 16);
        const flagPoleTopMesh = new THREE.Mesh(poleTopGeo, reflectiveMat);
        flagPoleTopMesh.position.x = -200;
        flagPoleTopMesh.position.y = 500;
        flagPoleTopMesh.receiveShadow = true;
        flagPoleTopMesh.castShadow = true;

        this.scene.add(flagPoleTopMesh);
        // end flag pole and parts

        // renderer
        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;

        this.container.appendChild(this.renderer.domElement);

        // controls
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.maxPolarAngle = Math.PI;
        controls.minDistance = 1000;
        controls.maxDistance = 5000;

        // performance monitor
        this.stats = new Stats();
        this.stats.domElement.style.cssText = 'position:absolute;top:0px;right:0px;';

        this.container.appendChild(this.stats.dom);

        this.animate(0);
    }

    static animate(now) {
        window.requestAnimationFrame(this.animate.bind(this));
        this.cloth.simulate(now);
        this.render();
        this.stats.update();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    initResizeListener() {
        window.addEventListener('resize', this.onWindowResize, false);
    }

    static render() {
        const p = this.cloth.particles;
        for (let i = 0, il = p.length; i < il; i++) {
            const v = p[ i ].position;
            this.cloth.geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
        }
        this.cloth.geometry.attributes.position.needsUpdate = true;
        this.cloth.geometry.computeVertexNormals();
        this.renderer.render(this.scene, this.camera);
    }

}

export { Main };