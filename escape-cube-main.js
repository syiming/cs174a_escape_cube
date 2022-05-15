import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

export class EscapeCubeMain extends Scene {
    constructor() {
        super();

        this.shapes = {
            torus: new defs.Torus(15, 15),
            wall: new defs.Cube(),
            light: new defs.Subdivision_Sphere(4),
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
        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 12), vec3(0, 0, 0), vec3(0, 1, 1));
        this.current_camera_location = this.initial_camera_location;
        this.update = false;
        this.init = false;
    }

    make_control_panel() {
        this.key_triggered_button("forward", ["w"], () => {
            this.current_camera_location = this.current_camera_location.times(Mat4.translation(0,0,1));
            this.update = true;
        }, undefined, () => {this.update = false;});

        this.key_triggered_button("backward", ["s"], () => {
            if (this.current_camera_location.times(vec4(0,0,0,1))[2] < -13) return;
            console.log(this.current_camera_location.times(vec4(0,0,0,1)));
            this.current_camera_location = this.current_camera_location.times(Mat4.translation(0,0,-1));
            this.update = true;
        },undefined, () => {this.update = false;})
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
            new Light(vec4(-6, 4.5, 2.5, 1), color(1, redness, 0, 1), 30)
        ];
        let model_transform = Mat4.identity()
            .times(Mat4.translation(-8, 0 ,0))
            .times(Mat4.scale(0.2, 8, 15));

        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        program_state.lights = [
            new Light(vec4(6, 4.5, 2.5, 1), color(1, redness, 0, 1), 30)
        ];
        model_transform = Mat4.identity()
            .times(Mat4.translation(8, 0 ,0))
            .times(Mat4.scale(0.2, 8, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 0 ,15))
            .times(Mat4.scale(8, 8, 0.2));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, -8 ,0))
            .times(Mat4.scale(8, 0.2, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.floor);

        model_transform = Mat4.identity()
            .times(Mat4.translation(0, 8 ,0))
            .times(Mat4.scale(8, 0.2, 15));
        this.shapes.wall.draw(context, program_state, model_transform, this.materials.test);

        model_transform = Mat4.identity()
            .times(Mat4.translation(7, 4, 2));

        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness, 0, 1), ambient: redness}));

        model_transform = Mat4.identity()
            .times(Mat4.translation(-7, 4, 2));

        this.shapes.light.draw(context, program_state, model_transform, this.materials.light.override({color: color(1, redness, 0, 1), ambient: redness}));
    }
}