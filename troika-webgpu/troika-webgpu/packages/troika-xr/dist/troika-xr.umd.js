(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react'), require('prop-types'), require('troika-core'), require('troika-3d'), require('troika-animation'), require('three'), require('three/examples/jsm/loaders/GLTFLoader.js'), require('troika-three-utils')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react', 'prop-types', 'troika-core', 'troika-3d', 'troika-animation', 'three', 'three/examples/jsm/loaders/GLTFLoader.js', 'troika-three-utils'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.troika_xr = {}, global.React, global.PropTypes, global.troika_core, global.troika_3d, global.troika_animation, global.THREE, global.THREE.GLTFLoader, global.troika_three_utils));
}(this, (function (exports, React, T, troikaCore, troika3d, troikaAnimation, three, GLTFLoader_js, troikaThreeUtils) { 'use strict';

  function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

  var React__default = /*#__PURE__*/_interopDefaultLegacy(React);
  var T__default = /*#__PURE__*/_interopDefaultLegacy(T);

  class XRLauncher extends React__default['default'].PureComponent {
    constructor(props) {
      super(props);

      this._onClick = this._onClick.bind(this);
    }

    _onClick() {
      this.props.onSelectSession(this.props.xrSession ? null : 'immersive-vr'); //TODO handle other modes
    }

    render() {
      const props = this.props;
      return React__default['default'].createElement(
        'button',
        {
          onClick: this._onClick,
          disabled: !props.xrSupported
        },
        props.xrSupported ? (props.xrSession ? 'Exit XR' : 'Enter XR') : 'XR Not Available'
      )
    }
  }

  const cursorGeom = new three.SphereGeometry();
  const cursorMaterial = new three.MeshBasicMaterial({color: 0xffffff});
  const tempVec3 = new three.Vector3();
  const tempQuat = new three.Quaternion();
  const degToRadMult = Math.PI / 180;

  class CursorFacade extends troika3d.Object3DFacade {
    constructor(parent) {
      super(parent, new three.Mesh(
        cursorGeom,
        cursorMaterial.clone()
      ));

      /**
       * Visual size at which the cursor should be drawn, regardless of its distance.
       * This is measured in degrees of the field of view.
       * @type {number}
       */
      this.size = 0.3;

      /**
       * If nonzero, defines the default distance at which the cursor should be displayed when
       * the targetRay does not intersect any pointable objects in the scene. Defaults to `0`,
       * which means it is hidden by default.
       * @type {number}
       */
      this.defaultDistance = 0;
    }

    afterUpdate() {
      const {rayIntersection, defaultDistance, targetRayPose} = this;

      // Only display if there is a valid ray intersection, or we're configured with a default distance
      let point = rayIntersection && rayIntersection.point;
      if (!point && defaultDistance && targetRayPose) {
        point = tempVec3.set(0, 0, -1)
          .multiplyScalar(defaultDistance) //length
          .applyQuaternion(tempQuat.copy(targetRayPose.transform.orientation)) //rotation
          .add(targetRayPose.transform.position); //origin
      }
      if (point) {
        point.copy.call(this, point);
        this.scale = point.distanceTo(this.getCameraPosition()) * Math.sin(this.size * degToRadMult);
        this.visible = true;
      } else {
        this.visible = false;
      }

      super.afterUpdate();
    }
  }

  /**
   * A `renderOrder` for the target ray that ensures proper transparency
   */
  const TARGET_RAY_RENDERORDER = 1e8;

  /**
   * Given a XRPose, copy its transform's position and orientation to the corresponding
   * properties on a Object3DFacade.
   * @param {XRPose} pose
   * @param {Object3DFacade} facade
   */
  function copyXRPoseToFacadeProps(pose, facade) {
    if (pose && facade) {
      const {position, orientation} = pose.transform;
      facade.x = position.x;
      facade.y = position.y;
      facade.z = position.z;
      facade.quaternionX = orientation.x;
      facade.quaternionY = orientation.y;
      facade.quaternionZ = orientation.z;
      facade.quaternionW = orientation.w;
    }
  }

  let getGeometry = () => {
    const geometry = new three.CylinderGeometry(1, 1, 1, 4, 1, false)
      .translate(0, 0.5, 0)
      .rotateY(Math.PI / 4)
      .rotateX(Math.PI / -2);
    getGeometry = () => geometry;
    return geometry
  };

  let getMaterial = () => {
    const material = troika3d.createDerivedMaterial(
      new three.MeshBasicMaterial({
        transparent: true,
        opacity: 0.5,
        color: 0xffffff,
        depthTest: false
      }), {
        vertexDefs: `varying float dist;`,
        vertexMainIntro: `dist = -position.z;`,
        fragmentDefs: `varying float dist;`,
        fragmentColorTransform: `gl_FragColor.a *= smoothstep(1.0, 0.6, dist);`
      }
    );
    getMaterial = () => material;
    return material
  };



  class TargetRayFacade extends troika3d.Object3DFacade {
    constructor(parent) {
      super(parent, new three.Group());

      this.threeObject.add(this.laserMesh = new three.Mesh(getGeometry(), getMaterial()));

      this.radius = 0.003;
      this.startDistance = 0.05;
      this.maxLength = 0.4;
      this.renderOrder = TARGET_RAY_RENDERORDER;
    }

    afterUpdate() {
      const {laserMesh, targetRayPose, radius, rayIntersection, startDistance, maxLength} = this;
      if (targetRayPose) {
        // Sync group to the targetRay pose
        copyXRPoseToFacadeProps(targetRayPose, this);

        // Update laser size from radius/rayIntersection props
        laserMesh.scale.set(
          radius,
          radius,
          (rayIntersection ? Math.min(rayIntersection.distance, maxLength) : maxLength) - startDistance
        );
        laserMesh.position.z = -startDistance;
        laserMesh.visible = true;
      } else {
        laserMesh.visible = false;
      }

      super.afterUpdate();
    }
  }

  let getGeometry$1 = () => {
    const geometry = new three.CylinderGeometry(0.03, 0.05, 0.1, 8)
      .rotateX(Math.PI / -2)
      .translate(0, 0, 0.05);
    getGeometry$1 = () => geometry;
    return geometry
  };

  let getMaterial$1 = () => {
    const material = new three.MeshStandardMaterial({
      color: 0x666666,
      emissive: 0x666666,
      roughness: 0.5,
      metalness: 0.5
    });
    getMaterial$1 = () => material;
    return material
  };


  /**
   * Very basic tracked controller model
   */
  class Basic extends troika3d.Object3DFacade {
    constructor(parent) {
      const mesh = new three.Mesh(getGeometry$1(), getMaterial$1());
      super(parent, mesh);
    }
  }

  class GLTFFacade extends troika3d.Object3DFacade {
    constructor (parent) {
      super(parent, new three.Group());
      this.url = null;
      this.rootTransform = null;
      this.autoDispose = true;
    }

    afterUpdate () {
      let { url } = this;
      if (url !== this._url) {
        this._url = url;
        this.removeObjects();
        if (url) {
          let loader = new GLTFLoader_js.GLTFLoader();
          loader.setCrossOrigin('anonymous');
          loader.load(
            url,
            result => {
              this.onLoad(result);
            },
            null,
            err => {
              console.error('Failed loading controller model', err);
            }
          );
        }
      }
      super.afterUpdate();
    }

    onLoad (gltf) {
      if (this.threeObject) {
        gltf = this.normalize(gltf);
        let root = gltf.scene;
        if (this.rootTransform) {
          root.applyMatrix4(this.rootTransform);
        }
        this.threeObject.add(root);
        root.updateMatrixWorld(true);
        this.gltf = gltf;
        this.afterUpdate();
      }
    }

    normalize(gltf) {
      return gltf
    }

    removeObjects () {
      const { gltf } = this;
      if (gltf && gltf.scene) {
        if (this.autoDispose) {
          gltf.scene.traverse(({ geometry, material }) => {
            if (geometry) {
              geometry.dispose();
            }
            if (material) {
              if (material.texture) {
                material.texture.dispose();
              }
              material.dispose();
            }
          });
        }
        if (this.threeObject) {
          this.threeObject.remove(gltf.scene);
        }
        this.gltf = null;
      }
    }

    destructor () {
      this.removeObjects();
      super.destructor();
    }
  }

  const MODEL_GEN = 'gen2';

  function getModelUrl (gen, hand) {
    return `https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-${gen}-${hand}.gltf`
  }

  const MODEL_PARAMS = {
    gen1: {
      left: {
        url: getModelUrl('gen1', 'left'),
        transform: new three.Matrix4().compose(
          new three.Vector3(0, 0, -0.1),
          new three.Quaternion(),
          new three.Vector3(1, 1, 1)
        )
      },
      right: {
        url: getModelUrl('gen1', 'right'),
        transform: new three.Matrix4().compose(
          new three.Vector3(0, 0, -0.1),
          new three.Quaternion(),
          new three.Vector3(1, 1, 1)
        )
      }
    },
    gen2: {
      left: {
        url: getModelUrl('gen2', 'left'),
        transform: new three.Matrix4().compose(
          new three.Vector3(0.01, -0.01, -0.05),
          new three.Quaternion().setFromEuler(new three.Euler(-0.67, 0, 0)),
          new three.Vector3(1, 1, 1)
        )
      },
      right: {
        url: getModelUrl('gen2', 'right'),
        transform: new three.Matrix4().compose(
          new three.Vector3(-0.01, -0.01, -0.05),
          new three.Quaternion().setFromEuler(new three.Euler(-0.67, 0, 0)),
          new three.Vector3(1, 1, 1)
        )
      }
    }
  };

  // TODO define mapping here that will allow us to pass in a set of active button
  //  ids and highlight their corresponding meshes when pressed...
  // const buttonIdsToMeshNames = {}

  class OculusTouchGrip extends GLTFFacade {
    /**
     * @property bodyColor
     * @property emissive
     * @property emissiveIntensity
     * @property buttonColor
     * @property buttonActiveColor
     */

    constructor (parent) {
      super(parent);

      this.xrInputSource = null;
      this.bodyColor = 0x999999;
      this.buttonColor = 0xffffff;
      this.buttonActiveColor = 0xccffcc;
      this.emissiveIntensity = 0.3;
    }

    afterUpdate () {
      let hand = this.xrInputSource.handedness;
      if (hand !== 'left' && hand !== 'right') {
        hand = 'left';
      }
      if (hand !== this._hand) {
        this._hand = hand;
        this.url = MODEL_PARAMS[MODEL_GEN][hand].url;
        this.rootTransform = MODEL_PARAMS[MODEL_GEN][hand].transform;
      }

      this.updateMaterials();
      super.afterUpdate();
    }

    normalize (gltf) {
      // Track all the individual meshes
      this.meshes = Object.create(null);
      gltf.scene.traverse(obj => {
        if (obj.isMesh) {
          obj.material = obj.material.clone(); //workaround for some meshes sharing a material instance
          this.meshes[obj.name] = obj;
        }
      });
      return gltf
    }

    updateMaterials () {
      const { meshes } = this;
      if (meshes) {
        for (let name in meshes) {
          const color = name === 'body' ? this.bodyColor : this.buttonColor;
          const material = meshes[name].material;
          if (color !== material._lastColor) {
            material.color.set(color);
            material.emissive.set(color);
            material._lastColor = color;
          }
          material.emissiveIntensity = this.emissiveIntensity;
        }
      }
    }
  }

  //import { HandsGrip } from './grip-models/HandsGrip.js'


  const PROFILE_MODELS = [
    /*{
      match: xrInputSource => {
        return true //TODO
      },
      facade: HandsGrip
    },*/
    {
      match: xrInputSource => {
        return /Oculus/.test(navigator.userAgent) || (
          xrInputSource.profiles && xrInputSource.profiles.some(profile => /oculus-touch/.test(profile))
        )
      },
      facade: OculusTouchGrip
    },
    {
      match: xrInputSource => true,
      facade: Basic,
      space: 'targetRay'
    }
  ];

  function findModelConfig(xrInputSource) {
    for (let i = 0; i < PROFILE_MODELS.length; i++) {
      if (PROFILE_MODELS[i].match(xrInputSource)) {
        const result = troikaCore.utils.assign({}, PROFILE_MODELS[i]);
        delete result.match;
        return result
      }
    }
  }


  class GripFacade extends troika3d.Group3DFacade {
    afterUpdate() {
      const {xrInputSource} = this;
      let modelConfig = this.modelConfig;
      if (xrInputSource && xrInputSource !== this._lastSource) {
        this._lastSource = xrInputSource;
        modelConfig = this.modelConfig = findModelConfig(xrInputSource);
        if (modelConfig) {
          modelConfig.xrInputSource = xrInputSource;
        }
      }

      // Update to match the appropriate pose
      if (modelConfig) {
        const pose = modelConfig.space === 'targetRay' ? this.targetRayPose : this.gripPose;
        this.visible = !!pose;
        if (pose) {
          copyXRPoseToFacadeProps(pose, this);
        }
        modelConfig.rayIntersection = this.rayIntersection;
      }

      this.children = modelConfig || null;
      super.afterUpdate();
    }
  }

  // xr-standard gamepad button/axis index mappings
  // https://immersive-web.github.io/webxr-gamepads-module/

  const BUTTON_TRIGGER = 0;
  const BUTTON_SQUEEZE = 1;
  const BUTTON_TOUCHPAD = 2;
  const BUTTON_THUMBSTICK = 3;
  const BUTTON_DEFAULT_BACK = 5;

  const AXIS_TOUCHPAD_X = 0;
  const AXIS_TOUCHPAD_Y = 1;
  const AXIS_THUMBSTICK_X = 2;
  const AXIS_THUMBSTICK_Y = 3;

  const SCENE_EVENTS = ['mousemove', 'mouseover', 'mouseout', 'mousedown', 'mouseup', 'click'];
  const XRSESSION_EVENTS = ['selectstart', 'selectend', 'squeezestart', 'squeezeend'];
  const CLICK_MAX_DUR = 300;

  const HAPTICS = { //TODO allow control
    mouseover: {value: 0.3, duration: 10},
    click: {value: 1, duration: 20}
  };

  const DEFAULT_CURSOR = {
    facade: CursorFacade
  };
  const DEFAULT_TARGET_RAY = {
    facade: TargetRayFacade
  };
  const DEFAULT_GRIP = {
    facade: GripFacade
  };

  function toggleEvents (target, on, eventTypes, handler) {
    if (target) {
      eventTypes.forEach(type => {
        target[`${on ? 'add' : 'remove'}EventListener`](type, handler);
      });
    }
  }

  /**
   * Controls the behavior and visual representation of a single XRInputSource.
   *
   * |                   | Highlight | Cursor | Pointing Ray | Renderable Model |
   * | ------------------| --------- | ------ | ------------ | ---------------- |
   * | 'screen'          | √         | X      | X            | X                |
   * | 'gaze'            | √         | √      | X            | X                |
   * | 'tracked-pointer' | √         | √      | √            | √ (if possible)  |
   */
  class XRInputSourceFacade extends troika3d.Group3DFacade {
    constructor (parent) {
      super(parent);
      this.isXRInputSource = true;

      // Required props
      this.xrInputSource = null;
      this.xrSession = null;
      this.xrReferenceSpace = null;

      // Current frame state data, passed to all children:
      this.targetRayPose = null;
      this.gripPose = null;
      this.rayIntersection = null;

      // Child object configs:
      this.cursor = troikaCore.utils.assign(DEFAULT_CURSOR);
      this.targetRay = troikaCore.utils.assign(DEFAULT_TARGET_RAY);
      this.grip = troikaCore.utils.assign(DEFAULT_GRIP);

      // Pointing - true for all inputs by default
      this.isPointing = true;

      this.clickOnPoke = false;

      this.children = [
        null, //cursor
        null, //targetRay
        null //grip
      ];

      this._ray = new three.Ray();

      this._onSessionEvent = this._onSessionEvent.bind(this);
      this._onSceneRayEvent = this._onSceneRayEvent.bind(this);
      this.addEventListener('xrframe', this._onXrFrame.bind(this));

      // Listen to ray intersection related events at the scene level, so we can respond to intersection changes
      toggleEvents(this.getSceneFacade(), true, SCENE_EVENTS, this._onSceneRayEvent);
    }

    afterUpdate () {
      const {xrSession, _lastXrSession, xrInputSource, rayIntersection, children, isPointing, cursor, targetRay, grip, targetRayPose, gripPose} = this;

      if (xrSession !== _lastXrSession) {
        this._lastXrSession = xrSession;
        toggleEvents(_lastXrSession, false, XRSESSION_EVENTS, this._onSessionEvent);
        // Only listen for XRSession 'select' event if we won't be handling the xr-standard
        // gamepad button tracking ourselves
        if (!this._isXrStandardGamepad()) {
          toggleEvents(xrSession, true, XRSESSION_EVENTS, this._onSessionEvent);
        }
      }

      // Update child objects
      let cursorCfg = null, targetRayCfg = null, gripCfg = null;
      if (xrInputSource.targetRayMode !== 'screen') {
        cursorCfg = isPointing && cursor;
        if (cursorCfg) {
          cursorCfg.key = 'cursor';
          cursorCfg.targetRayPose = targetRayPose;
          cursorCfg.gripPose = gripPose;
          cursorCfg.rayIntersection = rayIntersection;
          cursorCfg.xrInputSource = xrInputSource;
        }
      }
      if (xrInputSource.targetRayMode === 'tracked-pointer') {
        targetRayCfg = isPointing && targetRay;
        if (targetRayCfg) {
          targetRayCfg.key = 'targetRay';
          targetRayCfg.targetRayPose = targetRayPose;
          targetRayCfg.gripPose = gripPose;
          targetRayCfg.rayIntersection = rayIntersection;
          targetRayCfg.xrInputSource = xrInputSource;
        }
        gripCfg = gripPose ? grip : null;
        if (gripCfg) {
          gripCfg.key = 'grip';
          gripCfg.targetRayPose = targetRayPose;
          gripCfg.gripPose = gripPose;
          gripCfg.rayIntersection = rayIntersection;
          gripCfg.xrInputSource = xrInputSource;
        }
      }
      children[0] = cursorCfg;
      children[1] = targetRayCfg;
      children[2] = gripCfg;

      super.afterUpdate();
    }

    _onXrFrame (time, xrFrame) {
      const {xrInputSource, isPointing, _ray: ray} = this;
      const offsetReferenceSpace = this.getCameraFacade().offsetReferenceSpace;

      if (offsetReferenceSpace) {
        // Update current poses
        const {targetRaySpace, gripSpace} = xrInputSource;
        const targetRayPose = xrFrame.getPose(targetRaySpace, offsetReferenceSpace);
        if (targetRayPose && isPointing) {
          ray.origin.copy(targetRayPose.transform.position);
          ray.direction.set(0, 0, -1).applyQuaternion(targetRayPose.transform.orientation);
          this.notifyWorld('rayPointerMotion', ray);
        }
        this.targetRayPose = targetRayPose;
        this.gripPose = gripSpace ? xrFrame.getPose(gripSpace, offsetReferenceSpace) : null;
      }

      // If this is a tracked-pointer with a gamepad, track its button/axis states
      if (this._isXrStandardGamepad()) {
        this._trackGamepadState(xrInputSource.gamepad);
      }

      this.afterUpdate();
    }

    _isXrStandardGamepad() {
      const {gamepad} = this.xrInputSource;
      return gamepad && gamepad.mapping === 'xr-standard'
    }

    _trackGamepadState(gamepad) {
      // Handle button presses
      const buttons = gamepad.buttons;
      const pressedTimes = this._buttonPresses || (this._buttonPresses = []);
      const now = Date.now();
      const ray = this._ray; //assumes already updated to current frame pose
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].pressed !== !!pressedTimes[i]) {
          if (this.isPointing) {
            this.notifyWorld('rayPointerAction', {
              ray,
              type: buttons[i].pressed ? 'mousedown' : 'mouseup',
              button: i
            });
            if (pressedTimes[i] && !buttons[i].pressed && now - pressedTimes[i] <= CLICK_MAX_DUR) {
              this.notifyWorld('rayPointerAction', {
                ray,
                type: 'click',
                button: i
              });
            }
          }
          pressedTimes[i] = buttons[i].pressed ? now : null;
        }
        pressedTimes.length = buttons.length;
      }

      // Handle axis inputs
      const axes = gamepad.axes;
      for (let i = 0; i < axes.length; i += 2) {
        // Map each pair of axes to wheel event deltaX/Y
        // TODO investigate better mapping
        const deltaX = (axes[i] || 0) * 10;
        const deltaY = (axes[i + 1] || 0) * 10;
        if (Math.hypot(deltaX, deltaY) > 0.1) {
          if (this.isPointing) {
            this.notifyWorld('rayPointerAction', {
              ray,
              type: 'wheel',
              deltaX,
              deltaY,
              deltaMode: 0 //pixel mode
            });
          }
        }
      }
    }

    _onSessionEvent (e) {
      if (e.inputSource === this.xrInputSource) {
        // Redispatch select and squeeze events as standard pointer events to the world's event system.
        // Note this is only used for non xr-standard gamepad inputs, otherwise it's handled in the
        // gamepad button state tracking.
        const button = /^squeeze/.test(e.type) ? BUTTON_SQUEEZE : BUTTON_TRIGGER;
        this.notifyWorld('rayPointerAction', {
          ray: this._ray,
          type: /start$/.test(e.type) ? 'mousedown' : 'mouseup',
          button
        });
        // If this was an "end" event, then we'll also want to fire a click event after the mouseup.
        // This is a workaround for the fact that WebXR fires 'select' then 'selectend', which doesn't
        // match with standard DOM mouse events which go 'mouseup' then 'click', and can lead to
        // unexpected behaviors in downstram code that assumes the standard order.
        if (/end$/.test(e.type)) {
          this.notifyWorld('rayPointerAction', {
            ray: this._ray,
            type: 'click',
            button
          });
        }
      }
    }

    _onSceneRayEvent (e) {
      // Only handle events where this was the ray's source
      if (e.nativeEvent.eventSource === this) {
        const {gamepad, targetRayMode} = this.xrInputSource;

        // Copy intersection info to local state and update subtree
        this.rayIntersection = e.intersection;
        this.afterUpdate();

        // If haptics available, trigger a pulse
        if (gamepad) {
          const isScene = e.target === e.currentTarget;
          const hapticPulse = e.type === 'click' ? HAPTICS.click
            : (e.type === 'mouseover' && !isScene) ? HAPTICS.mouseover
            : null;
          if (hapticPulse) {
            const hapticActuator = gamepad.hapticActuators && gamepad.hapticActuators[0];
            if (hapticActuator) {
              hapticActuator.pulse(hapticPulse.value || 1, hapticPulse.duration || 100);
            }
          }
        }

        // For gamepad buttons and select/squeeze session events, dispatch custom xr-specific
        // events to the raycasted target facade:
        let defaultPrevented = e.defaultPrevented;
        const fireEvent = type => {
          if (type) {
            const customEvent = new Event(type, {bubbles: true});
            customEvent.eventSource = this;
            e.target.dispatchEvent(customEvent);
            defaultPrevented = defaultPrevented || customEvent.defaultPrevented;
          }
        };
        //TODO: fireEvent(RAY_TARGET_EVENTS.all[e.type]) //all buttons
        fireEvent(RAY_TARGET_EVENTS[e.button] && RAY_TARGET_EVENTS[e.button][e.type]); //special select/squeeze

        // Default gamepad button mapping to exit the XR session; authors can override this
        // to use that button for other things by calling `preventDefault()`
        if (!defaultPrevented && e.type === 'click' && e.button === BUTTON_DEFAULT_BACK) {
          this.notifyWorld('endXRSession');
        }

        // Check physical proximity to trigger a click when poking an object
        if (targetRayMode === 'tracked-pointer' && this.clickOnPoke) {
          this._checkPokeGesture(e);
        }
      }
    }

    _checkPokeGesture(e) {
      const DEBOUNCE = 500;
      const RAY_DISTANCE = 0.1; //slight buffer
      const {intersection, target} = e;
      const pokeState = this._pokeState || (this._pokeState = {target: null, isPoking: false, time: 0});
      const isPoking = !!intersection && intersection.distance < RAY_DISTANCE;
      if (isPoking && (!pokeState.isPoking || target !== pokeState.target) && Date.now() - pokeState.time > DEBOUNCE) {
        pokeState.time = Date.now();
        this.notifyWorld('rayPointerAction', {
          ray: e.ray,
          type: 'click',
          button: BUTTON_TRIGGER
        });
      }
      pokeState.isPoking = isPoking;
      pokeState.target = target;
    }

    destructor () {
      toggleEvents(this.xrSession, false, XRSESSION_EVENTS, this._onSessionEvent);
      toggleEvents(this.getSceneFacade(), false, SCENE_EVENTS, this._onSceneRayEvent);
      super.destructor();
    }
  }

  // this.onXrFrame = null //timestamp, XRFrame
  // this.onIntersectionEvent = null //???
  // this.onSelectStart = null
  // this.onSelect = null
  // this.onSelectEnd = null
  // this.onSqueezeStart = null
  // this.onSqueeze = null
  // this.onSqueezeEnd = null
  // this.onButtonTouchStart = null
  // this.onButtonPressStart = null
  // this.onButtonPress = null
  // this.onButtonPressEnd = null
  // this.onButtonTouchEnd = null


  // Define some custom xr-specific events that will be dispatched to the target Object3DFacade
  // intersecting the ray at the time of a button action:
  const RAY_TARGET_EVENTS = {
    [BUTTON_TRIGGER]: {
      mousedown: 'xrselectstart',
      mouseup: 'xrselectend',
      click: 'xrselect'
    },
    [BUTTON_SQUEEZE]: {
      mousedown: 'xrsqueezestart',
      mouseup: 'xrsqueezeend',
      click: 'xrsqueeze'
    },
    // TODO decide on event names, and handle touching without press:
    // all: {
    //   mousedown: 'xrbuttondown',
    //   mouseup: 'xrbuttonup',
    //   click: 'xrbuttonclick'
    // }
  };

  // ...and add shortcut event handler properties on Object3DFacade for those events:
  troikaCore.Facade.defineEventProperty(troika3d.Object3DFacade, 'onXRSelectStart', 'xrselectstart');
  troikaCore.Facade.defineEventProperty(troika3d.Object3DFacade, 'onXRSelect', 'xrselect');
  troikaCore.Facade.defineEventProperty(troika3d.Object3DFacade, 'onXRSelectEnd', 'xrselectend');
  troikaCore.Facade.defineEventProperty(troika3d.Object3DFacade, 'onXRSqueezeStart', 'xrsqueezestart');
  troikaCore.Facade.defineEventProperty(troika3d.Object3DFacade, 'onXRSqueeze', 'xrsqueeze');
  troikaCore.Facade.defineEventProperty(troika3d.Object3DFacade, 'onXRSqueezeEnd', 'xrsqueezeend');

  /*

  Additive or replace?


  {
    key: 'primaryTool',
    facade: XRInputSourceAnchored,
    selector: xrInputSource => (
      xrInputSource.targetRayMode === 'tracked-pointer' &&
      xrInputSource.handedness === prefs.handedness
    ),
    referenceSpace: 'grip'
  },
  {
    key: 'xrInputDefaultGrips',
    facade: XRInputVendorGrips
  },
  {
    facade: TrackedPointerXRInputSource,
    matches: (xrInputSource, allSources) => (
      xrInputSource.handedness === 'left'
    ),

    onSelectStart: e => {},
    onSelect: e => {},
    onSelectEnd: e => {},
    onSqueezeStart: e => {},
    onSqueeze: e => {},
    onSqueezeEnd: e => {},

    onButtonDown: e => {},
    onButtonClick: e => {},
    onButtonUp: e => {},
    onAxisChange: e => {},

    targetRay: true,
    targetRay: {facade: MyCustomLaser},
    targetRay: {color: 0x33ff33},
    cursor: true,
    cursor: {facade: MyCustomCursor},
    cursor: {color: 0xff0000},
    grip: true,
    grip: {facade: PlatformGripModel},
    grip: {
      facade: Group3DFacade,
      children: [{
        key: 'main',
        facade: PlatformGripModel
      }, {
        key: 'ui',
        facade: GripTabletFacade,
        visible: state.
      }]
    }
  }



  {
    facade: XRInputSourceConfig,
    configs: [
      {
        match: src => src.targetRayMode === 'tracked-pointer' && src.handedness === 'left'
      }
    ]
  }



  ---

  For each XRInputSource:
    - Resolve a XRInputSourceFacade
      - based on...?
    - Find objects in scene matching the XRInputSource
      - based on: targetRayMode, handedness, profiles, ...?
      - if none found, supply a default set



  */



  /**
   * A container facade, placed at the root of the scene, that manages the tracking of
   * `XRInputSource`s and the rendering of their related scene objects.
   *
   *
   */
  class XRInputSourceManager extends troikaCore.ParentFacade {
    constructor(parent) {
      super(parent);
      this._sourcesDirty = true;

      // Required props:
      this.xrSession = null;
      this.xrReferenceSpace = null;

      // Separate subtree for the XRInputSourceFacade instances:
      this._xrInputSourceSubtree = new troikaCore.ParentFacade(this);

      this._onInputSourcesChange = e => {
        this._sourcesDirty = true;
        this.afterUpdate();
      };
    }

    afterUpdate() {
      const {xrSession, _lastXrSession} = this;

      if (xrSession !== _lastXrSession) {
        this._lastXrSession = xrSession;
        if (_lastXrSession) {
          _lastXrSession.removeEventListener('inputsourceschange', this._onInputSourcesChange);
        }
        if (xrSession) {
          xrSession.addEventListener('inputsourceschange', this._onInputSourcesChange);
        }
      }

      if (this._sourcesDirty) {
        this._sourcesDirty = false;
        const inputSources = xrSession && xrSession.inputSources;
        this._xrInputSourceSubtree.children = inputSources && Array.from(inputSources).map(xrInputSource => {
          // TODO resolve config overrides?
          return {
            facade: XRInputSourceFacade,
            key: troikaCore.utils.getIdForObject(xrInputSource),
            xrInputSource,
            xrSession: this.xrSession,
            xrReferenceSpace: this.xrReferenceSpace
          }
        });
        this._xrInputSourceSubtree.afterUpdate();
      }
      super.afterUpdate();
    }

    destructor () {
      if (this.xrSession) {
        this.xrSession.removeEventListener('inputsourceschange', this._onInputSourcesChange);
      }
      super.destructor();
      this._xrInputSourceSubtree.destructor();
    }
  }

  /*global XRRigidTransform*/

  const tempVec3$1 = new three.Vector3();
  const tempVec3b = new three.Vector3();
  const tempQuat$1 = new three.Quaternion();
  const dummyObj = {};
  const tempMat4 = new three.Matrix4();

  function extendAsXRCamera (BaseCameraFacadeClass) {
    return doExtendAsXRCamera(BaseCameraFacadeClass || troika3d.PerspectiveCamera3DFacade)
  }

  const doExtendAsXRCamera = troikaCore.utils.createClassExtender('xrCamera', function (BaseCameraFacadeClass) {
    return class XRCameraFacade extends BaseCameraFacadeClass {
      constructor (parent) {
        super(parent);

        // Required props
        this.xrSession = null;
        this.xrReferenceSpace = null;

        // This will behave like an ArrayCamera with a sub-camera for each view.
        // The individual view cameras will be created as needed based on the xrFrame's pose views.
        const mainCam = this.threeObject;
        mainCam.isArrayCamera = true;
        mainCam.cameras = [];

        // Expose the camera's configured position/orientation as an offset XRReferenceSpace.
        this.offsetReferenceSpace = null;

        // Update cameras on every render frame
        this.addEventListener('xrframe', this._onXrFrame.bind(this));
      }

      afterUpdate () {
        const { near, far, xrSession } = this;

        // Update near/far planes
        const { depthNear, depthFar } = xrSession.renderState;
        if (near !== depthNear || far !== depthFar) {
          xrSession.updateRenderState({
            depthNear: near,
            depthFar: far
          });
        }

        super.afterUpdate();
      }

      updateMatrices () {
        // Update offsetReferenceSpace to match configured camera position/rotation
        // TODO test if this reacts to reset events properly
        const { xrReferenceSpace } = this;
        const offsetChanging = this._matrixChanged || xrReferenceSpace !== this._lastRefSpace;
        super.updateMatrices();
        if (offsetChanging) {
          this._lastRefSpace = xrReferenceSpace;
          troikaThreeUtils.invertMatrix4(this.threeObject.matrix, tempMat4).decompose(tempVec3$1, tempQuat$1, dummyObj);
          this.offsetReferenceSpace = xrReferenceSpace
            ? xrReferenceSpace.getOffsetReferenceSpace(new XRRigidTransform(tempVec3$1, tempQuat$1))
            : null;
        }
      }

      /**
       * Handle syncing the cameras to the current XRFrame's pose data
       */
      _onXrFrame (timestamp, xrFrame) {
        const { xrSession, offsetReferenceSpace, threeObject: mainCam } = this;
        const pose = offsetReferenceSpace && xrFrame.getViewerPose(offsetReferenceSpace);

        if (pose && xrSession && xrSession.renderState.baseLayer) {
          const views = pose.views;
          const viewCameras = mainCam.cameras;

          // Remove extra cameras if the count is decreasing
          while (viewCameras.length > views.length) {
            mainCam.layers.disable(viewCameras.length--);
          }

          // Update each eye view
          for (let i = 0; i < views.length; i++) {
            const view = views[i];
            let viewCam = viewCameras[i];

            // Create the view's sub-camera if needed
            if (!viewCam) {
              viewCam = viewCameras[i] = new three.PerspectiveCamera();
              viewCam.viewport = new three.Vector4();
              // Match the ThreeJS convention of layer masks per eye
              viewCam.layers.enable(i + 1);
              mainCam.layers.enable(i + 1);
            }

            // Update the sub-camera viewport and matrices to match the view
            const viewport = xrSession.renderState.baseLayer.getViewport(view);
            viewCam.viewport.set(viewport.x, viewport.y, viewport.width, viewport.height);
            viewCam.matrixWorld.fromArray(view.transform.matrix);
            viewCam.matrixWorldInverse.fromArray(view.transform.inverse.matrix);
            viewCam.projectionMatrix.fromArray(view.projectionMatrix);
          }

          // We also need to make the main camera match an overall pose/projection for use in
          // frustum culling etc. For now let's just copy the first view's data.
          // TODO this isn't good enough for the frustum, it results in overaggressive culling from the right eye.
          //  Should use a combined frustum once available from API (https://github.com/w3c/webvr/issues/203)
          //  or calculate it ourselves like ThreeJS does with WebVRUtils.setProjectionFromUnion
          if (views.length === 2) {
            setProjectionFromUnion(mainCam, viewCameras[0], viewCameras[1]);
          }
        }
      }
    }
  });

  /**
   * NOTE: mostly copied from private function in ThreeJS's WebXRManager at
   * https://github.com/mrdoob/three.js/blob/f43ec7c849d7cecbc4831d152cf6a5d97c45ad3b/src/renderers/webxr/WebXRManager.js#L281
   *
   * Assumes 2 cameras that are parallel and share an X-axis, and that
   * the cameras' projection and world matrices have already been set.
   * And that near and far planes are identical for both cameras.
   * Visualization of this technique: https://computergraphics.stackexchange.com/a/4765
   */
  function setProjectionFromUnion (camera, cameraL, cameraR) {

    tempVec3$1.setFromMatrixPosition(cameraL.matrixWorld);
    tempVec3b.setFromMatrixPosition(cameraR.matrixWorld);

    const ipd = tempVec3$1.distanceTo(tempVec3b);

    const projL = cameraL.projectionMatrix.elements;
    const projR = cameraR.projectionMatrix.elements;

    // VR systems will have identical far and near planes, and
    // most likely identical top and bottom frustum extents.
    // Use the left camera for these values.
    const near = projL[14] / (projL[10] - 1);
    const far = projL[14] / (projL[10] + 1);
    const topFov = (projL[9] + 1) / projL[5];
    const bottomFov = (projL[9] - 1) / projL[5];

    const leftFov = (projL[8] - 1) / projL[0];
    const rightFov = (projR[8] + 1) / projR[0];
    const left = near * leftFov;
    const right = near * rightFov;

    // Calculate the new camera's position offset from the
    // left camera. xOffset should be roughly half `ipd`.
    const zOffset = ipd / (-leftFov + rightFov);
    const xOffset = zOffset * -leftFov;

    // TODO: Better way to apply this offset?
    cameraL.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
    camera.translateX(xOffset);
    camera.translateZ(zOffset);
    camera.matrixWorld.compose(camera.position, camera.quaternion, camera.scale);
    troikaThreeUtils.invertMatrix4(camera.matrixWorld, camera.matrixWorldInverse);

    // Find the union of the frustum values of the cameras and scale
    // the values so that the near plane's position does not change in world space,
    // although must now be relative to the new union camera.
    const near2 = near + zOffset;
    const far2 = far + zOffset;
    const left2 = left - xOffset;
    const right2 = right + (ipd - xOffset);
    const top2 = topFov * far / far2 * near2;
    const bottom2 = bottomFov * far / far2 * near2;

    camera.projectionMatrix.makePerspective(left2, right2, top2, bottom2, near2, far2);
  }

  /*global XRWebGLLayer*/

  const emptyArray = [];
  const tempVec2 = new three.Vector2();

  const _xrSessions = new WeakMap();


  class WorldXRFacade extends troika3d.World3DFacade {
    /**
     * Relevant things passed in from XRAware:
     * @property {XRSession} xrSession
     * @property {XRSessionMode} xrSessionMode
     * @property {XRReferenceSpace} xrReferenceSpace
     * @property {XRReferenceSpaceType} xrReferenceSpaceType
     * @property {number|string} xrFramebufferScaleFactor
     *
     * New global event types:
     * `xrframe` - fired on each frame, with the current time and XRFrame object as arguments
     */

    afterUpdate() {
      // Disable pointer events on the onscreen canvas when in an immersive XR session
      this._togglePointerListeners(!this._isImmersive());

      super.afterUpdate();

      const {xrSession, _threeRenderer:renderer} = this;

      const prevXrSession = _xrSessions.get(this);
      if (xrSession !== prevXrSession) {
        _xrSessions.set(this, xrSession);
        this.renderingScheduler = xrSession || window;
        troikaAnimation.setAnimationScheduler(xrSession || window);
        if (xrSession) {
          let baseLayer = xrSession.renderState.baseLayer;
          const gl = renderer.getContext();

          // If the session has an existing valid XRWebGLLayer, just grab its framebuffer.
          // Otherwise, create a new XRWebGLLayer
          if (baseLayer && baseLayer._glContext === gl) {
            bindFramebuffer(renderer, baseLayer.framebuffer);
          } else {
            const promise = gl.makeXRCompatible ? gl.makeXRCompatible() : Promise.resolve(); //not always implemented?
            promise.then(() => {
              if (this.xrSession === xrSession) {
                baseLayer = new XRWebGLLayer(xrSession, gl, {
                  antialias: !!renderer.getContextAttributes().antialias,
                  framebufferScaleFactor: parseFramebufferScaleFactor(this.xrFramebufferScaleFactor, xrSession)
                });
                baseLayer._glContext = gl;
                xrSession.updateRenderState({ baseLayer });
                bindFramebuffer(renderer, baseLayer.framebuffer);
                this._queueRender();
              }
            });
          }
        } else {
          bindFramebuffer(renderer, null);
          renderer.setRenderTarget(renderer.getRenderTarget()); //see https://github.com/mrdoob/three.js/pull/15830
          // reset canvas/viewport size in case something changed it (cough cough polyfill)
          renderer.getSize(tempVec2);
          renderer.setDrawingBufferSize(tempVec2.x, tempVec2.y, renderer.getPixelRatio());
          this._queueRender();
        }
      }
    }

    /**
     * @override
     */
    doRender(timestamp, xrFrame) {
      // Invoke xrframe event handlers
      if (xrFrame && xrFrame.session) {
        this.eventRegistry.forEachListenerOfType('xrframe', fn => fn(timestamp, xrFrame), this);
      }

      super.doRender();
    }

    _isOpaque() { //TODO???
      return this.xrSession && this.xrSession.environmentBlendMode === 'opaque'
    }

    _isImmersive() {
      return this.xrSession && this.xrSessionMode !== 'inline'
    }

    /**
     * @override to use an XR stereo camera when in immersive XR mode
     */
    _getCameraDef() {
      const camera = super._getCameraDef();
      if (this._isImmersive()) {
        camera.facade = extendAsXRCamera(camera.facade);
        camera.xrSession = this.xrSession;
        camera.xrReferenceSpace = this.xrReferenceSpace;
      }
      return camera
    }

    /**
     * @override to add VR controllers manager object
     */
    _getSceneDef() {
      const scene = super._getSceneDef();
      const {xrSession, xrReferenceSpace} = this;
      if (xrSession && xrReferenceSpace) {
        scene.objects = emptyArray.concat(
          scene.objects,
          {
            key: 'xrInputMgr',
            facade: XRInputSourceManager,
            xrSession,
            xrReferenceSpace
          }
        );
      }
      return scene
    }

    /**
     * @override to always continuously render when in XR
     */
    _isContinuousRender() {
      return this.xrSession || this.continuousRender
    }

    /**
     * @override to skip rendering HTML overlays when in immersive mode
     */
    _doRenderHtmlItems() {
      if (this._isImmersive()) {
        if (this.renderHtmlItems) {
          this.renderHtmlItems(emptyArray);
        }
      } else {
        super._doRenderHtmlItems();
      }
    }
  }

  WorldXRFacade.prototype._notifyWorldHandlers = Object.create(
    troika3d.World3DFacade.prototype._notifyWorldHandlers,
    {
      // notification to end the XR session
      endXRSession: {
        value: function(source, data) {
          if (this.xrSession) {
            this.xrSession.end();
          }
        }
      }
    }
  );

  function parseFramebufferScaleFactor(value, xrSession) {
    let scale = 1;
    if (value != null) {
      if (typeof value === 'string') {
        if (/native/.test(value)) {
          const mult = +value.replace(/\s*native\s*/, '') || 1;
          const nativeScale = XRWebGLLayer.getNativeFramebufferScaleFactor(xrSession);
          scale = nativeScale * mult;
        }
      } else {
        scale = +value;
      }
      if (isNaN(scale)) scale = 1;
    }
    //console.info(`WebXR: using framebufferScaleFactor ${scale}`)
    return scale
  }

  // Smooth out r127 framebuffer state refactor
  function bindFramebuffer(renderer, framebuffer) {
    if (renderer.setFramebuffer) { //pre-r127
      renderer.setFramebuffer(framebuffer);
    } else if (renderer.state.bindXRFramebuffer) {
      renderer.state.bindXRFramebuffer(framebuffer);
    } else {
      renderer.state.bindFramebuffer(framebuffer);
    }
  }

  const SESSION_MODES = ['inline', 'immersive-vr']; //TODO add others as they are added to the specs
  const REFERENCE_SPACE_TYPES = ['viewer', 'local', 'local-floor', 'bounded-floor', 'unbounded'];


  /**
   * The types of the props that are passed down to the wrapped React component
   */
  const XRAwarePropTypes = {
    xrSupported: T__default['default'].bool,
    xrSupportedSessionModes: T__default['default'].arrayOf(T__default['default'].oneOf(SESSION_MODES)),
    xrSession: T__default['default'].object,
    xrSessionMode: T__default['default'].oneOf(SESSION_MODES),
    xrReferenceSpace: T__default['default'].object,
    xrReferenceSpaceType: T__default['default'].oneOf(REFERENCE_SPACE_TYPES),
    xrLauncher: T__default['default'].element
  };


  /**
   * Wraps a React component class/function in a higher-order component which enables support
   * for WebXR. The wrapper handles querying the browser for supported XR session types,
   * initiating a supported XR session, and upgrading any descendant `Canvas3D` components
   * with support for rendering XR stereo views and handling XR input controllers.
   *
   *
   *
   * @param {class|function} ReactClass
   * @param {object} options
   * @param {React.Component} options.xrLauncherRenderer - The React component to use for
   *        rendering the launcher button. Defaults to a basic launcher button implementation.
   * @param {string[]} options.sessionModes - The XRSessionMode(s) supported by this particular scene.
   *        Assumes an 'immersive-vr' experience only by default. Authors can add 'inline' as a
   *        fallback, or force 'inline' only.
   *        TODO: allow secondary mode to be chosen by the user, rather than just as a fallback?
   * @param {string[]} options.referenceSpaces - The XRReferenceSpaceType(s) supported by this particular scene.
   *        By default a floor-relative space is required, preferring 'bounded-floor', falling
   *        back to 'local-floor', and failing session initialization if neither is available or
   *        permitted by the user. Authors can change this list to support other reference space
   *        types as fallbacks. All but the final will be used as `optionalFeatures`, and the final
   *        will be used for `requiredFeatures`.
   *        TODO: allow secondary spaces to be chosen by the user, rather than just as a fallback?
   *        TODO: allow different spaces to be specified for immersive-vr vs. local modes?
   * @param {number|string} options.framebufferScaleFactor - Scaling factor for the XR framebuffer.
   *        A number is used directly as the WebGLLayer's `framebufferScaleFactor` parameter. The
   *        string "native" uses the device's native resolution. A string containing "native" and
   *        a number, e.g. "0.5 native", uses the device's native resolution multiplied by that
   *        number. Defaults to `1` per the WebXR spec.
   *        TODO: allow 'auto' adaptive scaling to maintain frame rate
   *        TODO: allow changing this value on the fly
   * @return {class}
   */
  function ReactXRAware(ReactClass, options) {
    options = troikaCore.utils.assign({
      xrLauncherRenderer: XRLauncher,
      sessionModes: ['immersive-vr'],
      referenceSpaces: ['bounded-floor', 'local-floor'],
      framebufferScaleFactor: 1
    }, options);

    class XRAware extends React__default['default'].Component {
      constructor(props) {
        super(props);

        this.state = {
          xrSupportedSessionModes: [],
          xrSession: null,
          xrSessionMode: null,
          xrReferenceSpace: null,
          xrReferenceSpaceType: null
        }

        // bind handler methods:
        ;[
          '_checkXrSupport',
          '_onSessionEnded',
          '_onLauncherSelect'
        ].forEach(method => {
          this[method] = this[method].bind(this);
        });

        const xr = navigator.xr;
        if (xr) {
          xr.addEventListener('devicechange', this._checkXrSupport);
        }
        this._checkXrSupport();
      }

      componentWillUnmount() {
        const xr = navigator.xr;
        if (xr) {
          xr.removeEventListener('devicechange', this._checkXrSupport);
        }
      }

      _checkXrSupport() {
        const xr = navigator.xr;
        if (xr) {
          const xrSupportedSessionModes = [];
          Promise.all(options.sessionModes.map(mode => {
            if (typeof xr.isSessionSupported === 'function') {
              return xr.isSessionSupported(mode)
                .then(supported => {
                  if (supported) {
                    xrSupportedSessionModes.push(mode);
                  } else {
                    console.info(`XR session type '${mode}' not supported`);
                  }
                })
            } else {
              // TODO remove this fallback for slightly old API impls...
              return xr.supportsSession(mode)
                .then(() => {
                  xrSupportedSessionModes.push(mode);
                }, err => {
                  console.info(`XR session type '${mode}' not supported`, err);
                })
            }
          })).then(() => {
            this.setState({xrSupportedSessionModes});
          });
        } else {
          this.setState({
            xrSupportedSessionModes: []
          });
        }
      }

      _startSession(xrSessionMode) {
        let {xrSupportedSessionModes, xrSession} = this.state;

        // Stop current session if running
        // TODO not sure if this is a potential race condition, but we can't wait for its promise
        //  to resolve because that fails the "user activation" requirement for starting the new session.
        //  We may want to make the selection UI require first ending a session before being able to select a new one.
        if (xrSession) {
          xrSession.end();
        }

        if (xrSupportedSessionModes.includes(xrSessionMode)) {
          const candidateRefSpaces = options.referenceSpaces;
          if (!candidateRefSpaces || !candidateRefSpaces.length) {
            console.error('XRAware `referencesSpaces` cannot be empty');
            return
          }

          navigator.xr.requestSession(xrSessionMode, {
            optionalFeatures: candidateRefSpaces.slice(0, -1),
            requiredFeatures: candidateRefSpaces.slice(-1)
          })
            .then(xrSession => {
              xrSession.addEventListener('end', this._onSessionEnded, false);

              // Get the first XRReferenceSpace supported by the hardware
              const getRefSpace = (index=0) => {
                const type = candidateRefSpaces[index];
                return xrSession.requestReferenceSpace(type)
                  .then(xrReferenceSpace => [xrReferenceSpace, type])
                  .catch(err => {
                    console.debug(`Reference space ${type} not supported or denied by user.`, err);
                    if (index + 1 === candidateRefSpaces.length) {
                      throw new Error(`All requested referenceSpaces (${candidateRefSpaces.join(', ')}) are either unsupported or were denied by the user.`)
                    } else {
                      return getRefSpace(index + 1)
                    }
                  })
              };
              return getRefSpace().then(([xrReferenceSpace, xrReferenceSpaceType]) => {
                this.setState({
                  xrSession,
                  xrSessionMode,
                  xrReferenceSpace,
                  xrReferenceSpaceType
                });
              })
            })
            .catch(err => {
              console.error(err);
              //TODO supply for user feedback... this.setState({xrSessionError: err})
            });
        }
      }

      _onSessionEnded(e) {
        e.session.removeEventListener('end', this._onSessionEnded, false);
        this.setState({
          xrSession: null,
          xrSessionMode: null,
          xrReferenceSpace: null,
          xrReferenceSpaceType: null
        });
      }

      _onLauncherSelect(mode) {
        // TODO this fails due to user activation requirement
        // if (!mode || mode !== this.state.xrSessionMode) {
        //   this._stopSession().then(() => {
        //     if (mode) {
        //       this._startSession(mode)
        //     }
        //   })
        // } else {
          this._startSession(mode);
        //}
      }

      render() {
        const {props, state} = this;
        const {xrSupportedSessionModes, xrSession, xrSessionMode, xrReferenceSpace, xrReferenceSpaceType} = state;
        const xrSupported = xrSupportedSessionModes.length > 0;

        const xrLauncher = React__default['default'].createElement(
          options.xrLauncherRenderer,
          {
            xrSupportedSessionModes,
            xrSupported,
            xrSession,
            onSelectSession: this._onLauncherSelect
          }
        );

        const contextValue = {
          worldFacade: WorldXRFacade,
          worldProps: {
            xrSession,
            xrSessionMode,
            xrReferenceSpace,
            xrReferenceSpaceType,
            xrFramebufferScaleFactor: options.framebufferScaleFactor
          }
        };

        return React__default['default'].createElement(troika3d.Canvas3D.contextType.Provider, {value: contextValue},
          React__default['default'].createElement(
            ReactClass,
            troikaCore.utils.assign({}, props, {
              xrSupported,
              xrSupportedSessionModes,
              xrSession,
              xrSessionMode,
              xrReferenceSpace,
              xrReferenceSpaceType,
              xrLauncher
            }),
            props.children
          )
        )
      }
    }

    XRAware.displayName = `XRAware(${ReactClass.displayName || ReactClass.name || '?'})`;

    return XRAware
  }

  const getStrapGeometry = troikaCore.utils.memoize(() => {
    return new three.CylinderGeometry(
      1,
      1,
      1,
      64,
      1,
      true,
      // Math.PI / 4 * 3,
      // Math.PI / 4 * 6
    )
      .rotateX(Math.PI / 2)
  });

  const getStrapMaterial = troikaCore.utils.memoize(() => {
    return new three.MeshStandardMaterial({
      color: 0x333333,
      side: three.DoubleSide
    })
  });

  class Strap extends troika3d.Object3DFacade {
    constructor (parent) {
      super(parent, new three.Mesh(getStrapGeometry(), getStrapMaterial()));
    }
    set smallRadius(val) {
      this.scaleX = val;
    }
    set largeRadius(val) {
      this.scaleY = val;
    }
    set width(val) {
      this.scaleZ = val;
    }
  }

  const getCogGeometry = troikaCore.utils.memoize(() => {
    let outerRadius = 0.01;
    let innerRadius = 0.006;
    let midRadius = (innerRadius + outerRadius) * .75;
    let teeth = 8;
    let twoPi = Math.PI * 2;
    let shape = new three.Shape().moveTo(midRadius, 0);
    for (let i = 0; i < teeth; i++) {
      let angle = i / teeth * twoPi;
      shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
      angle = (i + 0.5) / teeth * twoPi;
      shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
      shape.lineTo(Math.cos(angle) * midRadius, Math.sin(angle) * midRadius);
      if (i === teeth - 1) {
        shape.lineTo(midRadius, 0); //close shape exactly
      } else {
        angle = (i + 1) / teeth * twoPi;
        shape.lineTo(Math.cos(angle) * midRadius, Math.sin(angle) * midRadius);
      }
    }
    shape.holes.push(
      new three.Path().absellipse(0, 0, innerRadius, innerRadius, 0, twoPi, false)
    );
    return new three.ExtrudeGeometry(shape, {
      curveSegments: teeth * 2,
      depth: 0.005,
      bevelEnabled: false
    })
  });

  class Cog extends troika3d.MeshFacade {
    get geometry() {
      return getCogGeometry()
    }
  }

  const tempVec3$2 = new three.Vector3();

  const cogActiveAnim = {
    from: {rotateX: 0},
    to: {rotateX: Math.PI * 2},
    duration: 5000,
    iterations: Infinity
  };


  const gripOffsetDist = 0.08;
  const gripOffsetAngle = Math.PI / 4;
  const largeRadius = 0.035;
  const smallRadius = largeRadius * 0.75;
  const strapWidth = 0.025;


  class Wristband extends troika3d.Group3DFacade {
    /**
     * Sync to the current XRFrame's gripPose - all matrix syncing is localized here
     * to avoid a full afterUpdate pass on every frame.
     */
    syncPose(gripPose) {
      if (gripPose) {
        this.visible = true;
        copyXRPoseToFacadeProps(gripPose, this);
        this.traverse(updateMatrices);
        if (this.onCogMove && this._cogFacade) {
          this.onCogMove(this._cogFacade.getWorldPosition(tempVec3$2));
        }
      } else {
        this.visible = false;
      }
    }

    describeChildren () {
      let { active } = this;

      let groupDef = this._childTpl || (this._childTpl = {
        key: 'g',
        facade: troika3d.Group3DFacade,
        rotateX: -gripOffsetAngle,
        y: gripOffsetDist * Math.cos(gripOffsetAngle),
        z: gripOffsetDist * Math.sin(gripOffsetAngle),
        children: [
          {
            key: 'strap',
            facade: Strap,
            smallRadius,
            largeRadius,
            width: strapWidth
          },
          {
            key: 'cog',
            facade: Cog,
            ref: f => {
              this._cogFacade = f;
            },
            rotateY: Math.PI / 2,
            x: smallRadius,
            animation: null,
            transition: {
              scale: {
                duration: 500,
                easing: 'easeOutBack'
              },
              'material.color': {
                interpolate: 'color'
              }
            }
          }
        ]
      });

      let [, cogDef] = groupDef.children;
      cogDef.scale = active ? 1.75 : 1;
      cogDef['material.color'] = active ? 0x3399ff : 0x999999;
      cogDef.animation = active ? cogActiveAnim : null;

      return groupDef
    }
  }


  function updateMatrices(obj) {
    if (obj.updateMatrices) {
      obj.updateMatrices();
    }
  }

  const vertexShader = `
varying vec2 vUV;
void main() {
  vUV = uv;
  if (uv.y == 0.0) { //src pos is worldspace
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  } else {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
}
`;

  const baseAlpha = 0.2;
  const scanlines = [
    // sep = separation between lines
    // vel = movement speed, in scans per second
    // size = width of line's gradient
    // alpha = alpha to add at line's center
    {sep: 0.4, vel: 0.15, size: 0.1, alpha: 0.1},
    {sep: 0.7, vel: 0.2, size: 0.15, alpha: 0.1},
    {sep: 0.3, vel: 0.3, size: 0.1, alpha: 0.1},
    {sep: 0.2, vel: 0.6, size: 0.1, alpha: 0.04},
    {sep: 0.1, vel: 0.4, size: 0.02, alpha: 0.04},
  ];

  const fragmentShader = `
uniform float time;
uniform vec4 fade;
uniform vec3 color;
varying vec2 vUV;

float distToScanline(float x, float separation, float velocity) {
  x += time / 1000.0 * velocity;
  float dist = abs(x - round(x / separation) * separation);
  return dist;
}

void main() {
  float alpha = ${baseAlpha};
  ${scanlines.map(({sep, vel, size, alpha}) =>
    `alpha += ${alpha} * smoothstep(${size / 2}, 0.0, distToScanline(vUV.y, ${sep}, ${vel}));`
  ).join('\n')}
  alpha *= min(smoothstep(fade.x, fade.y, vUV.y), smoothstep(fade.w, fade.z, vUV.y));
  gl_FragColor = vec4(color, alpha);
}
`;

  const epoch = Date.now();

  const defaultColor = 0x3399ff;

  let createMaterial = function() {
    return new three.ShaderMaterial({
      uniforms: {
        time: {get value() {return epoch - Date.now()}},
        color: {value: new three.Color()},
        fade: {value: new three.Vector4(0, 0.4, 0.7, 1)} //fade in+out gradient stops
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      // side: DoubleSide
    })
  };

  /**
   * A holographic projection cone effect. Creates a translucent mesh in a cone shape from
   * a single world-space source vertex to an arbitrary target shape, with animated lines
   * traveling from source to target.
   *
   * @member {Vector3} sourceWorldPosition - The world-space position of the cone's source
   * @member {number[]} targetVertices - The local-space vertices describing the target shape,
   *         e.g. a rectangle or circle. This array is treated as immutable, so if you need to
   *         update the vertices then pass a new array instance.
   * @member {Color|number|string} color - The color of the
   */
  class Projection extends troika3d.MeshFacade {
    constructor (parent) {
      super(parent);
      this.threeObject.frustumCulled = false;
      this.renderOrder = 99999;

      this.geometry = new three.BufferGeometry();
      this.autoDisposeGeometry = true;
      this.color = defaultColor;

      this.material = createMaterial();
    }

    syncSourcePosition() {
      // Sync the geometry from the current sourceWorldPosition value
      let {sourceWorldPosition:srcPos} = this;
      let posAttr = this.threeObject.geometry.getAttribute('position');
      if (srcPos && posAttr && (
        srcPos.x !== posAttr.getX(0) || srcPos.y !== posAttr.getY(0) || srcPos.z !== posAttr.getZ(0)
      )) {
        posAttr.setXYZ(0, srcPos.x, srcPos.y, srcPos.z);
        posAttr.needsUpdate = true;
      }
    }

    afterUpdate() {
      let {targetVertices, geometry, color} = this;

      // Update geometry vertices
      let posAttr = this.geometry.getAttribute('position');
      if (!posAttr || posAttr._data !== targetVertices) { //Note: targetVertices treated as immutable
        // position attribute: [...source_vertices, ...targetVertices]
        let posArr = new Float32Array(targetVertices.length + 3);
        posArr.set(targetVertices, 3); //first pos reserved for source vertex
        posAttr = new three.BufferAttribute(posArr, 3);
        posAttr.usage = three.DynamicDrawUsage;
        geometry.setAttribute('position', posAttr);

        // uv attribute: [0, 0, 0, 1, 0, 1, 0, 1, etc.]
        let uvAttr = new three.BufferAttribute(new Float32Array(posAttr.count * 2), 2);
        for (let i = 1; i < uvAttr.count; i++) {
          uvAttr.setY(i, 1);
        }
        geometry.setAttribute('uv', uvAttr);

        // index: triangles from the source vertex to each consecutive pair of target vertices
        let indexArr = [];
        for (let i = 1, len = targetVertices.length / 3; i <= len; i++) {
          indexArr.push(0, i === 1 ? len : i - 1, i);
        }
        geometry.setIndex(indexArr);
      }

      // Handle changing sourceWorldPosition
      this.syncSourcePosition();

      // Material
      if (color == null) {
        color = defaultColor;
      }
      if (color !== this._color) {
        this.material.uniforms.color.value.set(this._color = color);
      }

      super.afterUpdate();
    }
  }

  const tempMat4$1 = new three.Matrix4();
  const targetPos = new three.Vector3();
  const camPos = new three.Vector3();

  class ContentContainer extends troika3d.Object3DFacade {
    constructor (parent) {
      super(parent, new three.Group());
      this.distancePastGrip = 0.25; //distance past grip in camera-to-grip direction
      this.minDistanceFromCamera = 0.5;
      this.heightAboveGrip = 0.15;
      this.platformRadius = 0.25;
      this.projectionColor = null;
      this.projectionSourcePosition = null; //worldspace vec3
      this.gripPose = null;
      this.active = false;
      this.keepContentAlive = false;
    }

    /**
     * Sync to the current XRFrame's gripPose - all matrix syncing is localized here
     * to avoid a full afterUpdate pass on every frame.
     */
    syncPose(gripPose) {
      let visible = false;
      if (gripPose) {
        // Get current posed camera position, relative to the parent
        let cam = this.getCameraFacade().threeObject;
        camPos.setFromMatrixPosition(cam.matrixWorld)
          .applyMatrix4(troikaThreeUtils.invertMatrix4(this.threeObject.parent.matrixWorld, tempMat4$1));

        // Find target position
        let targetScale;
        if (this.active) {
          // Find direction vector and lengthen it to the target distance to find base position
          targetPos.copy(gripPose.transform.position);
          targetPos.y = camPos.y;
          targetPos.sub(camPos);
          targetPos.setLength(Math.max(this.minDistanceFromCamera, targetPos.length() + this.distancePastGrip));
          targetPos.add(camPos);
          targetPos.y = gripPose.transform.position.y + this.heightAboveGrip;
          targetScale = 1;
        } else {
          targetPos.copy(gripPose.transform.position);
          targetScale = 0.001;
        }

        // Pull partway toward target position and scale, like a spring
        let pos = this.threeObject.position;
        pos.lerp(targetPos, 0.05); //move by 5% of distance each frame)
        this.scale += (targetScale - this.scale) * 0.3;
        visible = this.scale > 0.01; //hide below a certain size

        if (visible) {
          // Rotate to face camera
          this.rotateY = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);

          // Update projection cone's source position
          let proj = this.getChildByKey('$projection');
          if (proj) {
            proj.syncSourcePosition();
          }

          // Sync all matrices
          this.traverse(updateMatrices$1);
        }
      }
      if (visible !== this.visible) {
        this.update({visible});
      }
    }

    describeChildren() {
      if (!this.visible && !this.keepContentAlive) {
        return null
      }

      let kids = this._kidsTpl || (this._kidsTpl = [
        {
          key: '$platform',
          facade: troika3d.CircleFacade,
          radius: 1,
          material: 'lambert',
          castShadow: true,
          receiveShadow: true,
          'material.color': 0x333333
        },
        {
          key: '$projection',
          facade: Projection,
          sourceWorldPosition: new three.Vector3(),
          targetVertices: Object.freeze(function () {
            // trace circular path
            let verts = [];
            for (let i = 0; i < 32; i++) {
              let angle = Math.PI * 2 * (i / 32);
              verts.push(Math.cos(angle), 0, Math.sin(angle));
            }
            return verts
          }())
        }
      ]);

      // Update platform size
      kids[0].scale = kids[1].scale = this.platformRadius;

      // Update projection source
      kids[1].sourceWorldPosition = this.projectionSourcePosition;

      // Colors
      kids[0]['material.color'] = this.platformColor;
      kids[1].color = this.projectionColor;

      return kids.concat(this.children)
    }
  }

  function updateMatrices$1(obj) {
    if (obj.updateMatrices) {
      obj.updateMatrices();
      obj._checkBoundsChange(); //TODO ugh shouldn't have to call private method
    }
  }

  const tempMat4$2 = new three.Matrix4();
  const tempQuat$2 = new three.Quaternion();
  const tempVec3$3 = new three.Vector3();
  const upVec3 = new three.Vector3(0, 1, 0);


  /**
   * This facade provides a container for arbitrary global UI, which is hidden by default
   * but is easily brought up by a simple gesture. A wristband is added to one of the hand
   * controllers, with an icon affordance on the inner wrist. When that icon is turned
   * upwards, the UI is projected from it.
   *
   * @property {('left'|'right')} preferredHand - which hand the wristband should appear on.
   */
  class WristMountedUI extends troika3d.Group3DFacade {
    constructor (parent) {
      super(parent);
      // Config:
      this.activeUpAngle = Math.PI / 7;
      this.preferredHand = 'left';
      this.platformRadius = 0.25;
      this.platformColor = 0x333333;
      this.projectionColor = 0x3399ff;
      this.keepContentAlive = false;
      this.onActiveChange = null;

      // Internal state:
      this.gripPose = null;
      this.active = false;

      this._cogPos = new three.Vector3();
      this.addEventListener('xrframe', this.onXRFrame.bind(this));
    }

    describeChildren () {
      // Only render children if we have a valid gripPose
      if (!this.gripPose) {
        return null
      }

      let children = this._childTpl || (this._childTpl = [
        {
          key: 'wristband',
          facade: Wristband,
          active: false,
          gripPose: null,
          onCogMove: (worldPos) => {
            this._cogPos.copy(worldPos);
          }
        },
        {
          key: 'content',
          facade: ContentContainer,
          active: false,
          gripPose: null,
          children: null
        }
      ]);

      let [wristbandDef, contentDef] = children;
      wristbandDef.active = contentDef.active = this.active;
      //wristbandDef.gripPose = contentDef.gripPose = this.gripPose
      contentDef.platformRadius = this.platformRadius;
      contentDef.platformColor = this.platformColor;
      contentDef.projectionColor = this.projectionColor;
      contentDef.projectionSourcePosition = this._cogPos;
      contentDef.keepContentAlive = this.keepContentAlive;
      contentDef.children = this.children;

      return children
    }

    updateMatrices() {
      // Force matrix to match that of the camera's pre-pose transform
      this.threeObject.matrixWorld.copy(this.getCameraFacade().threeObject.matrix);
      this.markWorldMatrixDirty();
    }

    onXRFrame (time, xrFrame) {
      let gripPose = null;
      let active = false;
      let inputSources = xrFrame.session.inputSources;
      if (inputSources) {
        let gripSpace = null;
        for (let i = 0, len = inputSources.length; i < len; i++) {
          if (inputSources[i].handedness === this.preferredHand) {
            gripSpace = inputSources[i].gripSpace;
            break
          }
        }
        if (gripSpace) {
          // Calculate grip pose so we can pass it down to the Wristband
          // Note: the gripPose will be relative to this object's matrix, which is synced to the
          // camera's base position. This simplifies child transform calculations because you can
          // treat them always as relative to default position/orientation.
          let cam = this.getCameraFacade();
          gripPose = xrFrame.getPose(gripSpace, cam.xrReferenceSpace);
          if (gripPose) {
            // If turned to upward angle, set to active
            // TODO: needs debouncing!
            tempVec3$3.set(1, 0, 0).applyQuaternion(
              tempQuat$2.setFromRotationMatrix(tempMat4$2.fromArray(gripPose.transform.matrix))
            );
            active = tempVec3$3.angleTo(upVec3) < this.activeUpAngle;
          }
        }
      }

      if (active !== this.active) {
        if (this.onActiveChange) {
          this.onActiveChange(active);
        }
        this.update({active});
      }

      if (!!gripPose !== !!this.gripPose) {
        this.update({gripPose});
      }
      else if (gripPose) {
        // Skip full afterUpdate pass, just give the gripPose to children - they both have
        // a syncPose method to handle syncing matrices without a full afterUpdate.
        this.forEachChild(child => child.syncPose(gripPose));
      }
    }
  }

  const degreeToRad = Math.PI / 180;

  let getMarkerGeometry = function () {
    const radius = 0.15;
    const innerRadius = 0.1;
    const depth = 0.05;
    const shape = new three.Shape();
    shape.moveTo(radius, -radius)
      .lineTo(radius, 0)
      .absellipse(0, 0, radius, radius, 0, 270 * degreeToRad, false, 0)
      .lineTo(radius, -radius);
    shape.holes = [
      new three.Path().moveTo(innerRadius, -innerRadius)
        .lineTo(0, -innerRadius)
        .absellipse(0, 0, innerRadius, innerRadius, 270 * degreeToRad, 0, true, 0)
        .lineTo(innerRadius, -innerRadius)
    ];

    const geom = new three.ExtrudeGeometry(shape, {
      curveSegments: 64,
      depth,
      bevelEnabled: false
      // bevelSize: 0.01,
      // bevelThickness: 0.01,
      // bevelSegments: 1
    })
      .rotateX(Math.PI / 2)
      .rotateY(Math.PI / 4)
      .translate(0, depth, 0);

    getMarkerGeometry = () => geom;
    return geom
  };

  class GroundTarget extends troika3d.MeshFacade {
    constructor (parent) {
      super(parent);
      this.geometry = getMarkerGeometry();
      this.material = new three.MeshLambertMaterial({
        transparent: true,
        opacity: 0.8
      });
      this.autoDisposeGeometry = true;
    }
  }

  const raycastPlane = new three.Plane().setComponents(0, 1, 0, 0);
  const tempVec3$4 = new three.Vector3();
  const tempQuat$3 = new three.Quaternion();
  const infiniteSphere = new three.Sphere(undefined, Infinity);

  /**
   * Basic teleportation. Add an instance of this facade anywhere in the scene.
   * The user can point-drag an XR pointer ray at the ground plane and be
   * teleported to that location when releasing. They can use a thumbstick while
   * targeting a ground location to set the resulting orientation direction. Also,
   * using the thumbstick while not targeting the ground will snap-rotate the view
   * by 45 degrees.
   *
   * It must be given a `onTeleport` callback function, which will be called with
   * an object holding `{position: {xPos, zPos}, rotation: yRot}`. These can then
   * be applied to the scene's `camera` config as the new camera reference origin.
   *
   * Currently this implementation only supports teleporting along the x-z plane
   * at y=0.
   */
  class TeleportControls extends troika3d.Object3DFacade {
    constructor (parent) {
      super(parent, new three.Group());

      this.maxDistance = 10;
      this.targeting = false;
      this.onTeleport = null;

      let markerConfig = this.markerConfig = {
        key: 'marker',
        facade: GroundTarget,
        'material.color': 0x003399,
        visible: false
      };
      this.children = [
        markerConfig
      ];

      let lastAxisAngle = 0;
      this.addEventListener('dragstart', e => {
        lastAxisAngle = 0;
        this.targeting = true;
        this.afterUpdate();
      });
      this.addEventListener('drag', e => {
        if (this.targeting) {
          let point = e.ray.intersectPlane(raycastPlane, tempVec3$4);
          if (point && point.distanceTo(this.getCameraPosition()) < this.maxDistance) {
            this.targeting = true;
            markerConfig.x = tempVec3$4.x;
            markerConfig.z = tempVec3$4.z;
            this.requestRender();
            // For rotation, start with the current direction of the camera. Then rotate
            // relative to that by the last controller stick/axis position.
            tempQuat$3.setFromRotationMatrix(this.getCameraFacade().threeObject.matrixWorld);
            tempVec3$4.set(0, 0, -1).applyQuaternion(tempQuat$3);
            markerConfig.rotateY = Math.atan2(-tempVec3$4.x, -tempVec3$4.z) + lastAxisAngle;
          } else {
            this.targeting = false;
          }
          this.afterUpdate();
        }
      });
      this.addEventListener('dragend', e => {
        if (this.targeting) {
          this.targeting = false;
          this.afterUpdate();
          this.onTeleport({
            position: { x: markerConfig.x, z: markerConfig.z },
            rotation: markerConfig.rotateY
          });
        }
      });

      const rotateDebounce = 500;
      const rotateBy = Math.PI / -4;
      let lastRotateTime = 0;
      this.addEventListener('wheel', e => {
        if (this.targeting) {
          lastAxisAngle = Math.atan2(-e.deltaX, -e.deltaY);
        } else {
          let now = Date.now();
          if (now - lastRotateTime > rotateDebounce && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            lastRotateTime = now; //keep from rotating again until axis is reset
            this.onTeleport({
              rotation: Math.sign(e.deltaX) * rotateBy + this.getCameraFacade().rotateY
            });
          }
        }
      });
    }

    afterUpdate () {
      this.markerConfig.visible = this.targeting;
      super.afterUpdate();
    }

    getBoundingSphere () {
      return infiniteSphere
    }

    // Raycast for dragging events will hit anywhere on ground plane if no other object
    // is hit first.
    raycast (raycaster) {
      const intersection = raycaster.ray.intersectPlane(raycastPlane, tempVec3$4);
      return intersection
        ? [{
          distance: raycaster.ray.origin.distanceTo(intersection),
          point: intersection.clone()
        }]
        : null
    }
  }

  exports.AXIS_THUMBSTICK_X = AXIS_THUMBSTICK_X;
  exports.AXIS_THUMBSTICK_Y = AXIS_THUMBSTICK_Y;
  exports.AXIS_TOUCHPAD_X = AXIS_TOUCHPAD_X;
  exports.AXIS_TOUCHPAD_Y = AXIS_TOUCHPAD_Y;
  exports.BUTTON_DEFAULT_BACK = BUTTON_DEFAULT_BACK;
  exports.BUTTON_SQUEEZE = BUTTON_SQUEEZE;
  exports.BUTTON_THUMBSTICK = BUTTON_THUMBSTICK;
  exports.BUTTON_TOUCHPAD = BUTTON_TOUCHPAD;
  exports.BUTTON_TRIGGER = BUTTON_TRIGGER;
  exports.BasicGrip = Basic;
  exports.CursorFacade = CursorFacade;
  exports.GripFacade = GripFacade;
  exports.OculusTouchGrip = OculusTouchGrip;
  exports.ReactXRAware = ReactXRAware;
  exports.TARGET_RAY_RENDERORDER = TARGET_RAY_RENDERORDER;
  exports.TargetRayFacade = TargetRayFacade;
  exports.TeleportControls = TeleportControls;
  exports.WorldXRFacade = WorldXRFacade;
  exports.WristMountedUI = WristMountedUI;
  exports.XRAwarePropTypes = XRAwarePropTypes;
  exports.XRInputSourceFacade = XRInputSourceFacade;
  exports.copyXRPoseToFacadeProps = copyXRPoseToFacadeProps;
  exports.extendAsXRCamera = extendAsXRCamera;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
