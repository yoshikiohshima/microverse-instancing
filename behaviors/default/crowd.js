class CrowdActor {
    setup() {
        this._cardData.dimension = 32;
    }
}

class CrowdPawn {
    setup() {
        let dim = this.actor._cardData.dimension;
        this.posArray = [...Array(dim * dim).keys()].map((i) => [i % dim, Math.floor(i / dim), 0]);
        this.createMesh(dim);

        this.addEventListener("pointerMove", "pointerMove");
        this.addEventListener("pointerDown", "pointerDown");
        this.addEventListener("pointerUp", "pointerUp");
    }

    createMesh(dim) {
        let all = dim * dim;

        let {THREE} = Microverse;

        if (this.plane) {
            this.plane.dispose();
        }

        if (this.material) {
            this.material.dispose();
        }

        if (this.mesh) {
            this.mesh.removeFromParent();
            this.mesh.dispose();
        }

        if (this.tileTexutre) {
            this.tileTexture.dispose();
        }

        this.plane = new THREE.PlaneGeometry(1, 1);

        /*
        let uvOffset = new Float32Array(12 * 2);
        for (let i = 0; i < 12 * 2; i += 2) {
            uvOffset[i] = 1;
            uvOffset[i + 1] = 1;
        }

        this.plane.setAttribute("uvOffset", new THREE.BufferAttribute(uvOffset, 2));

        */

        let loader = new THREE.TextureLoader();

        loader.load("assets/images/bar.png", (texture) => {
            this.tileTexture = texture;

            this.material = new THREE.MeshStandardMaterial( { map: this.tileTexture, side: THREE.FrontSide} );

            /*
            this.material = new THREE.MeshStandardMaterial({
                map: this.tileTexture,
                uniforms: {
                    uvOffset: [1],
                },
            });
            */
            this.material.onBeforeCompile = (shader) => {
                let vertexShader = shader.vertexShader.replace(
                    "}",
                    `	vMapUv = (vMapUv / float(${dim})) + vec2(gl_InstanceID % ${dim}, gl_InstanceID / ${dim}) / float(${dim});
}`);
                shader.vertexShader = vertexShader;
            };

            this.mesh = new THREE.InstancedMesh(this.plane, this.material, all);

            console.log(all);

            let m = new THREE.Matrix4();
            for (let i = 0; i < dim * dim; i++) {
                this.mesh.setColorAt(i, new THREE.Color(this.randomColor()));
                m.setPosition(new THREE.Vector3(i % dim, Math.floor(i / dim), 0));
                this.mesh.setMatrixAt(i, m);
            }

            this.mesh.count = all;
            this.shape.add(this.mesh);

            // this.move();
        });
    }

    randomColor() {
        let h = Math.random();
        let s = 0.8;
        let v = 0.8;
        let r, g, b, i, f, p, q, t;
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return ((Math.round(r * 255) << 16) +
                (Math.round(g * 255) << 8) +
                Math.round(b * 255));
    }

    move() {
        let {THREE} = Microverse;
        let dim = this.actor._cardData.dimension;

        if (this.interval) {
            clearInterval(this.interval);
        }

        this.steps = 0;

        let mover = () => {
            let dir = 1;
            this.steps++;
            if (this.steps > 100) {
                dir = -1;
            }
            if (this.steps > 200) {
                this.steps = 0;
            }
            let m = new THREE.Matrix4();
            for (let i = 0; i < dim * dim; i++) {
                let pos = this.posArray[i];
                let x = i % dim;
                let y = Math.floor(i / dim);
                pos[0] += 0.001 * dir * x;
                pos[1] += 0.001 * dir * y;
                m.setPosition(new THREE.Vector3(pos[0], pos[1], 0));
                this.mesh.setMatrixAt(i, m);
            }
            this.mesh.instanceMatrix.needsUpdate = true;
        };
        this.interval = setInterval(mover, 16);
    }

    pointerDown(evt) {
        if (!evt.xyz) {return;}
        if (evt.instanceId === undefined) {return;}
        let {THREE} = Microverse;

        // let normal = [q_pitch(this.rotation), q_yaw(this.rotation), q_roll(this.rotation)];
        let normal = [0, 0, 1];

        this._dragPlane = new THREE.Plane();
        this._dragPlane.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(...normal),
            new THREE.Vector3(...evt.xyz)
        );

        this.downInfo = {translation: this.posArray[evt.instanceId], downPosition: evt.xyz, instanceId: evt.instanceId};
        let avatar = this.getMyAvatar();
        if (avatar) {
            avatar.addFirstResponder("pointerMove", {}, this);
        }
    }

    pointerMove(evt) {
        if (!this.downInfo) {return;}
        if (!evt.ray) {return;}

        let {THREE, v3_add, v3_sub} = Microverse;
        let origin = new THREE.Vector3(...evt.ray.origin);
        let direction = new THREE.Vector3(...evt.ray.direction);
        let ray = new THREE.Ray(origin, direction);

        let dragPoint = ray.intersectPlane(
            this._dragPlane,
            new Microverse.THREE.Vector3()
        );

        let down = this.downInfo.downPosition;
        let drag = dragPoint.toArray();

        let diff = v3_sub(drag, down);
        let newPos = v3_add(this.downInfo.translation, diff);

        let instanceId = this.downInfo.instanceId;
        this.posArray[instanceId] = newPos;
        let m = new THREE.Matrix4();
        m.setPosition(new THREE.Vector3(...newPos));
        this.mesh.setMatrixAt(instanceId, m);
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    pointerUp(_evt) {
        this._dragPlane = null;
        let avatar = this.getMyAvatar();
        if (avatar) {
            avatar.removeFirstResponder("pointerMove", {}, this);
        }
    }
}

export default {
    modules: [
        {
            name: "Crowd",
            actorBehaviors: [CrowdActor],
            pawnBehaviors: [CrowdPawn],
        }
    ]
}

/* globals Microverse */
