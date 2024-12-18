/* global ga */

import $ from 'jquery'
import _ from 'lodash'
import i18n from 'i18next-client'
// import i18nextJquery from 'i18next-jquery'
import jqueryI18next from 'jquery-i18next'
import Modernizr from 'exports?Modernizr!modernizr-custom'
import StateMachine from 'javascript-state-machine'

import Config from './config'
import Ticker from './ticker'
import PreprocessWorker from 'worker!./preprocess-worker'
import App from './app'
import WebcamManager from './webcam-manager'
import FaceDetector from './face-detector'
import ShareUtil from './share-util'
import BgmManager from './bgm-manager'
import GaUtil from './ga-util'


if (Config.DEV_MODE) {
  $('head').append(`<script async src='/browser-sync/browser-sync-client.2.10.0.js'><\/script>`)
}

const loader = window.__djv_loader
loader.on('complete', () => new PageManager())


class PageManager {

  constructor() {
    this.initStates()
    this.initPages()
    this.initUploads()
    this.initLocales()
    this.initAnalytics()
    this.initAboutMenu()

    Ticker.start()

    this.preprocessKeyframes()
  }


  initStates() {
    this.fsm = StateMachine.create({
      initial: 'loadAssets',
      events: [
        {name: 'loadComplete', from: 'loadAssets', to: 'top'},

        {name: 'selectWebcam', from: ['top', 'about', 'howto'], to: 'webcam1'},
        {name: 'webcamOK', from: 'webcam1', to: 'webcam2'},
        
        {name: 'selectUpload', from: ['top', 'about', 'howto'], to: 'upload1'},
        {name: 'skip', from: 'upload1', to: 'upload2'},
        {name: 'fileSelected', from: 'upload2', to: 'upload2process'},
        {name: 'detected', from: 'upload2process', to: 'upload3'},
        {name: 'failed', from: 'upload2process', to: 'uploaderror'},
        {name: 'retry', from: ['upload3', 'uploaderror'], to: 'upload2'},

        {name: 'start', from: ['top', 'webcam2', 'upload3', 'about', 'howto'], to: 'playing'},
        {name: 'playCompleted', from: 'playing', to: 'share'},
        {name: 'goAbout', from: 'top', to: 'about'},
        {name: 'goHowto', from: 'top', to: 'howto'},
        {name: 'goTop', from: ['webcam1', 'upload2', 'uploaderror', 'about', 'howto', 'share'], to: 'top'},
      ],
      callbacks: {
        onenterstate:(event, from, to) => {
          GaUtil.pageView(to)
        },
        onleaveloadAssets: () => {
          $({progress:0.95}).animate({progress:1.0},{
            duration:500,
            step:(s) => {
              window.__djv_loadingBar.update(s)
            }
          })
          $('#loading').fadeOut(1000, () => {
            this.app = new App(this.keyframes)
            this.app.on('complete', this.fsm.playCompleted.bind(this.fsm))
            this.fsm.transition()
          })
          return StateMachine.ASYNC
        },
        // top
        onentertop: () => {
          $('#canvas-clip').removeClass('blur')
          if (loader.getResult('shared-data')) {
            $('#top .play_buttons, .link_disclaimer').hide()
            $('#top .play-shared').show()
            this.app.prepareForImage(
              loader.getResult('shared-image'),
              loader.getResult('shared-data').points
            )
          }
          $('#top').delay(500).fadeIn(1000)
          BgmManager.play('data/intro')
        },
        onleavetop: (event, from, to) => {
          if (to == 'playing') {
            $('#top').stop().fadeOut(1000, () => {
              this.fsm.transition()
            })
            return StateMachine.ASYNC
          }
        },


        // webcam
        onbeforeselectWebcam: () => {
          $('#top').stop().fadeOut(1000)
          return StateMachine.ASYNC
        },
        onenterwebcam1: () => {
          $('#canvas-clip').addClass('blur')
          $('#webcam-step1').fadeIn(1000)
          WebcamManager.start(() => {
            this.fsm.webcamOK()
          }, () => {
            $('#canvas-clip').removeClass('blur')
            this.fsm.goTop()
          })
        },
        onleavewebcam1: () => {
          $('#webcam-step1').stop().fadeOut(1000, () => {
            this.fsm.transition()
          })
          return StateMachine.ASYNC
        },
        onenterwebcam2: () => {
          $('#webcam-step2').css({display: 'flex'}).hide().fadeIn(1000)
        },
        onleavewebcam2: () => {
          $('#canvas-clip').removeClass('blur')
          $('#webcam-step2').stop().fadeOut(1000, () => {
            this.fsm.transition()
          })
          return StateMachine.ASYNC
        },

        // upload
        onbeforeselectUpload: () => {
          $('#top').stop().fadeOut(1000)
        },
        onenterupload1: () => {
          $('#canvas-clip').addClass('blur')
          $('#upload-step1').css({display: 'flex'}).hide().fadeIn(1000)
        },
        onleaveupload1: () => {
          $('#upload-step1').stop().fadeOut(1000, () => {
            this.fsm.transition()
          })
          return StateMachine.ASYNC
        },
        onenterupload2: () => {
          $('#canvas-clip').addClass('blur')
          $('#upload-step2').css({display: 'flex'}).hide().fadeIn(1000)
        },
        onleaveupload2: () => {
          $('#upload-step2').stop().fadeOut(1000)
        },
        onenterupload2process: (e, f, t, file) => {
          this.processImageFile(file)
        },
        onenterupload3: () => {
          $('#canvas-clip').removeClass('blur')
          $('#upload-step3').css({display: 'flex'}).hide().fadeIn(1000)
        },
        onleaveupload3: (e, f, to) => {
          if (to == 'upload2') {
            this.app.clearImage()
          }
          $('#upload-step3').stop().fadeOut(1000, () => {
            this.fsm.transition()
          })
          return StateMachine.ASYNC
        },
        onenteruploaderror: () => {
          $('#canvas-clip').addClass('blur')
          $('#upload-error').css({display: 'flex'}).hide().fadeIn(1000)
        },
        onleaveuploaderror: (e, f, to) => {
          if (to == 'upload2') {
            $('#upload-error').fadeOut(1000, () => {
              this.fsm.transition()
            })
            return StateMachine.ASYNC
          } else {
            $('#upload-error').fadeOut(1000)
          }
        },

        // about
        onenterabout: () => {
          $('#about').fadeIn(1000)
          $('#top,#canvas-clip').addClass('blur')
        },
        onleaveabout: (event, from, to) => {
          $('#about').fadeOut(1000)
          $('#top,#canvas-clip').removeClass('blur')
          if (to == 'playing') {
            $('#top').stop().fadeOut(1000, () => {
              this.fsm.transition()
            })
            return StateMachine.ASYNC
          }
        },
        // howto
        onenterhowto: () => {
          $('#howto').fadeIn(1000)
          $('#top,#canvas-clip').addClass('blur')
        },
        onleavehowto: (event, from, to) => {
          $('#howto').fadeOut(1000)
          $('#top,#canvas-clip').removeClass('blur')
          if (to == 'playing') {
            $('#top').stop().fadeOut(1000, () => {
              this.fsm.transition()
            })
            return StateMachine.ASYNC
          }
        },

        // play
        onenterplaying: (e, f, t, ...args) => {
          BgmManager.stop()
          this.app.start(...args)
        },
        
        // share
        onentershare: (e, f, t, shareURL) => {
          if (loader.getResult('shared-data')) {
            GaUtil.sendEvent('End_Share')
          } else {
            switch (this.app.sourceType) {
              case 'webcam':
                GaUtil.sendEvent('End_Webcam')
                break
              case 'uploaded':
                GaUtil.sendEvent('End_Photo')
                break
              case 'video':
                GaUtil.sendEvent('End_Preset')
                break
            }
          }
          let text = loader.getResult('shared-data') ? $.t('social.share_text2') : $.t('social.share_text')
          this.setupShareButtons('#share .button-twitter', '#share .button-facebook', text, shareURL || location.href)
          $('#share .button-replay').click((e) => {
            e.preventDefault()
            location.href = shareURL || location.href
          })
          $('#share').fadeIn(1000)
        },
        onleaveshare: () => {
          $('#share').fadeOut(1000, () => {
            this.fsm.transition()
          })
          return StateMachine.ASYNC
        },
      },
      // error: (eventName, from, to, args, errorCode, errorMessage) => {
      //   console.warn(eventName, from, to, args, errorCode, errorMessage)
      //   // if (Config.DEV_MODE) debugger
      // }
    })
  }


  initPages() {
    let data = require('./page/data.json')
    let pages = ['top', 'webcam', 'upload', 'about', 'howto', 'share']
    pages.forEach((name) => $('#page').append(require(`./page/includes/${name}.jade`)(data)))

    if (Modernizr.getusermedia) {
      $('.with-webcam').click(() => this.fsm.selectWebcam())
    } else {
      $('.with-webcam').addClass('inactive')
    }
    $('.with-photo').click(() => this.fsm.selectUpload())
    $('.without-webcam').click(() => this.fsm.start('video'))

    $('#top .play-shared button').click(() => this.fsm.start('shared', loader.getResult('shared-data').remapType))

    $('#webcam-step2 button.skip').click(() => this.fsm.start('webcam'))

    $('#upload-step1 button.skip').click(() => this.fsm.skip())
    $('#upload-step2 button.home').click(() => this.fsm.goTop())
    $('#upload-step3 button.ok').click(() => this.fsm.start('uploaded'))
    $('#upload-step3 button.retry').click(() => this.fsm.retry())
    $('#upload-error button.button-replay').click(() => this.fsm.retry())
    $('#upload-error button.button-top').click(() => this.fsm.goTop())

    $('.button-top').click(() => location.href = '')
    $('a[href="#about"]').click((e) => {
      e.preventDefault()
      this.fsm.goAbout()
    })
    $('a[href="#howto"]').click((e) => {
      e.preventDefault()
      this.fsm.goHowto()
    })
    $('a[href="#disclaimer"]').click((e) => {
      e.preventDefault()
      this.fsm.goHowto()
      let target = $('#howto .mask')
      let pos = $('#disclaimer').offset().top - 200
      target.scrollTop(pos + target.scrollTop()) // adjustment scroll position
    })
    $('button.close').click((e) => {
      e.preventDefault()
      this.fsm.goTop()
    })

    // smooth scroll
    $('#credit a[href=#femm]').click((e) => {
      // Credit FEMM link
      e.preventDefault()
      this.fsm.start('video')
    })
  }


  initUploads() {
    let button = $('#upload-step2 .drop-area')
    let file = $('#upload-step2 .image-file')

    button.on('click', () => file.click())
    file.on('change', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.fsm.fileSelected(file[0].files[0])
    })
    window.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'copy'
    }, false)
    window.addEventListener('drop', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.fsm.fileSelected(e.dataTransfer.files[0])
    })
  }


  initLocales() {
    // localise
    jqueryI18next.init(i18n, $, {
      tName: 't',
      i18nName: 'i18n',
      handleName: 'localize',
      selectorAttr: 'data-i18n',
      targetAttr: 'i18n-target',
      optionsAttr: 'i18n-options',
      useOptionsAttr: false,
      parseDefaultValueFromContent: true
    })
    $.i18n.init({
      lng: (() => {
        if (Config.DEV_MODE || location.search.startsWith('?setLng')) {
          return ''
        }
        return (navigator.browserLanguage || navigator.language || navigator.userLanguage).substr(0, 2) == 'ja' ? 'ja' : 'en'
      })(),
      debug: Config.DEV_MODE
    }, () => {
      $('html').addClass($.i18n.lng())
      $('#about,#howto,#webcam-step1,#upload-step1,#upload-step3,#upload-error,.top_button,#canvas-clip').localize()
      $('img.i18n').localize()
      let imgs = $('img.i18n')
      imgs.each(function() {
        let img = $(this)
        img.attr('src', img.text()) // localize img src
      })
      this.setupShareButtons('a.button_twitter', 'a.button_facebook', $.t('social.top_text'), $.t('social.url'))
    })
  }


  setupShareButtons(twitter, facebook, text, url) {
    $(twitter).click((e) => {
      e.preventDefault()
      ShareUtil.twitter({
        text,
        url,
        hashtags: 'KAMRA',
      })
    })
    $(facebook).click((e) => {
      e.preventDefault()
      ShareUtil.facebook({
        app_id: '1487444688252775',
        href: url,
        redirect_uri: 'https://kamra.invisi-dir.com/#shared',
      })
    })
  }


  initAnalytics() {
    GaUtil.sendEvent('Load_Complete')
    GaUtil.clickEvents({
      // Top
      'button.with-webcam':'Play_Webcam',
      'button.with-photo':'Play_Photo',
      'button.without-webcam':'Play_Preset',
      '.link_disclaimer':'Click_Term',
      //
      '.link_itunes':'Album_iTunes',
      '.link_amazon':'Album_Amazon',
      '.link_cdbaby':'Album_CDBaby',
      // Top nav
      'a.nav_home':'Navi_Home',
      'a.nav_about':'Navi_About',
      'a.nav_howto':'Navi_Howto',
      'a.button_twitter':'Share_TW',
      'a.button_facebook':'Share_FB',
      // Upload
      '#upload-step3 button.ok':'Upload_OK',
      '#upload-step3 button.retry':'Upload_Retry',
      // About
      '.link_kamra_soundcloud':'KAMRA_SoundCloud',
      '.link_kamra_tw':'KAMRA_TW',
      '.link_invisidir':'Link_invisi-dir',
      '.link_invisi':'Link_invisi',
      // Share
      '#share button.button-twitter':'ShareOwn_TW',
      '#share button.button-facebook':'ShareOwn_FB',
      '#share button.button-top':'Back_Home',
      '#share button.button-replay':'Back_Retry',
      // Landing
      '.play-shared button':'Play_Share'
    })

    // send credit link
    $('.credit a.link_credit').click((e) => {
      let info = e.target.parentElement
      let name = info.querySelector('.name')
      ga('send', 'event', 'button', 'click', `Credit_${name.innerText}`)
    })
  }


  initAboutMenu() {
    let aboutNavs = $('#about .navi a')
    let scrollArea = $('#about .mask')
    let links = $('#concept,#album,#kamra,#credit')

    aboutNavs.click(function(e) {
      e.preventDefault()
      aboutNavs.removeClass('selected')
      $(this).addClass('selected')
      let href = $(this).attr('href')
      let pos = $(href == '#' || href == '' ? 'html' : href).offset().top - 100
      scrollArea.animate({scrollTop:pos + scrollArea.scrollTop()}, 500, 'swing')
    })

    scrollArea.on('scroll', () => {
      let selected = -1
      links.each((i, link) => {
        let pos = $(link).offset().top + 300
        if (selected < 0 && pos > 0) {
          selected = i
        }
      })
      if (selected >= 0) {
        aboutNavs.removeClass('selected')
        $(aboutNavs[selected]).addClass('selected')
      }
    })
  }


  preprocessKeyframes() {
    this.keyframes = this.decodeKeyframes()
    // console.log(this.keyframes)

    console.time('morph data processing')
    let worker = new PreprocessWorker()

    let targetObject = [
      this.keyframes.user.property,
      this.keyframes.user_alt.property[0],
      this.keyframes.user_alt.property[1],
      this.keyframes.slice_alt.property,
      {
        vertices: Config.DATA.user_particles_mesh.map((prop) => {
          return new Float32Array(prop.face_vertices.concat(prop.eyemouth_vertices))
        })
      }
    ]
    .concat(this.keyframes.user_children.property.map((props) => props))
    .concat(this.keyframes.falling_children_mesh.property.map((props) => props))

    let transferList = []
    let objectVertices = targetObject.map((obj) => {
      return obj.vertices.map((v) => {
        if (v) {
          transferList.push(v.buffer)
          return v
        }
        return null
      })
    })
    Config.DATA.user_particles_mesh = targetObject[4]

    worker.postMessage(objectVertices, transferList)
    worker.onmessage = (event) => {
      event.data.forEach((morph, i) => {
        targetObject[i].morph = morph
      })
      console.timeEnd('morph data processing')
      this.fsm.loadComplete()
    }
  }


  decodeKeyframes() {
    console.time('decode')
    let buffer = loader.getResult('keyframes')
    let info = loader.getResult('keyframeinfo')
    let toBeProcessed = [info]
    while (toBeProcessed.length) {
      let obj = toBeProcessed.pop()
      _.forEach(obj, (v, k) => {
        if (v && typeof(v['min']) == 'number') {
          obj[k] = this.prepareDataFor(v, buffer)
        } else {
          toBeProcessed.push(v)
        }
      })
    }
    console.timeEnd('decode')
    return info
  }


  prepareDataFor(prop, buffer) {
    let encoded = new Uint16Array(buffer, prop.offset * 2, prop.length)
    let values = new Float32Array(prop.length)
    for (let i = 0; i < prop.length; i++) {
      values[i] = encoded[i] / 0xffff * (prop.max - prop.min) + prop.min
    }
    return values
  }


  processImageFile(file) {
    this.readAsDataURL(file).then((url) => {
      let image = new Image()
      image.onload = () => {
        let detector = new FaceDetector()
        detector.once('detected', (points) => {
          if (points) {
            this.app.prepareForImage(image, points, true)
            this.fsm.detected()
          } else {
            this.fsm.failed()
          }
        })
        detector.detect(image)
      }
      image.src = url
    })
  }


  readAsDataURL(file) {
    return new Promise((resolve) => {
      let reader = new FileReader()
      reader.onload = (e) => {
        resolve(e.target.result)
      }
      reader.readAsDataURL(file)
    })
  }

}


window.onerror = (message, url, lineNumber, column, error) => {
  console.log({message, url, lineNumber, column, error, stack: error.stack})
  // debugger
}
