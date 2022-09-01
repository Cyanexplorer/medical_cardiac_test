import * as THREE from "../build/three.module.js";
const opacity_focused = 0.4
const opacity_not_focused = 0.1

let clippingWirePoints = [
    new THREE.Vector2(0.5, 0.5),
    new THREE.Vector2(-0.5, 0.5),
    new THREE.Vector2(-0.5, -0.5),
    new THREE.Vector2(0.5, -0.5),
    new THREE.Vector2(0.5, 0.5)
]

let buildMesh = {
    0: (color) => {
        let geometry = new THREE.PlaneGeometry(1, 1)
        let material = new THREE.MeshBasicMaterial(color);

        return new THREE.Mesh(geometry, material);
    },
    1: (color) => {

        let geometry = new THREE.BufferGeometry().setFromPoints(clippingWirePoints);
        let material = new THREE.LineBasicMaterial(color);

        return new THREE.Line(geometry, material);
    },
}

let adjustDirection = {
    [`${axisXY}`]: (mesh) => {
    },
    [`${axisXZ}`]: (mesh) => {
        mesh.rotateX(-Math.PI / 2)
    },
    [`${axisYZ}`]: (mesh) => {
        mesh.rotateY(Math.PI / 2)
    },
}

var createMarkerMesh = function (axis, color, style) {
    let mesh = buildMesh[style](color)
    adjustDirection[axis](mesh)

    return mesh
}

class SlicerGroup extends THREE.Group {
    constructor(scene, style = 0, size, xyzDims = [1, 1, 1]) {
        super()

        this.scene = scene
        this.planes = []
        this.xyzDims = xyzDims
        this.padding = 0.1

        this.markers = {
            [`${axisXY}`]: {
                "object": null,
                "color": {
                    color: 0x00FF00,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false
                },
                "constant": 0,
                "isClipping": true,
            },
            [`${axisXZ}`]: {
                "object": null,
                "color": {
                    color: 0xFF0000,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false
                },
                "constant": 0,
                "isClipping": true,
            },
            [`${axisYZ}`]: {
                "object": null,
                "color": {
                    color: 0x0000FF,
                    transparent: true,
                    side: THREE.DoubleSide,
                    depthWrite: false
                },
                "constant": 0,
                "isClipping": true,
            }
        }

        let min = new Array(3).fill(-0.5)
        let center = new THREE.Vector3()

        this.initMarker = (style) => {
            let bbox = new THREE.Box3()

            this.markers[axisXY].object = createMarkerMesh(axisXY, this.markers[axisXY].color, style)
            this.markers[axisXZ].object = createMarkerMesh(axisXZ, this.markers[axisXZ].color, style)
            this.markers[axisYZ].object = createMarkerMesh(axisYZ, this.markers[axisYZ].color, style)

            this.scene.add(this.markers[axisXY].object)
            this.scene.add(this.markers[axisXZ].object)
            this.scene.add(this.markers[axisYZ].object)

            this.invert = () => {
                for (let mesh of this.children) {
                    for (let plane of mesh.material.clippingPlanes) {
                        plane.normal.multiplyScalar(-1)
                    }
                }
            }

            //重置切片位置
            this.reset = () => {
                let ivt = 0
                for (let g = 0; g < this.groupSize; g++) {
                    if (g % 2 == 0) {
                        ivt = 0
                    } else {
                        ivt = 1
                    }

                    this.setIndexRatio(axisXY, ivt, g)
                    this.setIndexRatio(axisXZ, ivt, g)
                    this.setIndexRatio(axisYZ, ivt, g)
                }
            }

            //重置切片大小
            this.resize = (dims, style, clipping) => {

                let size = new THREE.Vector3()
                bbox.setFromObject(this)
                bbox.getSize(size)
                bbox.getCenter(center)

                bbox.min.toArray(min)

                size.toArray(this.xyzDims)

                this.markers[axisXY].object.scale.set(size.x, size.y, 1)
                this.markers[axisXY].object.translateX(center.x)
                this.markers[axisXY].object.translateY(center.y)
                this.markers[axisXZ].object.scale.set(size.x, size.z, 1)
                this.markers[axisXZ].object.translateX(center.x)
                this.markers[axisXZ].object.translateZ(center.z)
                this.markers[axisYZ].object.scale.set(size.z, size.y, 1)
                this.markers[axisYZ].object.translateY(center.y)
                this.markers[axisYZ].object.translateZ(center.z)

                if (clipping == null) {
                    return
                } else if (clipping.length == 1) {
                    this.setClipping(axisXZ, clipping[axisXZ])
                } else if (clipping.length == 3) {
                    this.setClipping(axisXY, clipping[axisXY])
                    this.setClipping(axisXZ, clipping[axisXZ])
                    this.setClipping(axisYZ, clipping[axisYZ])
                }

            }

            this.resize()
            this.reset()
        }

        let markerPlane = new Array(3)

        this.updatePlane = (marker, axis, group = 0) => {

            //設置正反面
            let s = group % 2 == 0 ? 1 : -1;

            if(!this.planeGroup(group, markerPlane))
                return

            if (marker.isClipping) {
                markerPlane[axis].constant = marker.constant * s;
            } else {
                //if the clipping plane is disable, move it to the edge of axis
                markerPlane[axis].constant = (this.xyzDims[axis] + min[axis]) * s;
            }
        }

        let setIndexActions = {
            [`${axisXY}`]: (index) => {
                //console.log(this.xyzDims[2] / 2, index)
                index = this.xyzDims[2] + min[2] - index
                let marker = this.markers[axisXY]
                marker.object.position.set(0, 0, index)
                marker.constant = index;
    
                return marker
            },
            [`${axisXZ}`]: (index) => {
                index = this.xyzDims[1] + min[1] - index
                let marker = this.markers[axisXZ]
                marker.object.position.set(0, index, 0)
                marker.constant = index;
    
                return marker
            },
            [`${axisYZ}`]: (index) => {
                index = this.xyzDims[0] + min[0] - index
                let marker = this.markers[axisYZ]
                marker.object.position.set(index, 0, 0)
                marker.constant = index;
    
                return marker
            }
        }
    
        let ratio2index = {
            [`${axisXY}`]: (ratio) => {
                return (this.xyzDims[2] + this.padding * 2) * ratio
            },
            [`${axisXZ}`]: (ratio) => {
                return (this.xyzDims[1] + this.padding * 2) * ratio
            },
            [`${axisYZ}`]: (ratio) => {
                return (this.xyzDims[0] + this.padding * 2) * ratio
            }
        }
    
        this.setIndex = (axis, index, group = 0) => {
            let marker = setIndexActions[axis](index)
            this.updatePlane(marker, axis, group)
        }
    
        //move markers and clipping plane to the definite position which corresponding to the current showing dicom image
        this.setIndexRatio = (axis, ratio, group = 0) => {
            let index = ratio2index[axis](ratio) - this.padding
            this.setIndex(axis, index, group)
        }


        this.initMarker(style)
    }

    

    onFocus(axis, option) {
        if (option) {
            this.markers[axis].object.material.opacity = opacity_focused
            this.markers[axis].object.material.visible = true
        } else {
            this.markers[axis].object.material.opacity = opacity_not_focused
            this.markers[axis].object.material.visible = false
        }
    }

    //tell markers the clipping object
    add(mesh) {

        let meshes = this.children
        for (let i = 0; i < meshes.length; i++) {
            if (mesh.id == meshes[i].id) {
                console.log('SlicerControl: model exist')
                return
            }
        }

        mesh.material.clippingPlanes = this.planes

        super.add(mesh)

        this.resize()
    }

    get groupSize() {
        return this.planes.length / 3
    }

    //新增切片
    addPlane = () => {
        let s = this.groupSize % 2 == 0 ? -1 : 1

        let subplanes = [
            new THREE.Plane(new THREE.Vector3(0, s, 0), 0),
            new THREE.Plane(new THREE.Vector3(0, 0, s), 0),
            new THREE.Plane(new THREE.Vector3(s, 0, 0), 0)
        ]

        this.planes.push(...subplanes)
    }

    removePlane = () => {
        this.planes.pop()
        this.planes.pop()
        this.planes.pop()
    }

    setVisable(axis, option) {
        //option: true / false
        //axis: slicerXY/XZ/YZ
        this.markers[axis].object.visible = option
    }

    setVisableAll(option) {
        for (var i = 0; i < 3; i++) {
            this.setVisable(i, option)
        }
    }

    setClipping(axis, option) {
        //option: true / false
        //axis: slicerXY/XZ/YZ

        let marker = this.markers[axis]
        marker.isClipping = option
        this.updatePlane(marker, axis)
    }

    setClippingeAll(option) {
        for (let i = 0; i < 3; i++) {
            this.setClipping(i, option)
        }
    }

    updateAll() {

        this.updatePlane(this.markers[axisYZ], axisYZ)
        this.updatePlane(this.markers[axisXZ], axisXZ)
        this.updatePlane(this.markers[axisXY], axisXY)
    }

    planeGroup(group, vector3) {
        let index = group * 3;

        if(this.planes.length < index + 3)
            return false

        vector3[axisXZ] = this.planes[index]
        vector3[axisXY] = this.planes[index + 1]
        vector3[axisYZ] = this.planes[index + 2]

        return true
    }
}



export { SlicerGroup };
