import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

// Default class to import shape from 3d file
export class Shape_From_File extends Shape {
                                    // **Shape_From_File** is a versatile standalone Shape that imports
                                    // all its arrays' data from an .obj 3D model file.
    constructor( filename )
    { super( "position", "normal", "texture_coord" );
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file( filename );
    }
    load_file( filename )
    {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch( filename )
            .then( response =>
            { if ( response.ok )  return Promise.resolve( response.text() )
            else                return Promise.reject ( response.status )
            })
            .then( obj_file_contents => this.parse_into_mesh( obj_file_contents ) )
            .catch( error => { this.copy_onto_graphics_card( this.gl ); } )
    }
    parse_into_mesh( data )
    {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];        unpacked.norms = [];    unpacked.textures = [];
        unpacked.hashindices = {};  unpacked.indices = [];  unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;    var NORMAL_RE = /^vn\s/;    var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;      var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if      (VERTEX_RE.test(line))   verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line))   vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line))  textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++)
                {
                    if(j === 3 && !quad) {  j = 2;  quad = true;  }
                    if(elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else
                    {
                        var vertex = elements[ j ].split( '/' );

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length)
                        {   unpacked.textures.push(+textures[( (vertex[1] - 1)||vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[( (vertex[1] - 1)||vertex[0]) * 2 + 1]);  }

                        unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[( (vertex[2] - 1)||vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if(j === 3 && quad)   unpacked.indices.push( unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const { verts, norms, textures } = unpacked;
            for( var j = 0; j < verts.length/3; j++ )
            {
                this.arrays.position     .push( vec3( verts[ 3*j ], verts[ 3*j + 1 ], verts[ 3*j + 2 ] ) );
                this.arrays.normal       .push( vec3( norms[ 3*j ], norms[ 3*j + 1 ], norms[ 3*j + 2 ] ) );
                this.arrays.texture_coord.push( vec( textures[ 2*j ], textures[ 2*j + 1 ] ) );
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions( false );
        this.ready = true;
    }
    draw( context, program_state, model_transform, material )
    {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if( this.ready )
            super.draw( context, program_state, model_transform, material );
    }
}

export class EscapeCubeMain extends Scene {
    constructor() {
        super();

        this.shapes = {
            torus: new defs.Torus(15, 15),
            wall: new defs.Cube(),
            light: new defs.Cube(),
            fire: new Shape_From_File("assets/fire.obj"),
            torch: new Shape_From_File("assets/Torch/Torch.obj")
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
            // light: new Material(bump, {
            //     ambient: 0.8, diffusivity: 0, specularity: 0,
            //     color: hex_color("#000000"),
            //     texture: new Texture("assets/flame.png"),
            // }),
            // fire: new Material(new defs.Textured_Phong(1), {
            //     ambient: 0.8, diffusivity: 0, specularity: 0,
            //     color: hex_color("#000000"),
            //     texture: new Texture("assets/flame.png"),
            // }),
            torch: new Material(new defs.Textured_Phong(1), {
                ambient: 0.8, diffusivity: 0, specularity: 0,
                color: hex_color("#000000"),
                texture: new Texture("assets/Torch/VRayMtl1SG_Base_Color copy.jpg"),}),
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

        // let light_model_transform = model_transform.times(Mat4.scale(0.2,0.2,0.2));
        // this.shapes.light.draw(context, program_state, light_model_transform, this.materials.light);

        // model_transform = Mat4.identity()
        //     .times(Mat4.translation(-7, 4, 2));
        // this.shapes.fire.draw(context, program_state, model_transform, this.materials.fire);

        let head_model_transform = Mat4.identity();
        this.shapes.torch.draw(context, program_state, head_model_transform, this.materials.torch);
    }
}