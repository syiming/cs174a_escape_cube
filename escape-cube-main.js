import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

import {Shape_From_File} from "./examples/obj-file-demo.js";
import {Text_Line} from "./examples/text-demo.js";
import {Color_Phong_Shader, Shadow_Textured_Phong_Shader,
    Depth_Texture_Shader_2D, Buffered_Texture, LIGHT_DEPTH_TEX_SIZE} from './examples/shadow-demo-shaders.js'

const arena_size = 40;
const arena_height = 40;

const BLOCK_SIZE = 6;         // block size
const GROUND = -7.8;          // z value of ground
const BH = GROUND+1.5*BLOCK_SIZE; // z value of blocking center

const MAX_LOST = 3000;
const MAX_HIT = 10;

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
    constructor(pos, color, speed, size, phase, angle) {
        this.pos = pos;
        this.color = color;
        this.speed = speed;
        this.phase = phase;
        this.angle = angle;
        this.R = size;
        this.hit_info = {
            hit_sign: 1,
            hit: false,
            hit_count: 0,
            x: 0,
            z: 0,
            dist: 10000,
        }
        this.lost_info = {
            sign: -1,
            lost_angle: angle,
            lost_count: 0,
            x: 0,
            z: 0,
            dist: 10000,
        }
        this.chase = false;
        this.up_right = vec4(1.5,1.5,1.5,1);
        this.bottom_left = vec4(-1.5,-1.5,-1.5,1);
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
            .times(Mat4.scale(BLOCK_SIZE, 1.5*BLOCK_SIZE, BLOCK_SIZE));
        this.up_right = this.model.times(vec4(1, 1, 1, 1));
        this.bottom_left = this.model.times(vec4(-1, -1, -1, 1));
        this.leeway = 0.01;
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
            reticle: new defs.Cube(),
            light: new defs.Subdivision_Sphere(3),
            gun: new Shape_From_File("assets/gun.obj"),
            bullet: new Shape_From_File("assets/45.obj"),
            lantern: new Shape_From_File("assets/sconce.obj"),
            monster: new Shape_From_File("assets/skull.obj"),
            bullet_shell: new Cylinder_Shell(30,30),
            text: new Text_Line(35),
            sphere: new defs.Subdivision_Sphere(4),
            cube: new defs.Cube(),
        };
        const bump = new defs.Fake_Bump_Map(2);
        this.shapes.floor.arrays.texture_coord.forEach(p => p.scale_by(120));
        this.shapes.ceiling.arrays.texture_coord.forEach(p => p.scale_by(120));
        this.shapes.arena_wall.arrays.texture_coord.forEach(p => p.scale_by(5));

        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: 1, diffusivity: .4, color: hex_color("#412c18")}),
            pure: new Material(new Color_Phong_Shader(), {}),
            wall: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.4, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/brick-wall.jpeg", "LINEAR_MIPMAP_LINEAR")
            }),
            floor: new Material(new Shadow_Textured_Phong_Shader(1), {
                color: hex_color("#4f2f2d"),
                ambient: 0.3, diffusivity: 0.4, specularity: 0.3,
                color_texture: new Texture("assets/floor.jpeg"),
                light_depth_texture: null
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
                ambient: 0.5, diffusivity: 0.2, specularity: 0.8,
                color: hex_color("#000000"),
                texture: new Texture("assets/blocking.jpg")
            }),
            blocking2: new Material(bump, {
                ambient: 0.5, diffusivity: 0.2, specularity: 1,
                color: hex_color("#000000"),
                texture: new Texture("assets/blocking2.jpg")
            }),
            reticle: new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: .4, color: hex_color("#00FF00")}),
            //hex_color("#FF3131")
            loadbar: new Material(new defs.Phong_Shader(),
            {ambient: 1, diffusivity: .4, color: color(1, 49/255., 49/255., 0.8)}),

            text_image: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),
            hitbox: new Material(new defs.Phong_Shader(), {
                ambient: 0.8, diffusivity: 0, specularity: 0,
                color: hex_color("#00FF00"),
            }),
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
        this.blocking = [];
        this.kill_count = 0;
        this.death_count = 0;
        this.reset = false;
        this.last_reset_time = 0;
        this.show_hitbox_cube = false;
        this.show_hitbox_sphere = false;
        this.monster_moving = true;
        this.record_time = 0;
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
        let up_t = Mat4.inverse(inverse).times(this.gun_transform).times(vec4(5,0.5,-0.5,1));
        let bottom_t = Mat4.inverse(inverse).times(this.gun_transform).times(vec4(-5,-0.5,0.5,1));
        let up_right = vec4(Math.max(up_t[0], bottom_t[0]), Math.max(up_t[1], bottom_t[1]), Math.max(up_t[2], bottom_t[2]), 1);
        let bottom_left = vec4(Math.min(up_t[0], bottom_t[0]), Math.min(up_t[1], bottom_t[1]), Math.min(up_t[2], bottom_t[2]), 1);

        // check if hit boundary
        for (let idx in this.hitbox) {
            let body = this.hitbox[idx];
            if (this.check_if_collide(body.up_right, body.bottom_left, eye_pos, 1.0) ||
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

    texture_buffer_init(gl) {
        // Depth Texture
        this.lightDepthTexture = gl.createTexture();
        // Bind it to TinyGraphics
        this.light_depth_texture = new Buffered_Texture(this.lightDepthTexture);
        this.materials.floor.light_depth_texture = this.light_depth_texture

        this.lightDepthTextureSize = LIGHT_DEPTH_TEX_SIZE;
        gl.bindTexture(gl.TEXTURE_2D, this.lightDepthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,      // target
            0,                  // mip level
            gl.DEPTH_COMPONENT, // internal format
            this.lightDepthTextureSize,   // width
            this.lightDepthTextureSize,   // height
            0,                  // border
            gl.DEPTH_COMPONENT, // format
            gl.UNSIGNED_INT,    // type
            null);              // data
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Depth Texture Buffer
        this.lightDepthFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,       // target
            gl.DEPTH_ATTACHMENT,  // attachment point
            gl.TEXTURE_2D,        // texture target
            this.lightDepthTexture,         // texture
            0);                   // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // create a color texture of the same size as the depth texture
        // see article why this is needed_
        this.unusedTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.unusedTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.lightDepthTextureSize,
            this.lightDepthTextureSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // attach it to the framebuffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,        // target
            gl.COLOR_ATTACHMENT0,  // attachment point
            gl.TEXTURE_2D,         // texture target
            this.unusedTexture,         // texture
            0);                    // mip level
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    T_online_test(test_pt, line_start, line_end) {
        return (test_pt[0] - line_start[0]) * (line_end[2] - line_start[2]) - (test_pt[2] - line_start[2]) * (line_end[0] - line_start[0]);
    }

    intersect_aabb_vs_line(a_up_right, a_bottom_left, line_start, line_end) {
        let a_up_left = vec3(a_bottom_left[0], a_up_right[1], a_up_right[2]);
        let a_bottom_right = vec3(a_up_right[0], a_bottom_left[1], a_bottom_left[2]);
        return (this.T_online_test(line_start, a_up_right, a_bottom_left) * this.T_online_test(line_end, a_up_right, a_bottom_left) <= 0 &&
            this.T_online_test(a_up_right, line_start, line_end) * this.T_online_test(a_bottom_left, line_start, line_end) <= 0) ||
            (this.T_online_test(line_start, a_up_left, a_bottom_right) * this.T_online_test(line_end, a_up_left, a_bottom_right) <= 0 &&
                this.T_online_test(a_up_left, line_start, line_end) * this.T_online_test(a_bottom_right, line_start, line_end) <= 0);
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

    intersect_sphere_vs_sphere(sphere1, radius1, sphere2, radius2, margin=0) {
        let x_diff = sphere1[0] - sphere2[0];
        let z_diff = sphere1[2] - sphere2[2];
        let dist = Math.sqrt(x_diff * x_diff + z_diff * z_diff);
        return dist < radius1 + radius2 + margin;
    }

    check_if_collide(a_up_right, a_bottom_left, b_coord, R){
        // collision detection
        // simplest for a spherical collider
        return this.intersect_aabb_vs_sphere(a_up_right, a_bottom_left, b_coord, R);
    }

    check_if_monster_hit_block(pos, R) {
        for (let idx in this.blocking) {
            let block = this.blocking[idx];
            if (this.intersect_aabb_vs_sphere(block.up_right, block.bottom_left, pos, R)) {
                return true;
            }
        }
        return false;
    }

    check_if_monster_hit_wall(pos, R){
        for(let idx in this.hitbox){
            let body = this.hitbox[idx];
            if(this.check_if_collide(body.up_right, body.bottom_left, pos, R)){
                return true;
            }
        }
        return false;
    }

    check_if_monster_hit_another(pos, R, index) {
        for (let idx in this.monster) {
            if (idx === index) continue;
            let monster =  this.monster[idx];
            if (this.intersect_sphere_vs_sphere(monster.pos, monster.R*2, pos, R*2, 0.01))
                return true;
        }
        return false;
    }

    check_if_bullet_hit_monster(pos1, R1, pos2, R2) {
        return this.intersect_sphere_vs_sphere(pos1, R1, pos2, R2);
    }

    make_control_panel() {
        this.key_triggered_button("forward", ["w"], () => {
            if (this.died) return;
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
            if (this.died) return;
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
            if (this.died) return;
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
            if (this.died) return;
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
            if (this.died) return;
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
            if (this.died) return;
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
            if (this.died) return;
            if (this.elevation_angle < -Math.PI / 2.) return;
            this.elevation_angle -= 0.04;
            this.current_camera_location = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("look down", ["f"], () => {
            if (this.died) return;
            if (this.elevation_angle > Math.PI / 2.) return;
            this.elevation_angle += 0.04;
            this.current_camera_location = Mat4.rotation(this.elevation_angle,1,0,0).times(this.surface_camera);
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("shoot bullet", [" "], ()=>{
            if (this.died) return;
            this.fire = true;
        },undefined, () => {this.fire = false;});
        
        this.key_triggered_button("Reset", ["m"], () => {
            this.reset = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("cube hitbox", ["b"], ()=>{this.show_hitbox_cube = !this.show_hitbox_cube});

        this.key_triggered_button("sphere hitbox", ["n"], ()=>{this.show_hitbox_sphere = !this.show_hitbox_sphere});

        this.key_triggered_button("stop monster", ["l"], ()=>{
            this.monster_moving = !this.monster_moving;
        });
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

    range_random(min, max) {
        return Math.random() * (max-min+1) + min;
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
                    let x = this.range_random(-75, 75);
                    let z = this.range_random(-50, -150);
                    let block = new Blocking(vec4(x, BH, z, 1), 1);
                    block.model = block.model.times(Mat4.scale(1,1,1));
                    this.blocking.push(block);
                }
                break;
        }
    }

    check_legal_spawn(x, z, size) {
        let num_blocking = this.blocking.length;
        let num_monster = this.monster.length;

        for (let i = 0; i < num_monster; i++) {
            let x_diff = this.monster[i].pos[0] - x;
            let z_diff = this.monster[i].pos[2] - z;
            let dist = Math.sqrt(x_diff * x_diff + z_diff * z_diff)
            if (dist < 2*(this.monster[i].R+size)) return false;
        }

        for (let i = 0; i < num_blocking; i++) {
            if ((x < this.blocking[i].pos[0] + BLOCK_SIZE + size
                    && x > this.blocking[i].pos[0] - BLOCK_SIZE - size)
                || (z < this.blocking[i].pos[2] + BLOCK_SIZE + size
                    && z > this.blocking[i].pos[2] - BLOCK_SIZE - size))
                return false;
        }
        return true;
    }

    init_monster(init_num) {
        const possible_color = [hex_color("#941619"), hex_color("#3e3237"), hex_color("#4b61b9")];
        const possible_speed = [0.04, 0.03, 0.02];
        const possible_size = [1.5, 2, 2.5];

        for (let i = 0; i < init_num; i++) {
            let x = this.range_random(-75, 75);
            let z = this.range_random(-50, -150);

            let type = Math.floor(Math.random() * 3);
            while (!this.check_legal_spawn(x, z, possible_size[type])) {
                x = this.range_random(-75, 75);
                z = this.range_random(-50, -150);
            }
            let monster = new Monster(vec4(x, 0, z, 1), possible_color[type], possible_speed[type], possible_size[type],
                Math.random() * Math.PI, Math.random() * Math.PI);
            this.monster.push(monster);
        }
    }

    cal_angle(x_diff, z_diff) {
        if (x_diff > 0 && z_diff > 0)
            return Math.atan(x_diff / z_diff) - Math.PI;
        else if (x_diff < 0 && z_diff > 0)
            return Math.atan(x_diff / z_diff) + Math.PI;
        else
            return Math.atan(x_diff / z_diff);
    }

    draw_monster(context, program_state, t, idx) {
        let eye_loc = program_state.camera_transform.times(vec4(0,0,0,1));

        if (this.monster[idx].lost_info.lost_count > MAX_LOST) {
            this.monster[idx].chase = false;
            this.monster[idx].lost_info.lost_count = 0;
        }

        // in main arena
        if(eye_loc[2] <= -23 && this.monster_moving && !this.died) {
            // if hit last round random move
            let old_pos = this.monster[idx].pos;

            if (this.monster[idx].hit_info.hit) {
                let x = -this.monster[idx].hit_info.z * this.monster[idx].hit_info.hit_count * this.monster[idx].hit_info.hit_sign;
                let z = this.monster[idx].hit_info.x * this.monster[idx].hit_info.hit_count * this.monster[idx].hit_info.hit_sign;
                this.monster[idx].pos = vec4(this.monster[idx].pos[0] - x / this.monster[idx].hit_info.dist * this.monster[idx].speed,
                    this.monster[idx].pos[1],
                    this.monster[idx].pos[2] - z / this.monster[idx].hit_info.dist * this.monster[idx].speed, 1);
            }
            let x_diff = this.monster[idx].pos[0] - eye_loc[0];
            let z_diff = this.monster[idx].pos[2] - eye_loc[2];
            let dist = Math.sqrt(x_diff * x_diff + z_diff * z_diff);
            let angle = this.cal_angle(x_diff, z_diff);


            let lost = true;
            // check if the monster able to view the player: in the view range || too close
            if (Math.abs(angle - this.monster[idx].angle) < Math.PI / 3.5 || dist < 20.0 || this.monster[idx].chase) {
                // check if blocked by block
                let blocked = false;
                for (let b_idx in this.blocking) {
                    let block = this.blocking[b_idx];
                    if (this.intersect_aabb_vs_line(block.up_right, block.bottom_left, eye_loc, this.monster[idx].pos)) {
                        blocked = true;
                        break;
                    }
                }

                if (!blocked) {
                    this.monster[idx].pos = vec4(this.monster[idx].pos[0] - x_diff / dist * this.monster[idx].speed, this.monster[idx].pos[1], this.monster[idx].pos[2] - z_diff / dist * this.monster[idx].speed, 1);
                    this.monster[idx].angle = angle;
                    this.monster[idx].lost_info.lost_angle = angle;
                    this.monster[idx].lost_info.sign = Math.round(Math.random()) * 2 - 1;
                    this.monster[idx].lost_info.x = x_diff;
                    this.monster[idx].lost_info.z = z_diff;
                    this.monster[idx].lost_info.dist = dist;
                    this.monster[idx].chase = true;
                    this.monster[idx].lost_info.lost_count = 0;
                    lost = false;
                }
            }

            if (this.monster[idx].chase && lost && !this.monster[idx].hit_info.hit) {
                let x, z;
                let stage = (Math.floor(this.monster[idx].lost_info.lost_count / (MAX_LOST/40) )) % 6;

                if (stage === 0 || stage === 4) {
                    console.log("l");
                    // this.monster[idx].angle = this.monster[idx].lost_info.lost_angle + Math.PI / 2.0;
                    x = -this.monster[idx].lost_info.z * 10 * this.monster[idx].lost_info.sign;
                    z = this.monster[idx].lost_info.x * 10 * this.monster[idx].lost_info.sign;
                } else if (stage === 1 || stage === 3){
                    console.log("r");
                    // this.monster[idx].angle = this.monster[idx].lost_info.lost_angle - Math.PI / 2.0;
                    x = this.monster[idx].lost_info.z * 10 * this.monster[idx].lost_info.sign;
                    z = -this.monster[idx].lost_info.x * 10 * this.monster[idx].lost_info.sign;
                } else {
                    console.log(2);
                    this.monster[idx].angle = this.monster[idx].lost_info.lost_angle;
                    x = this.monster[idx].lost_info.x * 0.5;
                    z = this.monster[idx].lost_info.z * 0.5;
                }
                this.monster[idx].pos = vec4(this.monster[idx].pos[0] - x / dist * this.monster[idx].speed,
                    this.monster[idx].pos[1],
                    this.monster[idx].pos[2] - z / dist * this.monster[idx].speed, 1);

                this.monster[idx].lost_info.lost_count += 1;
                if (this.monster[idx].lost_info.lost_count > MAX_LOST) {
                    this.monster[idx].chase = false;
                }
            }

            // check if hit
            if (this.check_if_monster_hit_block(this.monster[idx].pos, this.monster[idx].R*2)||
                this.check_if_monster_hit_wall(this.monster[idx].pos, this.monster[idx].R*2)) {
                console.log("hit", this.monster[idx].hit_info.hit_count);
                this.monster[idx].pos = old_pos;
                if (!this.monster[idx].hit_info.hit) {
                    this.monster[idx].hit_info.x = x_diff;
                    this.monster[idx].hit_info.z = z_diff;
                    this.monster[idx].hit_info.dist = dist;
                }
                this.monster[idx].hit_info.hit = true;
                this.monster[idx].hit_info.hit_count += 1;

                if (this.monster[idx].hit_info.hit_count > MAX_HIT) {
                    this.monster[idx].hit_info.hit_count = 1;
                    this.monster[idx].hit_info.hit_sign = -this.monster[idx].hit_info.hit_sign;
                }
            } else {
                this.monster[idx].hit_info.hit = false;
            }

            if (this.check_if_monster_hit_another(this.monster[idx].pos, this.monster[idx].R, idx)) {
                console.log("hit another")
                this.monster[idx].pos = old_pos;
            }
        }

        let model = Mat4.translation(...this.monster[idx].pos.to3())
            .times(Mat4.rotation(this.monster[idx].angle,0,1,0))
            .times(Mat4.translation(0, 1.5 * Math.sin(2 * t + this.monster[idx].phase), 0))
            .times(this.monster[idx].model);

        this.shapes.monster.draw(context, program_state, model, this.materials.monster.override({color: this.monster[idx].color}));

        if (this.show_hitbox_sphere) {
            this.shapes.sphere.draw(context, program_state,
                model.times(Mat4.scale(2, 2, 2)),
                this.materials.hitbox,
                "LINE_STRIP");
        } else if (this.show_hitbox_cube) {
            this.shapes.cube.draw(context, program_state,
                model.times(Mat4.scale(2, 2, 2)),
                this.materials.hitbox,
                "LINE_STRIP");
        }

        // update collider
        let up_right = model.times(vec4(1.5,1.5,1.5,1));
        let bottom_left = model.times(vec4(-1.5,-1.5,-1.5,1));
        this.monster[idx].up_right = vec4(Math.max(up_right[0], bottom_left[0]),Math.max(up_right[1], bottom_left[1]),Math.max(up_right[2], bottom_left[2]),1);
        this.monster[idx].bottom_left = vec4(Math.min(up_right[0], bottom_left[0]),Math.min(up_right[1], bottom_left[1]),Math.min(up_right[2], bottom_left[2]),1);

        // check if monster touches the player
        if(this.check_if_collide(this.monster[idx].up_right, this.monster[idx].bottom_left, eye_loc, 1.5) && !this.died){
            this.died = true;
            this.death_count++;
        }
    }

    draw_blocking(context, program_state, idx) {
        this.shapes.blocking.draw(context, program_state, this.blocking[idx].model,
            this.materials.blocking1);
        const leeway = this.blocking[idx].leeway;
        const size = vec3(1 + leeway, 1 + leeway, 1 + leeway);
        if (this.show_hitbox_cube) {
            this.shapes.cube.draw(context, program_state,
                this.blocking[idx].model.times(Mat4.scale(...size)),
                this.materials.hitbox,
                "LINE_STRIP");
        }
    }

    render_arena(context, program_state, shadow_pass){
        const t = program_state.animation_time / 1000;
        program_state.draw_shadow = shadow_pass;

        let light_bulb = Mat4.identity()
            .times(Mat4.translation(0, 12, -50));
        this.shapes.light.draw(context, program_state, light_bulb, this.materials.light.override({color: color(1,0.7,0,1)}));

        const floor_size = 1000;
        let model_transform = Mat4.identity()
            .times(Mat4.translation(0, -8 ,0))
            .times(Mat4.scale(floor_size, 0.4, floor_size));

        this.shapes.floor.draw(context, program_state, model_transform, shadow_pass? this.materials.floor : this.materials.pure);
        this.hitbox[5].up_right = model_transform.times(vec4(1,1,1,1));
        this.hitbox[5].bottom_left = model_transform.times(vec4(-1,-1,-1,1));

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
        });
    }

    render_UI(context, program_state, t, display_t){
        if (this.died){
            let death_sentence = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(-0.11, 0, -0.3))
                .times(Mat4.scale(.02, .025, 1));
                let death_line = "YOU DIED!";
                this.shapes.text.set_string(death_line, context.context);
                this.shapes.text.draw(context, program_state, death_sentence, this.materials.text_image);
            return;
        }

        if (t < 3){
            let title = "Escape Cube";
            let title_transform = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(-0.29, 0, -1))
                .times(Mat4.scale(.04, .05, 1));
            this.shapes.text.set_string(title, context.context);
            this.shapes.text.draw(context, program_state, title_transform, this.materials.text_image);
            return;
        }

        let line1 = "Kills: " + this.kill_count;
        let line2 = "Deaths: " + this.death_count;
        
        if (this.monster.length==0){
            if (!this.record_time) this.record_time = Math.round(display_t/10);
            let win_line = "YOU WIN!";
            let time = this.record_time;
            let micro = time % 100;
            let sec = Math.floor(time/100) % 60;
            let min = Math.floor(time/6000);
            let line3 = "Record Time: " + (min < 10 ? "0" + min : min) + ":" + (sec < 10 ? "0" + sec : sec) + ":" + (micro < 10 ? "0" + micro:micro);
            let info1 = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(-0.30, -0.2, -1))
                .times(Mat4.scale(.02, .025, 1));

            let info2 = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(-0.30, -0.3, -1))
                .times(Mat4.scale(.02, .025, 1));
        
            let info3 = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(-0.30, -0.1, -1))
                .times(Mat4.scale(.02, .025, 1));

            let info4 = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(-0.10, 0.025, -0.3))
                .times(Mat4.scale(.02, .025, 1));
            this.shapes.text.set_string(line1, context.context);
            this.shapes.text.draw(context, program_state, info1, this.materials.text_image);
            this.shapes.text.set_string(line2, context.context);
            this.shapes.text.draw(context, program_state, info2, this.materials.text_image);
            this.shapes.text.set_string(line3, context.context);
            this.shapes.text.draw(context, program_state, info3, this.materials.text_image);
            this.shapes.text.set_string(win_line, context.context);
            this.shapes.text.draw(context, program_state, info4, this.materials.text_image);
            return;
        }

        let time = Math.round(display_t/10)
        let micro = time % 100;
        let sec = Math.floor(time/100) % 60;
        let min = Math.floor(time/6000);
        let line3 = (min < 10 ? "0" + min : min) + ":" + (sec < 10 ? "0" + sec : sec) + ":" + (micro < 10 ? "0" + micro:micro);
        // draw kill count
        let info1 = Mat4.identity()
        .times(Mat4.inverse(program_state.camera_inverse))
        .times(Mat4.translation(-0.7, -0.3, -1))
        .times(Mat4.scale(.02, .025, 1));

        let info2 = Mat4.identity()
        .times(Mat4.inverse(program_state.camera_inverse))
        .times(Mat4.translation(-0.7, -0.35, -1))
        .times(Mat4.scale(.02, .025, 1));
    
        let info3 = Mat4.identity()
        .times(Mat4.inverse(program_state.camera_inverse))
        .times(Mat4.translation(0.5, 0.35, -1))
        .times(Mat4.scale(.02, .025, 1));

        this.shapes.text.set_string(line1, context.context);
        this.shapes.text.draw(context, program_state, info1, this.materials.text_image);
        this.shapes.text.set_string(line2, context.context);
        this.shapes.text.draw(context, program_state, info2, this.materials.text_image);
        this.shapes.text.set_string(line3, context.context);
        this.shapes.text.draw(context, program_state, info3, this.materials.text_image);
        // render reticle
        let offsetY = -0.032;
        let offsetX = 0.063;
        let reticle_top = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(0+offsetX, 0.015+offsetY, -1))
            .times(Mat4.scale(0.0015, 0.007, 0.007));
        let reticle_left = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(0.015+offsetX, 0+offsetY, -1))
            .times(Mat4.scale(0.007, 0.0015, 0.007));
        let reticle_right = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(-0.015+offsetX, 0+offsetY, -1))
            .times(Mat4.scale(0.007, 0.0015, 0.007));
        let reticle_bot = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(0+offsetX, -0.015+offsetY, -1))
            .times(Mat4.scale(0.0015, 0.007, 0.007));
        this.shapes.reticle.draw(context, program_state, reticle_top, this.materials.reticle);
        this.shapes.reticle.draw(context, program_state, reticle_left, this.materials.reticle);
        this.shapes.reticle.draw(context, program_state, reticle_right, this.materials.reticle);
        this.shapes.reticle.draw(context, program_state, reticle_bot, this.materials.reticle);

        // draw circle loading bar
        let load_bar_material = this.materials.reticle;
        let load_bar_bound = 25;
        let load_bar_num = load_bar_bound;
        let elapsed_time = t-this.time_fired;
        if (elapsed_time < 4){
            load_bar_material = this.materials.loadbar;
            load_bar_num = elapsed_time / 4. * load_bar_bound - 1;
        }
        for (let iter = 0; iter < load_bar_num; iter++){
            let load_bar = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(offsetX, offsetY, 0))
                .times(Mat4.rotation(2*iter*Math.PI / load_bar_bound, 0, 0, 1))
                .times(Mat4.translation(0, 0.03, -1))
                .times(Mat4.scale(0.0015, 0.0015, 0.007));
            this.shapes.reticle.draw(context, program_state, load_bar, load_bar_material);
        }
        
    }

    display(context, program_state){
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (this.died) {
            this.update = false;
        }

        if (this.reset){
            this.restart(program_state);
            return;
        } 

        const gl = context.context;

        if (!this.init) {
            //this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            const ext = gl.getExtension('WEBGL_depth_texture');
            if (!ext) {
                return alert('need WEBGL_depth_texture');
            }
            this.texture_buffer_init(gl);
            program_state.set_camera(this.initial_camera_location);
            this.camera_transform = program_state.camera_transform;

            // init blocking and monster
            this.init_blocking(16, 2);
            this.init_monster(3);
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
        // FIXME
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
        // FIXME
        model_transform = Mat4.identity()
            .times(Mat4.translation(14, 4, -8))
            .times(Mat4.rotation(-0.5*Math.PI, 0, 1, 0))
            .times(Mat4.rotation(-0.5*Math.PI, 1, 0, 0));
        this.shapes.lantern.draw(context, program_state, model_transform, this.materials.test);
        model_transform = Mat4.identity()
            .times(Mat4.translation(13.5, 5, -8))
            .times(Mat4.scale(0.1, 0.5*redness_2, 0.1));
        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness_2, 0, 1), ambient:redness_2}));

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
        if (this.show_hitbox_cube) {
            this.shapes.cube.draw(context, program_state, gun.times(Mat4.scale(0.8, 0.5, 0.6)), this.materials.hitbox, "LINE_STRIP");
        }
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
            for(let idx in this.monster){
                let monster_pos = this.monster[idx].pos;
                let monster_size = this.monster[idx].R;
                if (this.check_if_bullet_hit_monster(monster_pos, 2*monster_size, loc, 0.15)){
                    console.log('kill');
                    console.log(this.monster[idx])
                    this.bullet_loc.splice(i,1);
                    this.monster.splice(idx, 1);
                    this.kill_count++;
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
            new Light(vec4(0, 12, -60, 1), color(1, 0.7, 0, 1), 1000)
        ];

        this.light_view_target = vec4(0, 0, -50, 1);
        this.light_field_of_view = 160 * Math.PI / 180;

        const light_view_mat = Mat4.look_at(
            vec3(0, 12, -60),
            vec3(this.light_view_target[0], this.light_view_target[1], this.light_view_target[2]),
            vec3(1, 0, 1), // assume the light to target will have a up dir of +y, maybe need to change according to your case
        );
        const light_proj_mat = Mat4.perspective(this.light_field_of_view, 1, 0.5, 100);
        // Bind the Depth Texture Buffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightDepthFramebuffer);
        gl.viewport(0, 0, this.lightDepthTextureSize, this.lightDepthTextureSize);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        // Prepare uniforms
        program_state.light_view_mat = light_view_mat;
        program_state.light_proj_mat = light_proj_mat;
        program_state.light_tex_mat = light_proj_mat;
        program_state.view_mat = light_view_mat;
        program_state.projection_transform = light_proj_mat;
        this.render_arena(context, program_state, false);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        program_state.view_mat = program_state.camera_inverse;
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 0.1, 1000);
        this.render_arena(context, program_state, true);
        this.render_UI(context, program_state, t, program_state.animation_time - this.last_reset_time);

    }


    restart(program_state){
        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 12), vec3(0, 0, 11), vec3(0, 1, 0));
        this.current_camera_location = this.initial_camera_location;
        this.camera_transform = Mat4.identity();
        this.surface_camera = this.initial_camera_location; // never looks up or down
        this.update = false;
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
        this.blocking = [];
        this.kill_count = 0;
        this.reset = false;
        this.show_hitbox_cube = false;
        this.show_hitbox_sphere = false;
        this.monster_moving = true;
        this.record_time = 0;
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
        this.last_reset_time = program_state.animation_time;
        // program_state.animation_time = 0;
        // program_state.animation_delta_time = 0;
        program_state.set_camera(this.initial_camera_location);
        this.camera_transform = program_state.camera_transform;
        this.init_blocking(16, 2);
        this.init_monster(3);
    }
    
}