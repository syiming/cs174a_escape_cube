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
            light: new defs.Subdivision_Sphere(4),
            gun: new Shape_From_File("assets/gun.obj"),
            bullet: new Shape_From_File("assets/45.obj"),
        };
        const bump = new defs.Fake_Bump_Map(1);

        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#888050")}),
            wall: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.2, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/brick-wall.jpeg")
            }),
            floor: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.2, diffusivity: 1, specularity: 0.9,
                texture: new Texture("assets/brick-wall.jpeg")
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

        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 12), vec3(0, 0, 9), vec3(0, 1, 1));
        this.current_camera_location = this.initial_camera_location;
        this.update = false;
        this.init = false;
        this.open_door = false;
        this.start_time = 0;
        this.door_loc = 0;
        this.fire = false;
        this.bullet_loc = [];
    }

    make_control_panel() {
        this.key_triggered_button("forward", ["w"], () => {
            this.current_camera_location = this.current_camera_location.times(Mat4.translation(0,0,1));
            this.update = true;
        }, undefined, () => {this.update = false;});

        this.key_triggered_button("backward", ["s"], () => {
            if (this.current_camera_location.times(vec4(0,0,0,1))[2] < -13) return;
            this.current_camera_location = this.current_camera_location.times(Mat4.translation(0,0,-1));
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("left", ["a"], () => {
            if (this.current_camera_location.times(vec4(0,0,0,1))[0] > 8) return;
            this.current_camera_location = this.current_camera_location.times(Mat4.translation(1,0,0));
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("left", ["d"], () => {
            if (this.current_camera_location.times(vec4(0,0,0,1))[0] < -8) return;
            this.current_camera_location = this.current_camera_location.times(Mat4.translation(-1,0,0));
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("rotate left", ["q"], () => {
            this.current_camera_location = this.current_camera_location.times(Mat4.rotation(-0.2, 0, 1, 0));
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("rotate right", ["e"], () => {
            this.current_camera_location = this.current_camera_location.times(Mat4.rotation(0.2, 0, 1, 0));
            this.update = true;
        },undefined, () => {this.update = false;});

        this.key_triggered_button("shoot bullet", [" "], ()=>{ this.bullet_loc.push(0)});
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
        let redness = 0.5 + 0.1*Math.sin(3*t) + 0.2*Math.cos(7*t);
        // The parameters of the Light are: position, color, size
        program_state.lights = [
            new Light(vec4(-13, 4.5, -8, 1), color(1, redness, 0, 1), 30)
        ];
        let model_transform = Mat4.identity()
            .times(Mat4.translation(-15, 0 ,0))
            .times(Mat4.scale(0.2, 8, 15));

        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        program_state.lights = [
            new Light(vec4(13, 4.5, -8, 1), color(1, redness, 0, 1), 30)
        ];
        model_transform = Mat4.identity()
            .times(Mat4.translation(15, 0 ,0))
            .times(Mat4.scale(0.2, 8, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 0 ,15))
            .times(Mat4.scale(15, 8, 0.2));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, -8 ,0))
            .times(Mat4.scale(15, 0.2, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.floor);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 8 ,0))
            .times(Mat4.scale(15, 0.2, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.ceiling);

        model_transform = Mat4.identity()
            .times(Mat4.translation(14, 4, -8));

        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness, 0, 1), ambient: redness}));

        model_transform = Mat4.identity()
            .times(Mat4.translation(-14, 4, -8));

        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness, 0, 1), ambient: redness}));

        let eye_loc = program_state.camera_inverse.times(vec4(0,0,0,1));

        //door
        let front_wall = Mat4.identity()
            .times(Mat4.translation(-10, 0 ,-15))
            .times(Mat4.scale(5, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.wall);
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
        front_wall = Mat4.translation(10+this.door_loc, 0, -0.5).times(front_wall);
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.stone);
        front_wall = Mat4.identity()
            .times(Mat4.translation(10, 0 ,-15))
            .times(Mat4.scale(5, 8, 0.5));
        this.shapes.wall.draw(context, program_state, front_wall, this.materials.wall);

        //gun
        let gun = Mat4.identity()
            .times(Mat4.inverse(program_state.camera_inverse))
            .times(Mat4.translation(1,-0.7,-3))
            .times(Mat4.rotation(-0.5*Math.PI, 0,1,0));
        this.shapes.gun.draw(context, program_state, gun, this.materials.gun);
        //this.shapes.bullet.draw(context, program_state, Mat4.identity(), this.materials.bullet);

        for(let i = 0; i < this.bullet_loc.length; i++){
            this.bullet_loc[i]++;
            let bullet = Mat4.identity()
                .times(Mat4.inverse(program_state.camera_inverse))
                .times(Mat4.translation(1.85,-1-((this.bullet_loc[i]/1000.0)**2)*0.5*9.8*2,-10.5-this.bullet_loc[i]))
                .times(Mat4.rotation(0.5*Math.PI, 1, 0, 0))
                .times(Mat4.scale(0.15, 0.15, 0.2));
            this.shapes.bullet.draw(context, program_state, bullet, this.materials.bullet);
        }
        let i = 0;
        while(i < this.bullet_loc.length){ // replace using collision detection
            if(this.bullet_loc[i] > 50) this.bullet_loc.splice(i,1);
            else i++;
        }
    }
}