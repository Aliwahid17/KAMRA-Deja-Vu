import Detector from 'Detector'
import loader from './asset-loader'
import LoadingBar from './loading-bar'

if (!Detector.canvas || !Detector.webgl || !Detector.workers || !Detector.fileapi
  || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
  // No supported devices
  location.href = 'sp'
}

loader.on('weighted progress', (event) => {
  let rate = event.progress / event.total
  LoadingBar.update(rate * 0.95) // Estimate final worker task
})
loader.on('complete', () => {
  console.timeEnd('asset loading')
})
loader.load()
console.time('asset loading')

window.__djv_loader = loader
window.__djv_loadingBar = LoadingBar
