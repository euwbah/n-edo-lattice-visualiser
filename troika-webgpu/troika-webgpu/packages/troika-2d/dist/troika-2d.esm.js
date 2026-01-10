import { PointerEventTarget, utils, WorldBaseFacade, ReactCanvasBase } from 'troika-core';
export { Facade, ListFacade, ParentFacade } from 'troika-core';
import React from 'react';
import T from 'prop-types';

/**
 * hitTestContext
 *
 * This is a hidden CanvasRenderContext2D instance that has been overridden to track
 * whenever something is drawn at a given x/y coordinate. This can be used for testing
 * whether an Object2DFacade is under the mouse cursor, by passing this as the context
 * to its render() method.
 */

const hitTestContext = document.createElement('canvas').getContext('2d');
hitTestContext.save();

/**
 * Start hit testing for the given x/y coordinate. The x/y should be relative to the canvas.
 * @param x
 * @param y
 */
hitTestContext.startHitTesting = function(x, y) {
  this._x = x;
  this._y = y;
  this.didHit = false;
  this.restore();
  this.save();
};

hitTestContext.fill = function() {
  if (this.isPointInPath(this._x, this._y)) {
    this.didHit = true;
  }
};

const pointInStrokeMethod = `isPointIn${typeof CanvasRenderingContext2D.prototype.isPointInStroke === 'function' ? 'Stroke' : 'Path'}`; //Ugly fallback for IE
hitTestContext.stroke = function() {
  if (this[pointInStrokeMethod](this._x, this._y)) {
    this.didHit = true;
  }
};

// Rect shortcuts
hitTestContext.fillRect = function(x, y, w, h) {
  this.beginPath();
  this.rect(x, y, w, h);
  this.fill();
};
hitTestContext.strokeRect = function(x, y, w, h) {
  this.beginPath();
  this.rect(x, y, w, h);
  this.stroke();
};

function multiplyMatrices(a, b, target) {
  let a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5];
  target[0] = a0 * b0 + a2 * b1;
  target[1] = a1 * b0 + a3 * b1;
  target[2] = a0 * b2 + a2 * b3;
  target[3] = a1 * b2 + a3 * b3;
  target[4] = a0 * b4 + a2 * b5 + a[4];
  target[5] = a1 * b4 + a3 * b5 + a[5];
}

function copyMatrix(fromMat, toMat) {
  for (let i = 0; i < 6; i++) {
    toMat[i] = fromMat[i];
  }
}

let _worldMatrixVersion = 0;



class Object2DFacade extends PointerEventTarget {
  constructor(parent) {
    super(parent);

    // Find nearest Object2DFacade ancestor and add direct parent/child
    // references. In addition to faster render tree traversal, maintaining
    // this separate tree allows exitAnimation to keep rendering instances
    // after removal from the facade tree.
    while (parent && !parent.isObject2D) {
      parent = parent.parent;
    }
    if (parent) {
      parent._childObjects2D[this.$facadeId] = this;
    }
    this._parentObject2DFacade = parent;
    this._childObjects2D = Object.create(null);

    this.transformMatrix = [1, 0, 0, 1, 0, 0];
    this.worldTransformMatrix = [1, 0, 0, 1, 0, 0];
  }

  afterUpdate() {
    this.updateMatrices();
    super.afterUpdate();
  }

  /**
   * @template
   * Implement this to render this object's content into the given canvas 2d context.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
  }

  /**
   * Update this facade's `transformMatrix` and `worldTransformMatrix` to the current state if necessary.
   *
   * As long as this is called from the `afterUpdate` lifecycle method or later, it can be safely assumed that
   * the matrices of all ancestors have already been similarly updated so the result should always be accurate.
   *
   * @returns {Boolean} true if an update was performed
   */
  updateMatrices() {
    let parentObj2D = this._parentObject2DFacade;
    let needsWorldMatrixUpdate;
    if (this._matrixChanged) {
      this._updateLocalMatrix();
      this._matrixChanged = false;
      needsWorldMatrixUpdate = true;
    } else {
      needsWorldMatrixUpdate = parentObj2D && parentObj2D._worldMatrixVersion > this._worldMatrixVersion;
    }
    if (needsWorldMatrixUpdate) {
      if (parentObj2D) {
        multiplyMatrices(parentObj2D.worldTransformMatrix, this.transformMatrix, this.worldTransformMatrix);
      } else {
        copyMatrix(this.transformMatrix, this.worldTransformMatrix);
      }

      this._worldMatrixVersion = ++_worldMatrixVersion;
    }
  }

  _updateLocalMatrix() {
    let mat = this.transformMatrix;
    let {x, y, rotate, scaleX, scaleY} = this;
    let cos = rotate === 0 ? 1 : Math.cos(rotate);
    let sin = rotate === 0 ? 0 : Math.sin(rotate);
    mat[0] = scaleX * cos;
    mat[1] = scaleX * sin;
    mat[2] = scaleY * -sin;
    mat[3] = scaleY * cos;
    mat[4] = x;
    mat[5] = y;
  }

  hitTest(x, y) {
    hitTestContext.startHitTesting(x, y);

    this.updateMatrices();
    let matrix = this.worldTransformMatrix;
    hitTestContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);

    // Render using hit testing context
    this.render(hitTestContext);

    return hitTestContext.didHit
  }

  getProjectedPosition(x=0, y=0) {
    this.updateMatrices();
    let matrix = this.worldTransformMatrix;
    return {
      x: x === 0 ? matrix[4] : x * matrix[0] + y * matrix[2] + matrix[4],
      y: y === 0 ? matrix[5] : x * matrix[1] + y * matrix[3] + matrix[5]
    }
  }

  // Like forEachChild but only for the Object2D render tree - skips intermediates like Lists
  // and can include objects that have been removed but are still in their exitAnimation
  forEachChildObject2D(fn) {
    let kids = this._childObjects2D;
    for (let id in kids) {
      fn(kids[id]);
    }
  }

  destructor() {
    let parentObj2D = this._parentObject2DFacade;
    if (parentObj2D) {
      delete parentObj2D._childObjects2D[this.$facadeId];
    }
    super.destructor();
  }
}

const proto = Object2DFacade.prototype;
proto.isObject2D = true;
proto.z = 0;
proto._worldMatrixVersion = -1;



// Define props that affect the object's local transform matrix
function defineTransformProp(prop, defaultValue) {
  let privateProp = '➤' + prop;
  Object.defineProperty(Object2DFacade.prototype, prop, {
    get() {
      return (privateProp in this) ? this[privateProp] : defaultValue
    },
    set(value) {
      let lastVal = this[privateProp];
      if (lastVal !== value) {
        this[privateProp] = value;
        this._matrixChanged = true;
      }
    }
  });
}
defineTransformProp('x', 0);
defineTransformProp('y', 0);
defineTransformProp('rotate', 0);
defineTransformProp('scaleX', 1);
defineTransformProp('scaleY', 1);

class Group2DFacade extends Object2DFacade {

}

/**
 * Defines a snippet of HTML content that will be positioned to line up with the object's
 * x/y coordinates after all transformations. This is a convenient way to display tooltips,
 * labels, and pieces of UI that follow a given object around.
 */
class HtmlOverlay2DFacade extends Object2DFacade {
  constructor(parent) {
    super(parent);

    /**
     * Defines the HTML content to be rendered. The type/format of this value is dependent
     * on the wrapping implementation; for example the Canvas2D.js React-based wrapper will
     * expect a React element descriptor, while other wrappers might expect a HTML string.
     *
     * When using the React-based wrapper, the rendered React component will not be updated
     * when the overlay is repositioned, unless (a) the `html` element descriptor changes, or
     * (b) that element descriptor has a `shouldUpdateOnMove` prop.
     */
    this.html = null;

    /**
     * If set to true, the overlay's x/y position on screen will not be rounded to whole-pixel
     * values. This can give more accurate alignment at the expense of fuzzy lines and text.
     */
    this.exact = false;

    this.notifyWorld('addHtmlOverlay', this);
  }

  destructor() {
    this.notifyWorld('removeHtmlOverlay', this);
    super.destructor();
  }
}

class Text2DFacade extends Object2DFacade {
  render(context) {
    context.font = `${ this.fontStyle } ${ this.fontWeight } ${ this.fontStretch } ${ this.fontSize } ${ this.fontFamily }`;
    context.textAlign = this.textAlign;
    context.textBaseline = this.textBaseline;
    context.fillStyle = this.color;
    context.globalAlpha = this.opacity;
    context.fillText(this.text, 0, 0);
  }
}

// Defaults
utils.assign(Text2DFacade.prototype, {
  color: '#fff',
  fontFamily: 'sans-serif',
  fontSize: '12px',
  fontStretch: '',
  fontStyle: '',
  fontWeight: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  text: '',
  opacity: 1
});

function byZ(a, b) {
  return a.z - b.z
}

function traverseInZOrder(facade, callback) {
  callback && callback(facade);

  // visit children, ordered by z
  let kids = [];
  let hasDifferentZs = false;
  facade.forEachChildObject2D((kid) => {
    if (!hasDifferentZs && kids.length && kid.z !== kids[0].z) {
      hasDifferentZs = true;
    }
    kids.push(kid);
  });
  if (hasDifferentZs) {
    // TODO secondary sort by tree order?
    kids.sort(byZ);
  }
  for (let i = 0, len = kids.length; i < len; i++) {
    traverseInZOrder(kids[i], callback);
  }
}



class BackgroundFacade extends Object2DFacade {
  render(ctx) {
    if (this.color != null) {
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  hitTest(x, y) {
    return true //always hits, but at furthest possible distance
  }
}
BackgroundFacade.prototype.z = -Infinity;



class World2DFacade extends WorldBaseFacade {
  constructor(canvas) {
    super(canvas);
    this._context = canvas.getContext('2d');
    this._onBgClick = this._onBgClick.bind(this);
  }

  describeChildren() {
    return {
      key: 'bg',
      facade: BackgroundFacade,
      color: this.backgroundColor,
      width: this.width,
      height: this.height,
      onClick: this.onBackgroundClick ? this._onBgClick : null,
      children: this.objects
    }
  }

  doRender() {
    let canvas = this._element;
    let ctx = this._context;
    let {width, height} = this;
    let pixelRatio = this.pixelRatio || window.devicePixelRatio || 1;

    // Clear canvas and set size
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    // Set root pixel ratio transform
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // Walk tree in z order and render each Object2DFacade
    let root = this.getChildByKey('bg');
    traverseInZOrder(root, facade => {
      ctx.save();

      // update transform
      let mat = facade.worldTransformMatrix;
      ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]);

      // render
      facade.render(ctx);

      ctx.restore();
    });
  }


  /**
   * Implementation of abstract
   */
  getFacadeUserSpaceXYZ(facade) {
    let {x, y} = facade.getProjectedPosition(0, 0);
    let z = facade.z;
    return {
      x: x,
      y: y,
      z: z > 1 ? 1 / z : 1 - z //always non-negative, larger numbers closer to camera
      //TODO honor cascaded z
    }
  }

  /**
   * @override Implementation of abstract
   * @return {Array<{facade, distance, ?distanceBias, ...}>|null}
   */
  getFacadesAtEvent(e, filterFn) {
    const canvasRect = e.target.getBoundingClientRect(); //e.target is the canvas
    let x = e.clientX - canvasRect.left;
    let y = e.clientY - canvasRect.top;
    let hits = null;
    let distance = 0;

    traverseInZOrder(this.getChildByKey('bg'), facade => {
      if ((!filterFn || filterFn(facade)) && facade.hitTest(x, y)) {
        if (!hits) hits = Object.create(null);
        hits[facade.$facadeId] = {
          facade: facade,
          distance: distance-- //since iteration is in z order, we can just decrement for a logical distance
        };
      }
    });

    if (hits) {
      hits = Object.keys(hits).map(id => hits[id]);
    }
    return hits
  }

  _onBgClick(e) {
    // Ignore clicks that bubbled up
    if (e.target === e.currentTarget) {
      this.onBackgroundClick(e);
    }
  }
}

class Canvas2D extends React.Component {
  render() {
    const {props} = this;
    return React.createElement(
      ReactCanvasBase,
      utils.assign({}, props, {
        worldFacade: props.worldFacade || World2DFacade,
        worldProps: utils.assign({}, {
          backgroundColor: props.backgroundColor,
          onBackgroundClick: props.onBackgroundClick,
          objects: props.objects
        }, props.worldProps)
      }),
      props.children
    )
  }
}

Canvas2D.displayName = 'Canvas2D';

Canvas2D.propTypes = utils.assignIf(
  {
    backgroundColor: T.any,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    onBackgroundClick: T.func
  },
  ReactCanvasBase.commonPropTypes
);

export { Canvas2D, Group2DFacade, HtmlOverlay2DFacade, Object2DFacade, Text2DFacade, World2DFacade };
