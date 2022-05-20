import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

import {Shape_From_File} from "./examples/obj-file-demo.js";

const arena_size = 40;
const arena_height = 40;

const BLOCK_SIZE = 6;         // block size
const GROUND = -7.8;          // z value of ground
const BH = GROUND+BLOCK_SIZE; // z value of blocking center

const blocking_pos = {
    stacking: [vec4(30, BH, -80, 1), vec4(30, BH+2*BLOCK_SIZE, -80, 1), vec4(18, BH, -80, 1),
        vec4(30, BH, -68, 1), vec4(-30, BH, -64, 1), vec4(-30, BH+2*BLOCK_SIZE, -64, 1),
        vec4(0, BH, -80, 1), vec4(-30, BH, -76, 1), vec4(-20, BH, -100, 1)
    ],
    scatter: [vec4(-30, BH, -80, 1), vec4(-60, BH, -70, 1), vec4(30, BH, -80, 1),
        vec4(60, BH, -70, 1), vec4(0, BH, -80, 1), vec4(20, BH, -90, 1),
        vec4(40, BH, -100, 1), vec4(10, BH, -45, 1), vec4(-20, BH, -120, 1)
    ]
}

class Cylinder_Shell extends defs.Surface_Of_Revolution {
    // An alternative without three separate sections
    constructor(rows, columns, texture_range=[[0, 1], [0, 1]]) {
        super(rows, columns, [vec3(0, 0, .5), vec3(1, 0, .5), vec3(1, 0, -.5)], texture_range)
    }
}

class Monster {
    constructor(pos, color, speed, size, phase) {
        this.pos = pos;
        this.color = color;
        this.speed = speed;
        this.phase = phase;
        this.angle = 0;
        this.model = Mat4.identity()
            .times(Mat4.rotation(-0.5 * Math.PI, 1, 0, 0))
            .times(Mat4.scale(size, size, size));
    }
}

class Blocking {
    constructor(pos, texture) {
        this.pos = pos;
        this.texture = texture;
        this.model = Mat4.identity().times(Mat4.translation(pos[0], pos[1], pos[2]))
            .times(Mat4.scale(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE));
        this.up_right = this.model.times(vec4(1, 1, 1, 1));
        this.bottom_left = this.model.times(vec4(-1, -1, -1, 1));
    }
}

export class EscapeCubeMain extends Scene {
    constructor() {
        super();

        this.shapes = {
            torus: new defs.Torus(15, 15),
            wall: new defs.Cube(),
            floor: new defs.Cube(),
            ceiling: new defs.Cube(),
            arena_wall: new defs.Cube(),
            blocking: new defs.Cube(),
            light: new defs.Subdivision_Sphere(3),
            gun: new Shape_From_File("assets/gun.obj"),
            bullet: new Shape_From_File("assets/45.obj"),
            lantern: new Shape_From_File("assets/sconce.obj"),
            monster: new Shape_From_File("assets/skull.obj"),
            bullet_shell: new Cylinder_Shell(30,30),
        };
        const bump = new defs.Fake_Bump_Map(2);
        this.shapes.floor.arrays.texture_coord.forEach(p => p.scale_by(120));
        this.shapes.ceiling.arrays.texture_coord.forEach(p => p.scale_by(120));
        this.shapes.arena_wall.arrays.texture_coord.forEach(p => p.scale_by(5));

        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: .4, color: hex_color("#412c18")}),
            wall: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.4, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/brick-wall.jpeg", "LINEAR_MIPMAP_LINEAR")
            }),
            floor: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.5, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/floor.jpeg")
            }),
            light: new Material(new defs.Phong_Shader(), {
                ambient: 0.8, diffusivity: 0, specularity: 0,
                color: hex_color("#B5672D"),
            }),
            stone: new Material(new defs.Fake_Bump_Map(1), {
                color: hex_color("#000000"),
                ambient: 0.3, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/stone.jpg")
            }),
            gun: new Material(new defs.Fake_Bump_Map(1), {
                ambient: 0.5, diffusivity: 0.5, specularity: 1,
                color: hex_color("#000000"),
                texture: new Texture("assets/airgun.jpg")
            }),
            bullet: new Material(new defs.Textured_Phong(1), {
                ambient: 0.5, diffusivity: 0.2, specularity: 1,
                color: hex_color("#000000"),
                texture: new Texture("assets/metal_scratches_1.jpg")
            }),
            ceiling: new Material(new defs.Textured_Phong(1), {
                color: hex_color("#000000"),
                ambient: 0.4, diffusivity: 1, specularity: 0.5,
                texture: new Texture("assets/wooden.jpg", "LINEAR_MIPMAP_LINEAR")
            }),
            monster: new Material(new defs.Phong_Shader(), {
                color: hex_color("#720F14"),
                ambient: 0.3, diffusivity: 0.4, specularity: 0.4
            }),
            blocking1: new Material(bump, {
                ambient: 0.5, diffusivity: 0.2, specularity: 1,
                color: hex_color("#000000"),
                texture: new Texture("assets/blocking.jpg")
            }),
            blocking2: new Material(bump, {
                ambient: 0.5, diffusivity: 0.2, specularity: 1,
                color: hex_color("#000000"),
                texture: new Texture("assets/blocking2.jpg")
            })
        };

        this.gunshot_sound = new Audio();
        this.gunshot_sound.src = 'assets/airgun.wav';

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 12), vec3(0, 0, 11), vec3(0, 1, 0));
        this.current_camera_location = this.initial_camera_location;
        this.camera_transform = Mat4.identity();
        this.surface_camera = this.initial_camera_location; // never looks up or down
        this.update = false;
        this.init = false;
        this.died = false;
        this.open_door = false;
        this.start_time = 0;
        this.door_loc = 0;
        this.fire = false;
        this.bullet_loc = [];
        this.bullet_shell_loc_and_vel = [];
        this.time_fired = 0;
        this.monster = [];
        this.elevation_angle = 0.;
        this.gun_transform = Mat4.identity();
        this.monster_loc = [];
        this.blocking = [];
        this.hitbox = [
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
            {up_right: vec4(1, 1, 1, 1), bottom_left: vec4(-1, -1, -1, 1)},
        ];
    }

    check_if_out_of_bound(lookat, inverse){
        const eye_pos = lookat.times(vec4(0,0,0,1));
        let up_right = Mat4.inverse(inverse).times(this.gun_transform).times(vec4(5,1,-1,1));
        let bottom_left = Mat4.inverse(inverse).times(this.gun_transform).times(vec4(-5,-1,1,1));
        // check if hit boundary
        for (let idx in this.hitbox) {
            let body = this.hitbox[idx];
            if (this.check_if_collide(body.up_right, body.bottom_left, eye_pos, 1.5) ||
                this.intersect_aabb_vs_aabb(body.up_right, body.bottom_left, up_right, bottom_left)){
                return true;
            }
        }
        // check if hit blocking
        for (let idx in this.blocking) {
            let block = this.blocking[idx];
            if (this.check_if_collide(block.up_right, block.bottom_left, eye_pos, 1.5) ||
                this.intersect_aabb_vs_aabb(block.up_right, block.bottom_left, up_right, bottom_left)){
                return true;
            }
        }
        return false;
    }

    intersect_aabb_vs_aabb(a_up_right, a_bottom_left, b_up_right, b_bottom_left){
        return (a_bottom_left[0] <= b_up_right[0] && a_up_right[0] >= b_bottom_left[0]) &&
            (a_bottom_left[1] <= b_up_right[1] && a_up_right[1] >= b_bottom_left[1]) &&
            (a_bottom_left[2] <= b_up_right[2] && a_up_right[2] >= b_bottom_left[2]);
    }

    intersect_aabb_vs_sphere(box_up_right, box_bottom_left, sphere_coord, radius){
        //https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_collision_detection
        let x = Math.max(box_bottom_left[0], Math.min(sphere_coord[0], box_up_right[0]));
        let y = Math.max(box_bottom_left[1], Math.min(sphere_coord[1], box_up_right[1]));
        let z = Math.max(box_bottom_left[2], Math.min(sphere_coord[2], box_up_right[2]));

        let dist = vec3(x,y,z).minus(sphere_coord.to3()).norm();
        return dist < radius;
    }

    check_if_collide(a_up_right, a_bottom_left, b_coord, R){
        // collision detection
        // simplest for a spherical collider
        return this.intersect_aabb_vs_sphere(a_up_right, a_bottom_left, b_coord, R);
    }

    check_if_monster_hit_block(a_up_right, a_bottom_left) {
        for (let idx in this.blocking) {
            let block = this.blocking[idx];
            if (this.intersect_aabb_vs_aabb(a_up_right, a_bottom_left, block.up_right, block.bottom_left)) {
                return true;
            }
        }
        return false;
    }

    make_control_panel() {
        this.key_triggered_button("forward", ["w"], () => {
            this.camera_transform.post_multiply(Mat4.translation(0,0,-1));
            this.surface_camera.pre_multiply(Mat4.translation(0,0,1));
            let new_cam = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            if (this.check_if_out_of_bound(this.camera_transform, new_cam)){
                this.camera_transform.post_multiply(Mat4.translation(0,0,1));
                this.surface_camera.pre_multiply(Mat4.translation(0,0,-1));
            }else{
                this.current_camera_location = new_cam;
            }
            this.update = true;
        }, undefined, () => {this.update = false;});

        this.key_triggered_button("backward", ["s"], () => {
            this.camera_transform.post_multiply(Mat4.translation(0,0,1));
            this.surface_camera.pre_multiply(Mat4.translation(0,0,-1));
            let new_cam = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            if (this.check_if_out_of_bound(this.camera_transform, new_cam)){
                this.camera_transform.post_multiply(Mat4.translation(0,0,-1));
                this.surface_camera.pre_multiply(Mat4.translation(0,0,1));
            }else{
                this.current_camera_location = new_cam;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("left", ["a"], () => {
            this.camera_transform.post_multiply(Mat4.translation(-1,0,0));
            this.surface_camera.pre_multiply(Mat4.translation(1,0,0));
            let new_cam = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            if (this.check_if_out_of_bound(this.camera_transform, new_cam)){
                this.camera_transform.post_multiply(Mat4.translation(1,0,0));
                this.surface_camera.pre_multiply(Mat4.translation(-1,0,0));
            }else{
                this.current_camera_location = new_cam;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("right", ["d"], () => {
            this.camera_transform.post_multiply(Mat4.translation(1,0,0));
            this.surface_camera.pre_multiply(Mat4.translation(-1,0,0));
            let new_cam = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            if (this.check_if_out_of_bound(this.camera_transform, new_cam)){
                this.camera_transform.post_multiply(Mat4.translation(-1,0,0));
                this.surface_camera.pre_multiply(Mat4.translation(1,0,0));
            }else{
                this.current_camera_location = new_cam;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("rotate left", ["q"], () => {
            this.camera_transform.post_multiply(Mat4.rotation(0.1, 0, 1, 0));
            this.surface_camera.pre_multiply(Mat4.rotation(-0.1, 0, 1, 0));
            let new_cam = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            if (this.check_if_out_of_bound(this.camera_transform, new_cam)){
                this.camera_transform.post_multiply(Mat4.rotation(-0.1, 0, 1, 0));
                this.surface_camera.pre_multiply(Mat4.rotation(0.1, 0, 1, 0));
            }else{
                this.current_camera_location = new_cam;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("rotate right", ["e"], () => {
            this.camera_transform.post_multiply(Mat4.rotation(-0.1, 0, 1, 0));
            this.surface_camera.pre_multiply(Mat4.rotation(0.1, 0, 1, 0));
            let new_cam = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            if (this.check_if_out_of_bound(this.camera_transform, new_cam)){
                this.camera_transform.post_multiply(Mat4.rotation(0.1, 0, 1, 0));
                this.surface_camera.pre_multiply(Mat4.rotation(-0.1, 0, 1, 0));
            }else{
                this.current_camera_location = new_cam;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("look up", ["r"], () => {
            if (this.elevation_angle < -Math.PI / 2.) return;
            this.elevation_angle -= 0.04;
            this.current_camera_location = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("look down", ["f"], () => {
            if (this.elevation_angle > Math.PI / 2.) return;
            this.elevation_angle += 0.04;
            this.current_camera_location = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("shoot bullet", [" "], ()=>{this.fire = true},
            undefined, () => {this.fire = false});
    }

    bullet_drop_dynamic(prev_pos, prev_v, decay=0.7, ground = -6.0){
        if(prev_v[0]**2 + prev_v[1]**2 + prev_v[2]**2 < 0.000004) return null;
        let next_pos = prev_pos;
        let next_v = prev_v;
        next_pos[0] += prev_v[0];
        next_pos[1] += prev_v[1];
        next_pos[2] += prev_v[2];
        next_v[1] -= 9.8 * 0.001;
        if(next_pos[1] <= ground){
            next_v[1] = -decay*next_v[1];
            next_v[2] = decay*next_v[2];
            next_v[0] = decay*next_v[0];
        }
        return {
            next_pos: next_pos,
            next_v: next_v,
        }
    }

    init_blocking(init_num, type) {
        // type: 0 => stacking
        // type: 1 => scatter
        // type: 2 => random
        switch (type) {
            case 0:
                blocking_pos["stacking"].forEach((item, index) => {
                    let block = new Blocking(item, 1);
                    this.blocking.push(block);
                })
                break;
            case 1:
                blocking_pos["scatter"].forEach((item, index) => {
                    // console.log(item[0], item[2]);
                    let block = new Blocking(item, 1);
                    this.blocking.push(block);
                })
                break;
            case 2:
                for (let i = 0; i < init_num; i++) {
                    let x = (Math.random() - 0.5) * 4 * (arena_size * 0.8);
                    let z = - (Math.random() * 4) * (arena_size * 0.75) - 40;
                    let block = new Blocking(vec4(x, 0.5, z, 1), 1);
                    block.model = block.model.times(Mat4.scale(1,1.5,1));
                    this.blocking.push(block);
                }
                break;
        }
    }

    check_legal_spawn(x, z, size) {
        let num_blocking = this.blocking.length;

        for (let i = 0; i < num_blocking; i++) {
            if ((x < this.blocking[i].pos[0] + BLOCK_SIZE + size
                    && x > this.blocking[i].pos[0] - BLOCK_SIZE - size)
                || (z < this.blocking[i].pos[2] + BLOCK_SIZE + size
                    && z > this.blocking[i].pos[2] - BLOCK_SIZE - size))
                return false;
        }
        return true
    }

    // TODO: initialize monster position
    init_monster(init_num) {
        const possible_color = [hex_color("#941619"), hex_color("#3e3237"), hex_color("#4b61b9")];
        const possible_speed = [0.07, 0.05, 0.03];
        const possible_size = [1.5, 2, 2.5];

        for (let i = 0; i < init_num; i++) {
            let x = (Math.random() - 0.5) * 4 * (arena_size * 0.8);
            let z = - (Math.random() * 4) * (arena_size * 0.75) - 40;

            let type = Math.floor(Math.random() * 3);
            if (!this.check_legal_spawn(x, z, possible_size[type])) {
                i--;
                continue;
            }
            let monster = new Monster(vec4(x, 0, z, 1), possible_color[type], possible_speed[type], possible_size[type], Math.random() * Math.PI);
            this.monster.push(monster);
            this.monster_loc.push({up_right: vec4(1,1,1,1), bottom_left: vec4(-1,-1,-1,1)});
        }
    }


    draw_monster(context, program_state, t, idx) {
        let eye_loc = program_state.camera_transform.times(vec4(0,0,0,1));
        // check if hit a box

        let model, up_right, bottom_left;
        model = Mat4.translation(...this.monster[idx].pos.to3())
            .times(Mat4.rotation(this.monster[idx].angle,0,1,0))
            .times(Mat4.translation(0, 1.5 * Math.sin(2 * t + this.monster[idx].phase), 0))
            .times(this.monster[idx].model);

        up_right = model.times(vec4(1,1,1,1));
        bottom_left = model.times(vec4(-1,-1,-1,1));
        if (eye_loc[2] <= -23) {
            let x_diff = this.monster[idx].pos[0] - eye_loc[0];
            let z_diff = this.monster[idx].pos[2] - eye_loc[2];
            let angle = 0;
            let dist = Math.sqrt(x_diff * x_diff + z_diff * z_diff);

            if (x_diff > 0 && z_diff > 0)
                angle = Math.atan(x_diff / z_diff) - Math.PI;
            else if (x_diff < 0 && z_diff > 0)
                angle = Math.atan(x_diff / z_diff) + Math.PI;
            else
                angle = Math.atan(x_diff / z_diff);
            this.monster[idx].pos = vec4(this.monster[idx].pos[0] - x_diff / dist * this.monster[idx].speed, this.monster[idx].pos[1], this.monster[idx].pos[2] - z_diff / dist * this.monster[idx].speed, 1);
            this.monster[idx].angle = angle;
            model = Mat4.translation(...this.monster[idx].pos.to3())
                .times(Mat4.rotation(this.monster[idx].angle,0,1,0))
                .times(Mat4.translation(0, 1.5 * Math.sin(2 * t + this.monster[idx].phase), 0))
                .times(this.monster[idx].model);

            up_right = model.times(vec4(1,1,1,1));
            bottom_left = model.times(vec4(-1,-1,-1,1));
            up_right = vec4(Math.max(up_right[0], bottom_left[0]),Math.max(up_right[1], bottom_left[1]),Math.max(up_right[2], bottom_left[2]),1);
            bottom_left = vec4(Math.min(up_right[0], bottom_left[0]),Math.min(up_right[1], bottom_left[1]),Math.min(up_right[2], bottom_left[2]),1)
            let overlap = false;
            for(let i in this.monster_loc){
                if(i !== idx && this.intersect_aabb_vs_aabb(this.monster_loc[i].up_right, this.monster_loc[i].bottom_left, up_right, bottom_left)){
                    overlap = true;
                    break;
                }
            }
            if (this.check_if_monster_hit_block(up_right, bottom_left) && !overlap) {
                this.monster[idx].pos = vec4(this.monster[idx].pos[0] + x_diff / dist * this.monster[idx].speed, this.monster[idx].pos[1], this.monster[idx].pos[2] + z_diff / dist * this.monster[idx].speed, 1);
                model = model.times(Mat4.translation(x_diff / dist * this.monster[idx].speed, 0, z_diff / dist * this.monster[idx].speed));
                up_right = model.times(vec4(1,1,1,1));
                bottom_left = model.times(vec4(-1,-1,-1,1));
            }
            if (this.check_if_collide(up_right, bottom_left, eye_loc, 1.5)){
                this.died = true;
            }
        }
        this.shapes.monster.draw(context, program_state, model, this.materials.monster.override({color: this.monster[idx].color}));
        this.monster_loc[idx].up_right = vec4(Math.max(up_right[0], bottom_left[0]),Math.max(up_right[1], bottom_left[1]),Math.max(up_right[2], bottom_left[2]),1);
        this.monster_loc[idx].bottom_left = vec4(Math.min(up_right[0], bottom_left[0]),Math.min(up_right[1], bottom_left[1]),Math.min(up_right[2], bottom_left[2]),1);
    }

    draw_blocking(context, program_state, idx) {
        this.shapes.blocking.draw(context, program_state, this.blocking[idx].model,
            this.materials.blocking1);
    }

    display(context, program_state){
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        // if (this.died) {
        //     alert("You died!");
        // }

        if (!this.init) {
            //this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
            this.camera_transform = program_state.camera_transform;

            // init blocking and monster
            this.init_blocking(25, 2);
            this.init_monster(10);
            this.init = true;
        }

        if(this.update){
            program_state.set_camera(this.current_camera_location.map((x,i)=> Vector.from(program_state.camera_inverse[i]).mix(x, 0.1)));
            program_state.camera_transform = this.camera_transform;
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        // ************************************************************************************************
        // common
        // ************************************************************************************************

        // lights
        let redness_1 = 1 + 0.1*Math.sin(3*t) + 0.4*Math.cos(7*t);
        let redness_2 = 1.2 + 0.15*Math.sin(5*t) + 0.4*Math.cos(8.5*t);
        // The parameters of the Light are: position, color, size
        program_state.lights = [
            new Light(vec4(-13.5, 4.5, -8, 1), color(1, redness_1, 0, 1), 40*redness_1)
        ];


        // ************************************************************************************************
        // entry room
        // ************************************************************************************************

        // walls
        let model_transform = Mat4.identity()
            .times(Mat4.translation(-15, 0 ,0))
            .times(Mat4.scale(0.4, 8, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);
        this.hitbox[0].up_right = model_transform.times(vec4(1,1,1,1));
        this.hitbox[0].bottom_left = model_transform.times(vec4(-1,-1,-1,1));

        model_transform = Mat4.identity()
            .times(Mat4.translation(15, 0 ,0))
            .times(Mat4.scale(0.4, 8, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);
        this.hitbox[1].up_right = model_transform.times(vec4(1,1,1,1));
        this.hitbox[1].bottom_left = model_transform.times(vec4(-1,-1,-1,1));

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 0 ,15))
            .times(Mat4.scale(15, 8, 0.4));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);
        this.hitbox[2].up_right = model_transform.times(vec4(1,1,1,1));
        this.hitbox[2].bottom_left = model_transform.times(vec4(-1,-1,-1,1));

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 20 ,0))
            .times(Mat4.scale(1000, 0.4, 1000));
        this.shapes.ceiling.draw(context, program_state, model_transform, this.materials.ceiling);
        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 8 ,0))
            .times(Mat4.scale(15, 0.4, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.ceiling);
        this.hitbox[3].up_right = model_transform.times(vec4(1,1,1,1));
        this.hitbox[3].bottom_left = model_transform.times(vec4(-1,-1,-1,1));

        let front_wall = Mat4.identity()
            .times(Mat4.translation(-17, 0 ,-15))
            .times(Mat4.scale(12, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.wall);
        this.hitbox[4].up_right = front_wall.times(vec4(1,1,1,1));
        this.hitbox[4].bottom_left = front_wall.times(vec4(-1,-1,-1,1));

        // lights
        model_transform = Mat4.identity()
            .times(Mat4.translation(-14, 4, -8))
            .times(Mat4.rotation(0.5*Math.PI, 0, 1, 0))
            .times(Mat4.rotation(-0.5*Math.PI, 1, 0, 0));
        this.shapes.lantern.draw(context, program_state, model_transform, this.materials.test);
        model_transform = Mat4.identity()
            .times(Mat4.translation(-13.5, 5, -8))
            .times(Mat4.scale(0.1, 0.5*redness_1, 0.1));
        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness_1, 0, 1), ambient:redness_1}));

        program_state.lights = [
            new Light(vec4(13.5, 4.5, -8, 1), color(1, redness_2, 0, 1), 30)
        ];
        model_transform = Mat4.identity()
            .times(Mat4.translation(14, 4, -8))
            .times(Mat4.rotation(-0.5*Math.PI, 0, 1, 0))
            .times(Mat4.rotation(-0.5*Math.PI, 1, 0, 0));
        this.shapes.lantern.draw(context, program_state, model_transform, this.materials.test);
        model_transform = Mat4.identity()
            .times(Mat4.translation(13.5, 5, -8))
            .times(Mat4.scale(0.1, 0.5*redness_2, 0.1));
        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness_2, 0, 1), ambient:redness_2}));

        // draw floor of entire scene
        const floor_size = 1000;
        model_transform = Mat4.identity()
            .times(Mat4.translation(0, -8 ,0))
            .times(Mat4.scale(floor_size, 0.4, floor_size));

        this.shapes.floor.draw(context, program_state, model_transform, this.materials.floor);
        this.hitbox[5].up_right = model_transform.times(vec4(1,1,1,1));
        this.hitbox[5].bottom_left = model_transform.times(vec4(-1,-1,-1,1));

        let eye_loc = program_state.camera_transform.times(vec4(0,0,0,1));
        //console.log(eye_loc);

        if(eye_loc[2] < 3.5 && eye_loc[2] > -9.5 && !this.open_door) {
            this.open_door = true;
            this.start_time = t;
        }else if((eye_loc[2] < -11 || eye_loc[2] > 4) && this.open_door) {
            this.open_door = false;
            this.start_time = t;
        }

        if(this.open_door && this.door_loc < 10){
            this.door_loc = Math.min((t-this.start_time)*2, 10);
        }else if(!this.open_door && this.door_loc > 0){
            this.door_loc = Math.max(10-(t-this.start_time)*2, 0);
        }
        front_wall = Mat4.translation(10+this.door_loc, 0, -0.5)
            .times(Mat4.translation(-10, 0 ,-15))
            .times(Mat4.scale(5, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.stone);
        this.hitbox[6].up_right = front_wall.times(vec4(1,1,1,1));
        this.hitbox[6].bottom_left = front_wall.times(vec4(-1,-1,-1,1));

        front_wall = Mat4.identity()
            .times(Mat4.translation(17, 0 ,-15))
            .times(Mat4.scale(12, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.wall);
        this.hitbox[7].up_right = front_wall.times(vec4(1,1,1,1));
        this.hitbox[7].bottom_left = front_wall.times(vec4(-1,-1,-1,1));

        //gun
        let gun = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(1,-0.7,-3+0.3*Math.max(0, 2-t+this.time_fired)))
            .times(Mat4.rotation(-0.5*Math.PI, 0,1,0));
        this.gun_transform = Mat4.identity()
            .times(Mat4.translation(1,-0.7,-3+0.3*Math.max(0, 2-t+this.time_fired)))
            .times(Mat4.rotation(-0.5*Math.PI, 0,1,0));
        // this.gun_hitbox.up_right = gun.times(vec4(5,1,-1,1));
        // this.gun_hitbox.bottom_left = gun.times(vec4(-5,-1,1,1));

        if(this.fire && (t-this.time_fired)>4){
            this.bullet_loc.push(0);
            this.gunshot_sound.play();
            this.time_fired = t;
            this.bullet_shell_loc_and_vel.push({
                trans: Mat4.identity()
                    .times(Mat4.inverse(this.current_camera_location))
                    .times(Mat4.translation(1,-0.7,-3)),
                pos: vec3(0.5,0,0),
                vel: vec3(0.01, 0.002, 0.02),
            });

        }
        this.shapes.gun.draw(context, program_state, gun, this.materials.gun);
        for(let i = 0; i < this.bullet_shell_loc_and_vel.length; i++){
            let bullet_trans = this.bullet_shell_loc_and_vel[i].trans
                .times(Mat4.translation(this.bullet_shell_loc_and_vel[i].pos[0], this.bullet_shell_loc_and_vel[i].pos[1], this.bullet_shell_loc_and_vel[i].pos[2]))
                .times(Mat4.scale(0.1, 0.1, 0.3));
            this.shapes.bullet_shell.draw(context, program_state, bullet_trans, this.materials.bullet);
            let loc_and_vel = this.bullet_drop_dynamic(this.bullet_shell_loc_and_vel[i].pos, this.bullet_shell_loc_and_vel[i].vel);
            if(loc_and_vel){
                this.bullet_shell_loc_and_vel[i].pos = loc_and_vel.next_pos;
                this.bullet_shell_loc_and_vel[i].vel = loc_and_vel.next_v;
            }
        }

        for(let i = 0; i < this.bullet_loc.length; i++){
            this.bullet_loc[i]++;
            let bullet = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(1.85,-1-((this.bullet_loc[i]/1000.0)**2)*0.5*9.8*2,-10.5-this.bullet_loc[i]))
                .times(Mat4.rotation(0.5*Math.PI, 1, 0, 0))
                .times(Mat4.scale(0.15, 0.15, 0.2));
            let loc = bullet.times(vec4(0,0,0,1));
            let collided = false;
            for(let idx in this.monster_loc){
                let up_right = this.monster_loc[idx].up_right;
                let bottom_left = this.monster_loc[idx].bottom_left;
                if(this.check_if_collide(up_right, bottom_left, loc, 0.15)){
                    this.bullet_loc.splice(i,1);
                    this.monster_loc.splice(idx, 1);
                    this.monster.splice(idx, 1);
                    i--;
                    collided = true;
                    break;
                }
            }
            if(!collided){
                if(this.bullet_loc[i] > 30) this.bullet_loc.splice(i,1);
                else this.shapes.bullet.draw(context, program_state, bullet, this.materials.bullet);
            }
        }

        // ************************************************************************************************
        // main arenas
        // ************************************************************************************************
        program_state.lights = [
            new Light(vec4(13.5, 10, -16, 1), color(1, 1, 1, 1), 1000)
        ];

        let arena_wall = Mat4.identity()
            .times(Mat4.translation(-arena_size*2,  -15, -arena_size*2 - 15))
            .times(Mat4.scale(0.4, arena_height, arena_size*2))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);
        this.hitbox[8].up_right = arena_wall.times(vec4(1,1,1,1));
        this.hitbox[8].bottom_left = arena_wall.times(vec4(-1,-1,-1,1));

        arena_wall = Mat4.identity()
            .times(Mat4.translation(-arena_size*2-5,  -15,-15.8))
            .times(Mat4.scale(arena_size*2, arena_height, 0.8));
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);
        this.hitbox[9].up_right = arena_wall.times(vec4(1,1,1,1));
        this.hitbox[9].bottom_left = arena_wall.times(vec4(-1,-1,-1,1));

        arena_wall = Mat4.identity()
            .times(Mat4.translation(arena_size*2+5,  -15,-15.8))
            .times(Mat4.scale(arena_size*2, arena_height, 0.8))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);
        this.hitbox[10].up_right = arena_wall.times(vec4(1,1,1,1));
        this.hitbox[10].bottom_left = arena_wall.times(vec4(-1,-1,-1,1));

        arena_wall = Mat4.identity()
            .times(Mat4.translation(0,  8 + arena_height,-15.8))
            .times(Mat4.scale(arena_size*2, arena_height, 0.81))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);
        this.hitbox[11].up_right = arena_wall.times(vec4(1,1,1,1));
        this.hitbox[11].bottom_left = arena_wall.times(vec4(-1,-1,-1,1));

        arena_wall = Mat4.identity()
            .times(Mat4.translation(arena_size*2,  -15, -arena_size*2 - 15))
            .times(Mat4.scale(0.4, arena_height, arena_size*2))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);
        this.hitbox[12].up_right = arena_wall.times(vec4(1,1,1,1));
        this.hitbox[12].bottom_left = arena_wall.times(vec4(-1,-1,-1,1));

        arena_wall = Mat4.identity()
            .times(Mat4.translation(0,  -15,-15.8 - 4 * arena_size))
            .times(Mat4.scale(arena_size*2, arena_height, 0.4))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);
        this.hitbox[13].up_right = arena_wall.times(vec4(1,1,1,1));
        this.hitbox[13].bottom_left = arena_wall.times(vec4(-1,-1,-1,1));

        // ************************************************************************************************
        // random generate monster
        // ************************************************************************************************


        for(let idx in this.monster) {
            this.draw_monster(context, program_state, t, idx);
        }

        this.blocking.forEach((item, index) => {
            this.draw_blocking(context, program_state, index);
        })
    }
}