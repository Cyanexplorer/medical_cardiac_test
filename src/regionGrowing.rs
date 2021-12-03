extern crate cfg_if;
extern crate wasm_bindgen;
extern crate js_sys;

mod error_log;

use std::f32;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(a: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

static dir: [[i8; 3]; 6] = [
	[ 0, 1, 0 ],
	//{ x: 1, y: 1, z: 0 },
	[ 1, 0, 0 ],
	[ 0, -1, 0 ],
	//{ x: -1, y: -1, z: 0 },
	[ -1, 0, 0 ],
	//{ x: 1, y: -1, z: 0 },
	//{ x: -1, y: 1, z: 0 },
	[ 0, 0, -1 ],
	[ 0, 0, 1 ]
];

#[wasm_bindgen]
pub struct MarchingCubes {
    dims: [u32; 3],
    volume: Vec<u8>,
    mask: Vec<u8>,
    visit: Vec<u8>
	stack: Vec<[i8;4]>
}

#[wasm_bindgen]
impl MarchingCubes {
    pub fn new() -> MarchingCubes {
        MarchingCubes {
            dims: [0, 0, 0],
            volume: Vec::new(),
            mask: Vec::new(),
            visit: Vec::new(),
            stack: Vec::new()
        }
    }

    pub fn set_volume(&mut self, volume: Vec<u8>, dims_u: u32, dims_v: u32, dims_d: u32) {
        self.volume = volume;
        self.dims[0] = dims_u;
        self.dims[1] = dims_v;
        self.dims[2] = dims_d;

        let capacity = dims_u * dims_v * dims_d;
        self.mask = Vec::with_capacity(capacity);
        self.visit = Vec::with_capacity(capacity);
    }
     
    // Run the Marching Cubes algorithm on the volume to compute
    // the isosurface at the desired value, and return a reference to the triangle data to JS
    pub fn region_growing(&mut self, index_x : u32, index_y : u32, index_z : u32, bias : u32) -> js_sys::Float32Array {
		//let segBuffer = bufferLoader(axisUV, dims, segData, layerIndex)
		let target = volume[index_z * dims_v * dims_u + index_y * dims_u + index_x];
		let upperBound = target + bias;
		let lowerBound = target - bias;
        self.stack.push([ index_x, index_y, index_z, -1 ]);
		//console.log(dims)
		while (stack.length != 0) {

			let coordinate = stack.pop();
			let x = coordinate.x;
			let y = coordinate.y;
			let z = coordinate.z;
			
			if (x < 0 || y < 0 || z < 0 || x >= self.dims[0] || y >= self.dims[1] || z >= self.dims[2]) {;
				continue;
			}
			
			let index = z * self.dims[1] * self.dims[0] + y * self.dims[0] + x;
			if (self.visit[index] == 1) {
				continue;
			}

			let current = self.volume[index];
			if (current > upperBound || current < lowerBound) {
				continue;
			}
			self.mask[index] = 255;
			self.visit[index] = 1;

			let dir = coordinate.dir;

			self.dir.forEach((d, index) => {
				if (dir == index) {
					return;
                }
				self.stack.push({ x: x + d.x, y: y + d.y, z: z + d.z, dir: index });
			})
		}

		//
        unsafe { js_sys::Uint8Array::view(&self.mask[..]) }
    }
}

