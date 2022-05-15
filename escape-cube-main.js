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
        };
        const bump = new defs.Fake_Bump_Map(1);

        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            wall: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.6, diffusivity: 0.1, specularity: 0.3,
                texture: new Texture("assets/brick-wall.jpeg")
            }),
            floor: new Material(bump, {
                color: hex_color("#000000"),
                ambient: 0.3, diffusivity: 0, specularity: 0.3,
                texture: new Texture("assets/brick-wall.jpeg")
            })
        };

        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 12), vec3(0, 0, 0), vec3(0, 1, 1));
    }

    make_control_panel() {

    }

    display(context, program_state){
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;

        const light_position = vec4(0, 0, 0, 1);
        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        let model_transform = Mat4.identity()
            .times(Mat4.translation(-8, 0 ,0))
            .times(Mat4.scale(0.2, 8, 15));

        this.shapes.wall.draw(context, program_state, model_transform, this.materials.wall);

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
    }
}