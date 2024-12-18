/* global THREE */
import 'OrbitControls'
import dat from 'dat-gui'

import DeformableFace from './deformableface'

import './main.sass'
document.body.innerHTML = require('./main.jade')()


class App {

  constructor() {

    this.animate = this.animate.bind(this)

    this.initScene()
    this.initObjects()

    this.animate()
  }


  initScene() {
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 3000)
    this.camera.position.z = 500

    this.scene = new THREE.Scene()

    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement)

    window.addEventListener('resize', this.onResize.bind(this))
  }


  initObjects() {
    this.face = new DeformableFace()
    this.face.load('media/shutterstock_102487424').then(() => {
      this.face.scale.set(200, 200, 150)
      this.scene.add(this.face)

      let gui = new dat.GUI()
      gui.add(this.face.mesh.material.uniforms.offset, 'value', -10, 10)
      gui.add(this.face.mesh.material.uniforms.amount, 'value', 0, 0.5)
    })
  }


  animate(t) {
    requestAnimationFrame(this.animate)

    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }


  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

}


new App()
