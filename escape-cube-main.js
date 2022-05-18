import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

import {Shape_From_File} from "./examples/obj-file-demo.js";

export class EscapeCubeMain extends Scene {
    constructor() {
        super();

        this.shapes = {
            torus: new defs.Torus(15, 15),
            wall: new defs.Cube(),
            floor: new defs.Cube(),
            arena_wall: new defs.Cube(),
            light: new defs.Subdivision_Sphere(3),
            gun: new Shape_From_File("assets/gun.obj"),
            bullet: new Shape_From_File("assets/45.obj"),
            lantern: new Shape_From_File("assets/sconce.obj"),
            monster: new Shape_From_File("assets/skull.obj"),
        };
        const bump = new defs.Fake_Bump_Map(2);
        this.shapes.floor.arrays.texture_coord.forEach(p => p.scale_by(120));
        this.shapes.arena_wall.arrays.texture_coord.forEach(p => p.scale_by(8));

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
                ambient: 0.6, diffusivity: 0.4, specularity: 1,
                color: hex_color("#000000"),
                texture: new Texture("assets/metal_scratches_1.jpg")
            }),
            ceiling: new Material(new defs.Textured_Phong(1), {
                color: hex_color("#000000"),
                ambient: 0.4, diffusivity: 1, specularity: 0.5,
                texture: new Texture("assets/wooden.jpg")
            }),
            monster: new Material(new defs.Phong_Shader(), {
                color: hex_color("#720F14"),
                ambient: 0.3, diffusivity: 0.4, specularity: 0.4
            })

        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 12), vec3(0, 0, 11), vec3(0, 1, 0));
        this.current_camera_location = this.initial_camera_location;
        this.update = false;
        this.init = false;
        this.open_door = false;
        this.start_time = 0;
        this.door_loc = 0;
        this.fire = false;
        this.bullet_loc = [];
        this.time_fired = 0;
    }

    check_if_out_of_bound(lookat, xmin, xmax, ymin, ymax, zmin, zmax){
        const eye_pos = Mat4.inverse(lookat).times(vec4(0,0,0,1));
        if(eye_pos[0] < xmin || eye_pos[0] > xmax || eye_pos[1] < ymin || eye_pos[1] > ymax
        || eye_pos[2] < zmin || eye_pos[2] > zmax){
            return true;
        }else{
            return false;
        }
    }

    check_if_collide(collider_1, collider_2){
        // collision detection
    }

    make_control_panel() {
        this.key_triggered_button("forward", ["w"], () => {
            let new_camera = Mat4.translation(0,0,1).times(this.current_camera_location);
            if (this.check_if_out_of_bound(new_camera, -8, 8, -8, 8, -60.3, 15)) return;
            else{
                this.current_camera_location = new_camera;
            }
            this.update = true;
        }, undefined, () => {this.update = false;});

        this.key_triggered_button("backward", ["s"], () => {
            let new_camera = Mat4.translation(0,0,-1).times(this.current_camera_location);
            if (this.check_if_out_of_bound(new_camera, -8, 8, -8, 8, -60.3, 15)) return;
            else{
                this.current_camera_location = new_camera;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("left", ["a"], () => {
            let new_camera = Mat4.translation(1,0,0).times(this.current_camera_location);
            if (this.check_if_out_of_bound(new_camera, -8, 8, -8, 8, -60.3, 15)) return;
            else{
                this.current_camera_location = new_camera;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("right", ["d"], () => {
            let new_camera = Mat4.translation(-1,0,0).times(this.current_camera_location);
            if (this.check_if_out_of_bound(new_camera, -8, 8, -8, 8, -60.3, 15)) return;
            else{
                this.current_camera_location = new_camera;
            }
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("rotate left", ["q"], () => {
            this.current_camera_location = Mat4.rotation(-0.4, 0, 1, 0).times(this.current_camera_location);
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("rotate right", ["e"], () => {
            this.current_camera_location = Mat4.rotation(0.4, 0, 1, 0).times(this.current_camera_location);
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("shoot bullet", [" "], ()=>{this.fire = true},
            undefined, () => {this.fire = false});
    }

    display(context, program_state){
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!this.init) {
            //this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
            this.init = true;
        }
        if(this.update){
            program_state.set_camera(this.current_camera_location.map((x,i)=> Vector.from(program_state.camera_inverse[i]).mix(x, 0.1)));
            //this.update = false;
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

        model_transform = Mat4.identity()
            .times(Mat4.translation(15, 0 ,0))
            .times(Mat4.scale(0.4, 8, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 0 ,15))
            .times(Mat4.scale(15, 8, 0.4));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 8 ,0))
            .times(Mat4.scale(15, 0.4, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.ceiling);

        let front_wall = Mat4.identity()
            .times(Mat4.translation(-17, 0 ,-15))
            .times(Mat4.scale(12, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.wall);

        // lights
        // model_transform = Mat4.identity()
        //     .times(Mat4.translation(-14, 4, -8))
        //     .times(Mat4.rotation(0.5*Math.PI, 0, 1, 0))
        //     .times(Mat4.rotation(-0.5*Math.PI, 1, 0, 0));
        // this.shapes.lantern.draw(context, program_state, model_transform, this.materials.test);


        model_transform = Mat4.identity()
            .times(Mat4.translation(-13.5, 5, -8))
            .times(Mat4.scale(0.1, 0.5*redness_1, 0.1));
        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness_1, 0, 1), ambient:redness_1}));

        // model_transform = Mat4.identity()
        //     .times(Mat4.translation(14, 4, -8))
        //     .times(Mat4.rotation(-0.5*Math.PI, 0, 1, 0))
        //     .times(Mat4.rotation(-0.5*Math.PI, 1, 0, 0));
        // this.shapes.lantern.draw(context, program_state, model_transform, this.materials.test);

        program_state.lights = [
            new Light(vec4(13.5, 4.5, -8, 1), color(1, redness_2, 0, 1), 30)
        ];
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

        let eye_loc = program_state.camera_inverse.times(vec4(0,0,0,1));

        if(eye_loc[2] >= 0 && !this.open_door) {
            this.open_door = true;
            this.start_time = t;
        }else if(eye_loc[2] < -1 && this.open_door) {
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
        front_wall = Mat4.identity()
            .times(Mat4.translation(17, 0 ,-15))
            .times(Mat4.scale(12, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.wall);

        //gun
        let gun = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(1,-0.7,-3))
            .times(Mat4.rotation(-0.5*Math.PI, 0,1,0));
        this.shapes.gun.draw(context, program_state, gun, this.materials.gun);
        //this.shapes.bullet.draw(context, program_state, Mat4.identity(), this.materials.bullet);
        if(this.fire && (t-this.time_fired)>3){
            this.bullet_loc.push(0);
            this.time_fired = t;
        }
        for(let i = 0; i < this.bullet_loc.length; i++){
            this.bullet_loc[i]++;
            let bullet = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(1.85,-1-((this.bullet_loc[i]/1000.0)**2)*0.5*9.8*2,-10.5-this.bullet_loc[i]))
                .times(Mat4.rotation(0.5*Math.PI, 1, 0, 0))
                .times(Mat4.scale(0.15, 0.15, 0.4));
            this.shapes.bullet.draw(context, program_state, bullet, this.materials.bullet);
        }
        let i = 0;
        while(i < this.bullet_loc.length){ // replace using collision detection
            if(this.bullet_loc[i] > 50) this.bullet_loc.splice(i,1);
            else i++;
        }


        // ************************************************************************************************
        // main arenas
        // ************************************************************************************************
        program_state.lights = [
            new Light(vec4(13.5, 10, -16, 1), color(1, 1, 1, 1), 1000)
        ];

        const arena_size = 50;
        const arena_height = 50;
        let arena_wall = Mat4.identity()
            .times(Mat4.translation(-arena_size*2,  -15, -arena_size*2 - 15))
            .times(Mat4.scale(0.4, arena_height, arena_size*2))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);

        arena_wall = Mat4.identity()
            .times(Mat4.translation(-arena_size*2-5,  -15,-15.8))
            .times(Mat4.scale(arena_size*2, arena_height, 0.8));
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);

        arena_wall = Mat4.identity()
            .times(Mat4.translation(arena_size*2+5,  -15,-15.8))
            .times(Mat4.scale(arena_size*2, arena_height, 0.8))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);

        arena_wall = Mat4.identity()
            .times(Mat4.translation(0,  8 + arena_height,-15.8))
            .times(Mat4.scale(arena_size*2, arena_height, 0.81))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);

        arena_wall = Mat4.identity()
            .times(Mat4.translation(arena_size*2,  -15, -arena_size*2 - 15))
            .times(Mat4.scale(0.4, arena_height, arena_size*2))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);

        arena_wall = Mat4.identity()
            .times(Mat4.translation(0,  -15,-15.8 - 4 * arena_size))
            .times(Mat4.scale(arena_size*2, arena_height, 0.4))
        this.shapes.arena_wall.draw(context, program_state, arena_wall, this.materials.wall);

        // side_wall = Mat4.translation(0,0,-30).times(side_wall);
        // this.shapes.wall.draw(context, program_state, side_wall, this.materials.wall);
        // side_wall = Mat4.translation(60,0,0).times(side_wall);
        // this.shapes.wall.draw(context, program_state, side_wall, this.materials.wall);
        // side_wall = Mat4.translation(0,0,30).times(side_wall);
        // this.shapes.wall.draw(context, program_state, side_wall, this.materials.wall);
        // side_wall = Mat4.identity()
        //     .times(Mat4.translation(-15, 0 ,-60))
        //     .times(Mat4.scale(15, 8, 0.4));
        // this.shapes.wall.draw(context, program_state, side_wall, this.materials.wall);
        // side_wall = Mat4.translation(30,0,0).times(side_wall);
        // this.shapes.wall.draw(context, program_state, side_wall, this.materials.wall);

        // let monster_trans = Mat4.identity()
        //     .times(Mat4.translation(-15, 0 ,-50))
        //     .times(Mat4.rotation(t, 0, 1, 0))
        //     .times(Mat4.rotation(-0.5*Math.PI, 1, 0, 0))
        //     .times(Mat4.scale(2,2,2));
        // this.shapes.monster.draw(context, program_state, monster_trans, this.materials.monster);



    }
}