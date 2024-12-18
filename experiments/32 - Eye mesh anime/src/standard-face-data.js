/* global THREE */

import _ from 'lodash'
import {vec2, vec3} from 'gl-matrix'

let original = null

export default class StandardFaceData {

  constructor() {
    if (original == null) {
      this.init()
    }
    
    this.data = original.data // shared with all instances

    this.index = original.indexAttribute.clone()
    this.mouthIncludedIndex = original.mouthIncludedIndexAttribute.clone()
    this.position = original.positionAttribute.clone()
    this.uv = original.uvAttribute.clone()

    this.faceEyeIndex = original.faceEyeIndex

    this.bounds = _.clone(original.bounds)
    this.size = _.clone(original.size)
  }


  init() {
    let data = require('./data/face2.json')

    let eyemouth = require('./data/eyemouth.json')
    for (let i = 0; i < eyemouth.vertices.length; i += 3) {
      eyemouth.vertices[i + 2] += 40 / 150
    }
    let offset = data.face.position.length / 3
    eyemouth.index = []
    let hoge = data.rightEye.index.concat(data.leftEye.index)
    for (let i = 0, j = 0; i < eyemouth.faces.length; i += 7, j += 3) {
      let i0 = eyemouth.faces[i + 1]
      if (eyemouth.vertices[i0 * 3 + 1] > 0) { // eye only
        eyemouth.index.push(
          i0 + offset,
          eyemouth.faces[i + 2] + offset,
          eyemouth.faces[i + 3] + offset,
        )
      }
    }
    let faceEyeIndex = eyemouth.index.map((i) => {
      let i0 = i - offset
      let v = eyemouth.vertices.slice(i0 * 3, i0 * 3 + 3)
      let ii = this.findNearestIndex(data, v)
      return [ii, i]
    })

    let index = data.face.index.concat(eyemouth.index)
    let indexAttribute = new THREE.Uint16Attribute(index, 1)
    let mouthIncludedIndexAttribute = new THREE.Uint16Attribute(index.concat(data.mouth.index), 1)
    let positionAttribute = new THREE.Float32Attribute(data.face.position.concat(eyemouth.vertices), 3)

    let min = [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE]
    let max = [Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE]
    let position = data.face.position
    let n = position.length
    for (let i = 0; i < n; i += 3) {
      let p = [position[i], position[i + 1], position[i + 2]]
      vec3.min(min, min, p)
      vec3.max(max, max, p)
    }
    let bounds = {min, max, size: vec3.sub([], max, min), center: vec3.lerp([], min, max, 0.5)}
    let size = vec2.len(bounds.size)

    original = {data, indexAttribute, mouthIncludedIndexAttribute, positionAttribute, uvAttribute: this.initUV(data), bounds, size, faceEyeIndex}

    data.back.edgeIndex = _.uniq(data.back.index).map((index) => {
      let v = this.getVertex(index)
      v.push(Math.atan2(v[1], v[0]), index)
      return v
    }).sort((a, b) => a[3] - b[3]).map((v) => v[4])
  }


  findNearestIndex(data, vertex) {
    let distance = Number.MAX_VALUE
    let index = 0
    for (let i = 0; i < data.face.position.length; i += 3) {
      let d = vec3.distance(vertex, data.face.position.slice(i, i + 3))
      if (d < distance) {
        index = i / 3
        distance = d
      }
    }
    return index
  }


  initUV(data) {
    let vertices = []
    let texCoords = []
    let v2vt = []
    require('raw!./data/face-uv.obj').split(/\n/).forEach((line) => {
      let tokens = line.split(' ')
      let type = tokens.shift()
      switch (type) {
        case 'v':
          vertices.push(tokens.map((v) => parseFloat(v)))
          break
        case 'vt':
          texCoords.push(tokens.map((v) => parseFloat((v))))
          break
        case 'f':
          tokens.forEach((pair) => {
            pair = pair.split('/').map((v) => parseInt(v) - 1)
            v2vt[pair[0]] = pair[1]
          })
          break
      }
    })
    const OFFSET = 40 / 150
    vertices.forEach((v) => v[2] += OFFSET)

    let getUVForVertex = (v) => {
      let min = Number.MAX_VALUE
      let index
      for (let i = 0; i < vertices.length; i++) {
        let d = vec3.distance(v, vertices[i])
        if (d < min) {
          min = d
          index = i
        }
      }
      return texCoords[v2vt[index]]
    }

    let uvs = []
    let position = data.face.position
    for (let i = 0; i < position.length; i += 3) {
      let uv = getUVForVertex(position.slice(i, i + 3))
      uvs.push(uv[0], uv[1])
    }
    return new THREE.Float32Attribute(uvs, 2)
  }


  getFeatureVertex(index) {
    let i = original.data.face.featurePoint[index] * 3
    let p = original.data.face.position
    return [p[i], p[i + 1], p[i + 2]]
  }


  getVertex(index) {
    let i = index * 3
    let p = original.data.face.position
    return [p[i], p[i + 1], p[i + 2]]
  }
 
}
